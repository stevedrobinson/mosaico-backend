(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function() {

  // nb. This is for IE10 and lower _only_.
  var supportCustomEvent = window.CustomEvent;
  if (!supportCustomEvent || typeof supportCustomEvent === 'object') {
    supportCustomEvent = function CustomEvent(event, x) {
      x = x || {};
      var ev = document.createEvent('CustomEvent');
      ev.initCustomEvent(event, !!x.bubbles, !!x.cancelable, x.detail || null);
      return ev;
    };
    supportCustomEvent.prototype = window.Event.prototype;
  }

  /**
   * @param {Element} el to check for stacking context
   * @return {boolean} whether this el or its parents creates a stacking context
   */
  function createsStackingContext(el) {
    while (el && el !== document.body) {
      var s = window.getComputedStyle(el);
      var invalid = function(k, ok) {
        return !(s[k] === undefined || s[k] === ok);
      }
      if (s.opacity < 1 ||
          invalid('zIndex', 'auto') ||
          invalid('transform', 'none') ||
          invalid('mixBlendMode', 'normal') ||
          invalid('filter', 'none') ||
          invalid('perspective', 'none') ||
          s['isolation'] === 'isolate' ||
          s.position === 'fixed' ||
          s.webkitOverflowScrolling === 'touch') {
        return true;
      }
      el = el.parentElement;
    }
    return false;
  }

  /**
   * Finds the nearest <dialog> from the passed element.
   *
   * @param {Element} el to search from
   * @return {HTMLDialogElement} dialog found
   */
  function findNearestDialog(el) {
    while (el) {
      if (el.localName === 'dialog') {
        return /** @type {HTMLDialogElement} */ (el);
      }
      el = el.parentElement;
    }
    return null;
  }

  /**
   * Blur the specified element, as long as it's not the HTML body element.
   * This works around an IE9/10 bug - blurring the body causes Windows to
   * blur the whole application.
   *
   * @param {Element} el to blur
   */
  function safeBlur(el) {
    if (el && el.blur && el !== document.body) {
      el.blur();
    }
  }

  /**
   * @param {!NodeList} nodeList to search
   * @param {Node} node to find
   * @return {boolean} whether node is inside nodeList
   */
  function inNodeList(nodeList, node) {
    for (var i = 0; i < nodeList.length; ++i) {
      if (nodeList[i] === node) {
        return true;
      }
    }
    return false;
  }

  /**
   * @param {HTMLFormElement} el to check
   * @return {boolean} whether this form has method="dialog"
   */
  function isFormMethodDialog(el) {
    if (!el || !el.hasAttribute('method')) {
      return false;
    }
    return el.getAttribute('method').toLowerCase() === 'dialog';
  }

  /**
   * @param {!HTMLDialogElement} dialog to upgrade
   * @constructor
   */
  function dialogPolyfillInfo(dialog) {
    this.dialog_ = dialog;
    this.replacedStyleTop_ = false;
    this.openAsModal_ = false;

    // Set a11y role. Browsers that support dialog implicitly know this already.
    if (!dialog.hasAttribute('role')) {
      dialog.setAttribute('role', 'dialog');
    }

    dialog.show = this.show.bind(this);
    dialog.showModal = this.showModal.bind(this);
    dialog.close = this.close.bind(this);

    if (!('returnValue' in dialog)) {
      dialog.returnValue = '';
    }

    if ('MutationObserver' in window) {
      var mo = new MutationObserver(this.maybeHideModal.bind(this));
      mo.observe(dialog, {attributes: true, attributeFilter: ['open']});
    } else {
      // IE10 and below support. Note that DOMNodeRemoved etc fire _before_ removal. They also
      // seem to fire even if the element was removed as part of a parent removal. Use the removed
      // events to force downgrade (useful if removed/immediately added).
      var removed = false;
      var cb = function() {
        removed ? this.downgradeModal() : this.maybeHideModal();
        removed = false;
      }.bind(this);
      var timeout;
      var delayModel = function(ev) {
        if (ev.target !== dialog) { return; }  // not for a child element
        var cand = 'DOMNodeRemoved';
        removed |= (ev.type.substr(0, cand.length) === cand);
        window.clearTimeout(timeout);
        timeout = window.setTimeout(cb, 0);
      };
      ['DOMAttrModified', 'DOMNodeRemoved', 'DOMNodeRemovedFromDocument'].forEach(function(name) {
        dialog.addEventListener(name, delayModel);
      });
    }
    // Note that the DOM is observed inside DialogManager while any dialog
    // is being displayed as a modal, to catch modal removal from the DOM.

    Object.defineProperty(dialog, 'open', {
      set: this.setOpen.bind(this),
      get: dialog.hasAttribute.bind(dialog, 'open')
    });

    this.backdrop_ = document.createElement('div');
    this.backdrop_.className = 'backdrop';
    this.backdrop_.addEventListener('click', this.backdropClick_.bind(this));
  }

  dialogPolyfillInfo.prototype = {

    get dialog() {
      return this.dialog_;
    },

    /**
     * Maybe remove this dialog from the modal top layer. This is called when
     * a modal dialog may no longer be tenable, e.g., when the dialog is no
     * longer open or is no longer part of the DOM.
     */
    maybeHideModal: function() {
      if (this.dialog_.hasAttribute('open') && document.body.contains(this.dialog_)) { return; }
      this.downgradeModal();
    },

    /**
     * Remove this dialog from the modal top layer, leaving it as a non-modal.
     */
    downgradeModal: function() {
      if (!this.openAsModal_) { return; }
      this.openAsModal_ = false;
      this.dialog_.style.zIndex = '';

      // This won't match the native <dialog> exactly because if the user set top on a centered
      // polyfill dialog, that top gets thrown away when the dialog is closed. Not sure it's
      // possible to polyfill this perfectly.
      if (this.replacedStyleTop_) {
        this.dialog_.style.top = '';
        this.replacedStyleTop_ = false;
      }

      // Clear the backdrop and remove from the manager.
      this.backdrop_.parentNode && this.backdrop_.parentNode.removeChild(this.backdrop_);
      dialogPolyfill.dm.removeDialog(this);
    },

    /**
     * @param {boolean} value whether to open or close this dialog
     */
    setOpen: function(value) {
      if (value) {
        this.dialog_.hasAttribute('open') || this.dialog_.setAttribute('open', '');
      } else {
        this.dialog_.removeAttribute('open');
        this.maybeHideModal();  // nb. redundant with MutationObserver
      }
    },

    /**
     * Handles clicks on the fake .backdrop element, redirecting them as if
     * they were on the dialog itself.
     *
     * @param {!Event} e to redirect
     */
    backdropClick_: function(e) {
      if (!this.dialog_.hasAttribute('tabindex')) {
        // Clicking on the backdrop should move the implicit cursor, even if dialog cannot be
        // focused. Create a fake thing to focus on. If the backdrop was _before_ the dialog, this
        // would not be needed - clicks would move the implicit cursor there.
        var fake = document.createElement('div');
        this.dialog_.insertBefore(fake, this.dialog_.firstChild);
        fake.tabIndex = -1;
        fake.focus();
        this.dialog_.removeChild(fake);
      } else {
        this.dialog_.focus();
      }

      var redirectedEvent = document.createEvent('MouseEvents');
      redirectedEvent.initMouseEvent(e.type, e.bubbles, e.cancelable, window,
          e.detail, e.screenX, e.screenY, e.clientX, e.clientY, e.ctrlKey,
          e.altKey, e.shiftKey, e.metaKey, e.button, e.relatedTarget);
      this.dialog_.dispatchEvent(redirectedEvent);
      e.stopPropagation();
    },

    /**
     * Focuses on the first focusable element within the dialog. This will always blur the current
     * focus, even if nothing within the dialog is found.
     */
    focus_: function() {
      // Find element with `autofocus` attribute, or fall back to the first form/tabindex control.
      var target = this.dialog_.querySelector('[autofocus]:not([disabled])');
      if (!target && this.dialog_.tabIndex >= 0) {
        target = this.dialog_;
      }
      if (!target) {
        // Note that this is 'any focusable area'. This list is probably not exhaustive, but the
        // alternative involves stepping through and trying to focus everything.
        var opts = ['button', 'input', 'keygen', 'select', 'textarea'];
        var query = opts.map(function(el) {
          return el + ':not([disabled])';
        });
        // TODO(samthor): tabindex values that are not numeric are not focusable.
        query.push('[tabindex]:not([disabled]):not([tabindex=""])');  // tabindex != "", not disabled
        target = this.dialog_.querySelector(query.join(', '));
      }
      safeBlur(document.activeElement);
      target && target.focus();
    },

    /**
     * Sets the zIndex for the backdrop and dialog.
     *
     * @param {number} dialogZ
     * @param {number} backdropZ
     */
    updateZIndex: function(dialogZ, backdropZ) {
      if (dialogZ < backdropZ) {
        throw new Error('dialogZ should never be < backdropZ');
      }
      this.dialog_.style.zIndex = dialogZ;
      this.backdrop_.style.zIndex = backdropZ;
    },

    /**
     * Shows the dialog. If the dialog is already open, this does nothing.
     */
    show: function() {
      if (!this.dialog_.open) {
        this.setOpen(true);
        this.focus_();
      }
    },

    /**
     * Show this dialog modally.
     */
    showModal: function() {
      if (this.dialog_.hasAttribute('open')) {
        throw new Error('Failed to execute \'showModal\' on dialog: The element is already open, and therefore cannot be opened modally.');
      }
      if (!document.body.contains(this.dialog_)) {
        throw new Error('Failed to execute \'showModal\' on dialog: The element is not in a Document.');
      }
      if (!dialogPolyfill.dm.pushDialog(this)) {
        throw new Error('Failed to execute \'showModal\' on dialog: There are too many open modal dialogs.');
      }

      if (createsStackingContext(this.dialog_.parentElement)) {
        console.warn('A dialog is being shown inside a stacking context. ' +
            'This may cause it to be unusable. For more information, see this link: ' +
            'https://github.com/GoogleChrome/dialog-polyfill/#stacking-context');
      }

      this.setOpen(true);
      this.openAsModal_ = true;

      // Optionally center vertically, relative to the current viewport.
      if (dialogPolyfill.needsCentering(this.dialog_)) {
        dialogPolyfill.reposition(this.dialog_);
        this.replacedStyleTop_ = true;
      } else {
        this.replacedStyleTop_ = false;
      }

      // Insert backdrop.
      this.dialog_.parentNode.insertBefore(this.backdrop_, this.dialog_.nextSibling);

      // Focus on whatever inside the dialog.
      this.focus_();
    },

    /**
     * Closes this HTMLDialogElement. This is optional vs clearing the open
     * attribute, however this fires a 'close' event.
     *
     * @param {string=} opt_returnValue to use as the returnValue
     */
    close: function(opt_returnValue) {
      if (!this.dialog_.hasAttribute('open')) {
        throw new Error('Failed to execute \'close\' on dialog: The element does not have an \'open\' attribute, and therefore cannot be closed.');
      }
      this.setOpen(false);

      // Leave returnValue untouched in case it was set directly on the element
      if (opt_returnValue !== undefined) {
        this.dialog_.returnValue = opt_returnValue;
      }

      // Triggering "close" event for any attached listeners on the <dialog>.
      var closeEvent = new supportCustomEvent('close', {
        bubbles: false,
        cancelable: false
      });
      this.dialog_.dispatchEvent(closeEvent);
    }

  };

  var dialogPolyfill = {};

  dialogPolyfill.reposition = function(element) {
    var scrollTop = document.body.scrollTop || document.documentElement.scrollTop;
    var topValue = scrollTop + (window.innerHeight - element.offsetHeight) / 2;
    element.style.top = Math.max(scrollTop, topValue) + 'px';
  };

  dialogPolyfill.isInlinePositionSetByStylesheet = function(element) {
    for (var i = 0; i < document.styleSheets.length; ++i) {
      var styleSheet = document.styleSheets[i];
      var cssRules = null;
      // Some browsers throw on cssRules.
      try {
        cssRules = styleSheet.cssRules;
      } catch (e) {}
      if (!cssRules) { continue; }
      for (var j = 0; j < cssRules.length; ++j) {
        var rule = cssRules[j];
        var selectedNodes = null;
        // Ignore errors on invalid selector texts.
        try {
          selectedNodes = document.querySelectorAll(rule.selectorText);
        } catch(e) {}
        if (!selectedNodes || !inNodeList(selectedNodes, element)) {
          continue;
        }
        var cssTop = rule.style.getPropertyValue('top');
        var cssBottom = rule.style.getPropertyValue('bottom');
        if ((cssTop && cssTop !== 'auto') || (cssBottom && cssBottom !== 'auto')) {
          return true;
        }
      }
    }
    return false;
  };

  dialogPolyfill.needsCentering = function(dialog) {
    var computedStyle = window.getComputedStyle(dialog);
    if (computedStyle.position !== 'absolute') {
      return false;
    }

    // We must determine whether the top/bottom specified value is non-auto.  In
    // WebKit/Blink, checking computedStyle.top == 'auto' is sufficient, but
    // Firefox returns the used value. So we do this crazy thing instead: check
    // the inline style and then go through CSS rules.
    if ((dialog.style.top !== 'auto' && dialog.style.top !== '') ||
        (dialog.style.bottom !== 'auto' && dialog.style.bottom !== '')) {
      return false;
    }
    return !dialogPolyfill.isInlinePositionSetByStylesheet(dialog);
  };

  /**
   * @param {!Element} element to force upgrade
   */
  dialogPolyfill.forceRegisterDialog = function(element) {
    if (window.HTMLDialogElement || element.showModal) {
      console.warn('This browser already supports <dialog>, the polyfill ' +
          'may not work correctly', element);
    }
    if (element.localName !== 'dialog') {
      throw new Error('Failed to register dialog: The element is not a dialog.');
    }
    new dialogPolyfillInfo(/** @type {!HTMLDialogElement} */ (element));
  };

  /**
   * @param {!Element} element to upgrade, if necessary
   */
  dialogPolyfill.registerDialog = function(element) {
    if (!element.showModal) {
      dialogPolyfill.forceRegisterDialog(element);
    }
  };

  /**
   * @constructor
   */
  dialogPolyfill.DialogManager = function() {
    /** @type {!Array<!dialogPolyfillInfo>} */
    this.pendingDialogStack = [];

    var checkDOM = this.checkDOM_.bind(this);

    // The overlay is used to simulate how a modal dialog blocks the document.
    // The blocking dialog is positioned on top of the overlay, and the rest of
    // the dialogs on the pending dialog stack are positioned below it. In the
    // actual implementation, the modal dialog stacking is controlled by the
    // top layer, where z-index has no effect.
    this.overlay = document.createElement('div');
    this.overlay.className = '_dialog_overlay';
    this.overlay.addEventListener('click', function(e) {
      this.forwardTab_ = undefined;
      e.stopPropagation();
      checkDOM([]);  // sanity-check DOM
    }.bind(this));

    this.handleKey_ = this.handleKey_.bind(this);
    this.handleFocus_ = this.handleFocus_.bind(this);

    this.zIndexLow_ = 100000;
    this.zIndexHigh_ = 100000 + 150;

    this.forwardTab_ = undefined;

    if ('MutationObserver' in window) {
      this.mo_ = new MutationObserver(function(records) {
        var removed = [];
        records.forEach(function(rec) {
          for (var i = 0, c; c = rec.removedNodes[i]; ++i) {
            if (!(c instanceof Element)) {
              continue;
            } else if (c.localName === 'dialog') {
              removed.push(c);
            }
            removed = removed.concat(c.querySelectorAll('dialog'));
          }
        });
        removed.length && checkDOM(removed);
      });
    }
  };

  /**
   * Called on the first modal dialog being shown. Adds the overlay and related
   * handlers.
   */
  dialogPolyfill.DialogManager.prototype.blockDocument = function() {
    document.documentElement.addEventListener('focus', this.handleFocus_, true);
    document.addEventListener('keydown', this.handleKey_);
    this.mo_ && this.mo_.observe(document, {childList: true, subtree: true});
  };

  /**
   * Called on the first modal dialog being removed, i.e., when no more modal
   * dialogs are visible.
   */
  dialogPolyfill.DialogManager.prototype.unblockDocument = function() {
    document.documentElement.removeEventListener('focus', this.handleFocus_, true);
    document.removeEventListener('keydown', this.handleKey_);
    this.mo_ && this.mo_.disconnect();
  };

  /**
   * Updates the stacking of all known dialogs.
   */
  dialogPolyfill.DialogManager.prototype.updateStacking = function() {
    var zIndex = this.zIndexHigh_;

    for (var i = 0, dpi; dpi = this.pendingDialogStack[i]; ++i) {
      dpi.updateZIndex(--zIndex, --zIndex);
      if (i === 0) {
        this.overlay.style.zIndex = --zIndex;
      }
    }

    // Make the overlay a sibling of the dialog itself.
    var last = this.pendingDialogStack[0];
    if (last) {
      var p = last.dialog.parentNode || document.body;
      p.appendChild(this.overlay);
    } else if (this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
  };

  /**
   * @param {Element} candidate to check if contained or is the top-most modal dialog
   * @return {boolean} whether candidate is contained in top dialog
   */
  dialogPolyfill.DialogManager.prototype.containedByTopDialog_ = function(candidate) {
    while (candidate = findNearestDialog(candidate)) {
      for (var i = 0, dpi; dpi = this.pendingDialogStack[i]; ++i) {
        if (dpi.dialog === candidate) {
          return i === 0;  // only valid if top-most
        }
      }
      candidate = candidate.parentElement;
    }
    return false;
  };

  dialogPolyfill.DialogManager.prototype.handleFocus_ = function(event) {
    if (this.containedByTopDialog_(event.target)) { return; }

    event.preventDefault();
    event.stopPropagation();
    safeBlur(/** @type {Element} */ (event.target));

    if (this.forwardTab_ === undefined) { return; }  // move focus only from a tab key

    var dpi = this.pendingDialogStack[0];
    var dialog = dpi.dialog;
    var position = dialog.compareDocumentPosition(event.target);
    if (position & Node.DOCUMENT_POSITION_PRECEDING) {
      if (this.forwardTab_) {  // forward
        dpi.focus_();
      } else {  // backwards
        document.documentElement.focus();
      }
    } else {
      // TODO: Focus after the dialog, is ignored.
    }

    return false;
  };

  dialogPolyfill.DialogManager.prototype.handleKey_ = function(event) {
    this.forwardTab_ = undefined;
    if (event.keyCode === 27) {
      event.preventDefault();
      event.stopPropagation();
      var cancelEvent = new supportCustomEvent('cancel', {
        bubbles: false,
        cancelable: true
      });
      var dpi = this.pendingDialogStack[0];
      if (dpi && dpi.dialog.dispatchEvent(cancelEvent)) {
        dpi.dialog.close();
      }
    } else if (event.keyCode === 9) {
      this.forwardTab_ = !event.shiftKey;
    }
  };

  /**
   * Finds and downgrades any known modal dialogs that are no longer displayed. Dialogs that are
   * removed and immediately readded don't stay modal, they become normal.
   *
   * @param {!Array<!HTMLDialogElement>} removed that have definitely been removed
   */
  dialogPolyfill.DialogManager.prototype.checkDOM_ = function(removed) {
    // This operates on a clone because it may cause it to change. Each change also calls
    // updateStacking, which only actually needs to happen once. But who removes many modal dialogs
    // at a time?!
    var clone = this.pendingDialogStack.slice();
    clone.forEach(function(dpi) {
      if (removed.indexOf(dpi.dialog) !== -1) {
        dpi.downgradeModal();
      } else {
        dpi.maybeHideModal();
      }
    });
  };

  /**
   * @param {!dialogPolyfillInfo} dpi
   * @return {boolean} whether the dialog was allowed
   */
  dialogPolyfill.DialogManager.prototype.pushDialog = function(dpi) {
    var allowed = (this.zIndexHigh_ - this.zIndexLow_) / 2 - 1;
    if (this.pendingDialogStack.length >= allowed) {
      return false;
    }
    if (this.pendingDialogStack.unshift(dpi) === 1) {
      this.blockDocument();
    }
    this.updateStacking();
    return true;
  };

  /**
   * @param {!dialogPolyfillInfo} dpi
   */
  dialogPolyfill.DialogManager.prototype.removeDialog = function(dpi) {
    var index = this.pendingDialogStack.indexOf(dpi);
    if (index === -1) { return; }

    this.pendingDialogStack.splice(index, 1);
    if (this.pendingDialogStack.length === 0) {
      this.unblockDocument();
    }
    this.updateStacking();
  };

  dialogPolyfill.dm = new dialogPolyfill.DialogManager();
  dialogPolyfill.formSubmitter = null;
  dialogPolyfill.useValue = null;

  /**
   * Installs global handlers, such as click listers and native method overrides. These are needed
   * even if a no dialog is registered, as they deal with <form method="dialog">.
   */
  if (window.HTMLDialogElement === undefined) {

    /**
     * If HTMLFormElement translates method="DIALOG" into 'get', then replace the descriptor with
     * one that returns the correct value.
     */
    var testForm = document.createElement('form');
    testForm.setAttribute('method', 'dialog');
    if (testForm.method !== 'dialog') {
      var methodDescriptor = Object.getOwnPropertyDescriptor(HTMLFormElement.prototype, 'method');
      if (methodDescriptor) {
        // TODO: older iOS and older PhantomJS fail to return the descriptor here
        var realGet = methodDescriptor.get;
        methodDescriptor.get = function() {
          if (isFormMethodDialog(this)) {
            return 'dialog';
          }
          return realGet.call(this);
        };
        var realSet = methodDescriptor.set;
        methodDescriptor.set = function(v) {
          if (typeof v === 'string' && v.toLowerCase() === 'dialog') {
            return this.setAttribute('method', v);
          }
          return realSet.call(this, v);
        };
        Object.defineProperty(HTMLFormElement.prototype, 'method', methodDescriptor);
      }
    }

    /**
     * Global 'click' handler, to capture the <input type="submit"> or <button> element which has
     * submitted a <form method="dialog">. Needed as Safari and others don't report this inside
     * document.activeElement.
     */
    document.addEventListener('click', function(ev) {
      dialogPolyfill.formSubmitter = null;
      dialogPolyfill.useValue = null;
      if (ev.defaultPrevented) { return; }  // e.g. a submit which prevents default submission

      var target = /** @type {Element} */ (ev.target);
      if (!target || !isFormMethodDialog(target.form)) { return; }

      var valid = (target.type === 'submit' && ['button', 'input'].indexOf(target.localName) > -1);
      if (!valid) {
        if (!(target.localName === 'input' && target.type === 'image')) { return; }
        // this is a <input type="image">, which can submit forms
        dialogPolyfill.useValue = ev.offsetX + ',' + ev.offsetY;
      }

      var dialog = findNearestDialog(target);
      if (!dialog) { return; }

      dialogPolyfill.formSubmitter = target;
    }, false);

    /**
     * Replace the native HTMLFormElement.submit() method, as it won't fire the
     * submit event and give us a chance to respond.
     */
    var nativeFormSubmit = HTMLFormElement.prototype.submit;
    function replacementFormSubmit() {
      if (!isFormMethodDialog(this)) {
        return nativeFormSubmit.call(this);
      }
      var dialog = findNearestDialog(this);
      dialog && dialog.close();
    }
    HTMLFormElement.prototype.submit = replacementFormSubmit;

    /**
     * Global form 'dialog' method handler. Closes a dialog correctly on submit
     * and possibly sets its return value.
     */
    document.addEventListener('submit', function(ev) {
      var form = /** @type {HTMLFormElement} */ (ev.target);
      if (!isFormMethodDialog(form)) { return; }
      ev.preventDefault();

      var dialog = findNearestDialog(form);
      if (!dialog) { return; }

      // Forms can only be submitted via .submit() or a click (?), but anyway: sanity-check that
      // the submitter is correct before using its value as .returnValue.
      var s = dialogPolyfill.formSubmitter;
      if (s && s.form === form) {
        dialog.close(dialogPolyfill.useValue || s.value);
      } else {
        dialog.close();
      }
      dialogPolyfill.formSubmitter = null;
    }, true);
  }

  dialogPolyfill['forceRegisterDialog'] = dialogPolyfill.forceRegisterDialog;
  dialogPolyfill['registerDialog'] = dialogPolyfill.registerDialog;

  if (typeof define === 'function' && 'amd' in define) {
    // AMD support
    define(function() { return dialogPolyfill; });
  } else if (typeof module === 'object' && typeof module['exports'] === 'object') {
    // CommonJS support
    module['exports'] = dialogPolyfill;
  } else {
    // all others
    window['dialogPolyfill'] = dialogPolyfill;
  }
})();

},{}],2:[function(require,module,exports){
'use strict';

var _dialogPolyfill = require('dialog-polyfill');

var _dialogPolyfill2 = _interopRequireDefault(_dialogPolyfill);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

var lang = document.querySelector('html').getAttribute('lang');
var isEnglish = lang === 'en';
var raf = window.requestAnimationFrame;

//////
// DIALOG
//////

//- dialog handling
//- window.confirm is raising warnings in chrome…
var dialog = document.querySelector('.js-dialog-confirm');
if (!dialog.showModal) {
  _dialogPolyfill2.default.registerDialog(dialog);
}
var title = dialog.querySelector('.js-dialog-title');
var description = dialog.querySelector('.js-dialog-description');
var confirmLink = dialog.querySelector('.js-dialog-confirm');
var cancelBtn = dialog.querySelector('.js-dialog-cancel');
cancelBtn.addEventListener('click', function (_) {
  return dialog.close();
});
dialog.addEventListener('cancel', function (_) {
  return resetDialog();
});
dialog.addEventListener('close', function (_) {
  return resetDialog();
});
function resetDialog() {
  title.textContent = '';
  description.textContent = '';
  confirmLink.setAttribute('href', '#');
  //- clone to remove all event listeners
  var confirmLinkClone = confirmLink.cloneNode(true);
  confirmLink.parentNode.replaceChild(confirmLinkClone, confirmLink);
  confirmLink = confirmLinkClone;
}
function openDialog(datas) {
  title.textContent = datas.title;
  description.textContent = datas.description;
  raf(function (_) {
    return dialog.showModal();
  });
}

//////
// TEMPLATES
//////

//----- delete

var deleteButtons = document.querySelectorAll('.js-delete-template');
addListeners(deleteButtons, 'click', askTemplateDeletion);
function askTemplateDeletion(e) {
  e.preventDefault();
  var link = e.currentTarget;
  var templateName = link.dataset.name;
  confirmLink.setAttribute('href', link.getAttribute('href'));
  openDialog({
    title: 'Delete template',
    description: 'are you sure you want to delete ' + templateName + '?'
  });
}

//----- handle notifications

var notification = document.querySelector('#notification');
if (notification) {
  window.setTimeout(function () {
    notification.classList.remove('mdl-snackbar--active');
  }, 2700);
}

//////
// USERS
//////

//----- RESET

var resetUsers = document.querySelectorAll('.js-reset-user');
addListeners(resetUsers, 'click', askUserReset);
function askUserReset(e) {
  e.preventDefault();
  var link = e.currentTarget;
  var userName = link.dataset.name;
  confirmLink.setAttribute('href', link.getAttribute('href'));
  openDialog({
    title: isEnglish ? 'Reset' : 'Réinitialiser',
    description: isEnglish ? 'are you sure you want to reset ' + userName + ' password?' : '\xEAtes vous s\xFBr de vouloir r\xE9initialiser le mot de passe de  ' + userName + ' ?'
  });
}

//----- ACTIVATE

var activateUsers = document.querySelectorAll('.js-user-activate');
addListeners(activateUsers, 'click', askUserActivation);
function askUserActivation(e) {
  e.preventDefault();
  var link = e.currentTarget;
  var userName = link.dataset.name;
  confirmLink.setAttribute('href', link.getAttribute('href'));
  openDialog({
    title: isEnglish ? 'Activate' : 'Activer',
    description: isEnglish ? 'are you sure you want to activate ' + userName + '?' : '\xEAtes vous s\xFBr de vouloir activer ' + userName + ' ?'
  });
}

//----- DEACTIVATE

var deactivateUsers = document.querySelectorAll('.js-user-deactivate');
addListeners(deactivateUsers, 'click', askUserDeactivation);
function askUserDeactivation(e) {
  e.preventDefault();
  var link = e.currentTarget;
  var userName = link.dataset.name;
  confirmLink.setAttribute('href', link.getAttribute('href'));
  openDialog({
    title: isEnglish ? 'Deactivate' : 'Désactiver',
    description: isEnglish ? 'are you sure you want to deactivate ' + userName + '?' : '\xEAtes vous s\xFBr de vouloir d\xE9sactiver ' + userName + ' ?'
  });
}

//////
// UTILS
//////

function addListeners(elems, eventName, callback) {
  if (!elems.length) return;[].concat(_toConsumableArray(elems)).forEach(function (elem) {
    return elem.addEventListener(eventName, callback);
  });
}

function getParent(elem, selector) {
  var parent = false;
  for (; elem && elem !== document; elem = elem.parentNode) {
    if (elem.matches(selector)) {
      parent = elem;
      break;
    }
  }
  return parent;
}

},{"dialog-polyfill":1}]},{},[2])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvZGlhbG9nLXBvbHlmaWxsL2RpYWxvZy1wb2x5ZmlsbC5qcyIsInNyYy9qcy1hZG1pbi1iYWNrZW5kL2luZGV4LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7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QUFwQjtBQUNBLE1BQU0sV0FBWSxLQUFLLE9BQUwsQ0FBYSxJQUEvQjtBQUNBLGNBQVksWUFBWixDQUEwQixNQUExQixFQUFrQyxLQUFLLFlBQUwsQ0FBa0IsTUFBbEIsQ0FBbEM7QUFDQSxhQUFZO0FBQ1YsV0FBYyxZQUFZLFlBQVosR0FBMkIsWUFEL0I7QUFFVixpQkFBYyxxREFBbUQsUUFBbkQsMkRBQXdHLFFBQXhHO0FBRkosR0FBWjtBQUlEOztBQUVEO0FBQ0E7QUFDQTs7QUFFQSxTQUFTLFlBQVQsQ0FBdUIsS0FBdkIsRUFBOEIsU0FBOUIsRUFBeUMsUUFBekMsRUFBb0Q7QUFDbEQsTUFBSSxDQUFDLE1BQU0sTUFBWCxFQUFtQixPQUNsQiw2QkFBSSxLQUFKLEdBQVcsT0FBWCxDQUFvQjtBQUFBLFdBQVEsS0FBSyxnQkFBTCxDQUF1QixTQUF2QixFQUFrQyxRQUFsQyxDQUFSO0FBQUEsR0FBcEI7QUFDRjs7QUFFRCxTQUFTLFNBQVQsQ0FBb0IsSUFBcEIsRUFBMEIsUUFBMUIsRUFBcUM7QUFDbkMsTUFBSSxTQUFTLEtBQWI7QUFDQSxTQUFRLFFBQVEsU0FBUyxRQUF6QixFQUFtQyxPQUFPLEtBQUssVUFBL0MsRUFBNEQ7QUFDMUQsUUFBSyxLQUFLLE9BQUwsQ0FBYyxRQUFkLENBQUwsRUFBZ0M7QUFDOUIsZUFBUyxJQUFUO0FBQ0E7QUFDRDtBQUNGO0FBQ0QsU0FBTyxNQUFQO0FBQ0QiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiKGZ1bmN0aW9uKCkge1xuXG4gIC8vIG5iLiBUaGlzIGlzIGZvciBJRTEwIGFuZCBsb3dlciBfb25seV8uXG4gIHZhciBzdXBwb3J0Q3VzdG9tRXZlbnQgPSB3aW5kb3cuQ3VzdG9tRXZlbnQ7XG4gIGlmICghc3VwcG9ydEN1c3RvbUV2ZW50IHx8IHR5cGVvZiBzdXBwb3J0Q3VzdG9tRXZlbnQgPT09ICdvYmplY3QnKSB7XG4gICAgc3VwcG9ydEN1c3RvbUV2ZW50ID0gZnVuY3Rpb24gQ3VzdG9tRXZlbnQoZXZlbnQsIHgpIHtcbiAgICAgIHggPSB4IHx8IHt9O1xuICAgICAgdmFyIGV2ID0gZG9jdW1lbnQuY3JlYXRlRXZlbnQoJ0N1c3RvbUV2ZW50Jyk7XG4gICAgICBldi5pbml0Q3VzdG9tRXZlbnQoZXZlbnQsICEheC5idWJibGVzLCAhIXguY2FuY2VsYWJsZSwgeC5kZXRhaWwgfHwgbnVsbCk7XG4gICAgICByZXR1cm4gZXY7XG4gICAgfTtcbiAgICBzdXBwb3J0Q3VzdG9tRXZlbnQucHJvdG90eXBlID0gd2luZG93LkV2ZW50LnByb3RvdHlwZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAcGFyYW0ge0VsZW1lbnR9IGVsIHRvIGNoZWNrIGZvciBzdGFja2luZyBjb250ZXh0XG4gICAqIEByZXR1cm4ge2Jvb2xlYW59IHdoZXRoZXIgdGhpcyBlbCBvciBpdHMgcGFyZW50cyBjcmVhdGVzIGEgc3RhY2tpbmcgY29udGV4dFxuICAgKi9cbiAgZnVuY3Rpb24gY3JlYXRlc1N0YWNraW5nQ29udGV4dChlbCkge1xuICAgIHdoaWxlIChlbCAmJiBlbCAhPT0gZG9jdW1lbnQuYm9keSkge1xuICAgICAgdmFyIHMgPSB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZShlbCk7XG4gICAgICB2YXIgaW52YWxpZCA9IGZ1bmN0aW9uKGssIG9rKSB7XG4gICAgICAgIHJldHVybiAhKHNba10gPT09IHVuZGVmaW5lZCB8fCBzW2tdID09PSBvayk7XG4gICAgICB9XG4gICAgICBpZiAocy5vcGFjaXR5IDwgMSB8fFxuICAgICAgICAgIGludmFsaWQoJ3pJbmRleCcsICdhdXRvJykgfHxcbiAgICAgICAgICBpbnZhbGlkKCd0cmFuc2Zvcm0nLCAnbm9uZScpIHx8XG4gICAgICAgICAgaW52YWxpZCgnbWl4QmxlbmRNb2RlJywgJ25vcm1hbCcpIHx8XG4gICAgICAgICAgaW52YWxpZCgnZmlsdGVyJywgJ25vbmUnKSB8fFxuICAgICAgICAgIGludmFsaWQoJ3BlcnNwZWN0aXZlJywgJ25vbmUnKSB8fFxuICAgICAgICAgIHNbJ2lzb2xhdGlvbiddID09PSAnaXNvbGF0ZScgfHxcbiAgICAgICAgICBzLnBvc2l0aW9uID09PSAnZml4ZWQnIHx8XG4gICAgICAgICAgcy53ZWJraXRPdmVyZmxvd1Njcm9sbGluZyA9PT0gJ3RvdWNoJykge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIGVsID0gZWwucGFyZW50RWxlbWVudDtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgLyoqXG4gICAqIEZpbmRzIHRoZSBuZWFyZXN0IDxkaWFsb2c+IGZyb20gdGhlIHBhc3NlZCBlbGVtZW50LlxuICAgKlxuICAgKiBAcGFyYW0ge0VsZW1lbnR9IGVsIHRvIHNlYXJjaCBmcm9tXG4gICAqIEByZXR1cm4ge0hUTUxEaWFsb2dFbGVtZW50fSBkaWFsb2cgZm91bmRcbiAgICovXG4gIGZ1bmN0aW9uIGZpbmROZWFyZXN0RGlhbG9nKGVsKSB7XG4gICAgd2hpbGUgKGVsKSB7XG4gICAgICBpZiAoZWwubG9jYWxOYW1lID09PSAnZGlhbG9nJykge1xuICAgICAgICByZXR1cm4gLyoqIEB0eXBlIHtIVE1MRGlhbG9nRWxlbWVudH0gKi8gKGVsKTtcbiAgICAgIH1cbiAgICAgIGVsID0gZWwucGFyZW50RWxlbWVudDtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICAvKipcbiAgICogQmx1ciB0aGUgc3BlY2lmaWVkIGVsZW1lbnQsIGFzIGxvbmcgYXMgaXQncyBub3QgdGhlIEhUTUwgYm9keSBlbGVtZW50LlxuICAgKiBUaGlzIHdvcmtzIGFyb3VuZCBhbiBJRTkvMTAgYnVnIC0gYmx1cnJpbmcgdGhlIGJvZHkgY2F1c2VzIFdpbmRvd3MgdG9cbiAgICogYmx1ciB0aGUgd2hvbGUgYXBwbGljYXRpb24uXG4gICAqXG4gICAqIEBwYXJhbSB7RWxlbWVudH0gZWwgdG8gYmx1clxuICAgKi9cbiAgZnVuY3Rpb24gc2FmZUJsdXIoZWwpIHtcbiAgICBpZiAoZWwgJiYgZWwuYmx1ciAmJiBlbCAhPT0gZG9jdW1lbnQuYm9keSkge1xuICAgICAgZWwuYmx1cigpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBAcGFyYW0geyFOb2RlTGlzdH0gbm9kZUxpc3QgdG8gc2VhcmNoXG4gICAqIEBwYXJhbSB7Tm9kZX0gbm9kZSB0byBmaW5kXG4gICAqIEByZXR1cm4ge2Jvb2xlYW59IHdoZXRoZXIgbm9kZSBpcyBpbnNpZGUgbm9kZUxpc3RcbiAgICovXG4gIGZ1bmN0aW9uIGluTm9kZUxpc3Qobm9kZUxpc3QsIG5vZGUpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IG5vZGVMaXN0Lmxlbmd0aDsgKytpKSB7XG4gICAgICBpZiAobm9kZUxpc3RbaV0gPT09IG5vZGUpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAcGFyYW0ge0hUTUxGb3JtRWxlbWVudH0gZWwgdG8gY2hlY2tcbiAgICogQHJldHVybiB7Ym9vbGVhbn0gd2hldGhlciB0aGlzIGZvcm0gaGFzIG1ldGhvZD1cImRpYWxvZ1wiXG4gICAqL1xuICBmdW5jdGlvbiBpc0Zvcm1NZXRob2REaWFsb2coZWwpIHtcbiAgICBpZiAoIWVsIHx8ICFlbC5oYXNBdHRyaWJ1dGUoJ21ldGhvZCcpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIHJldHVybiBlbC5nZXRBdHRyaWJ1dGUoJ21ldGhvZCcpLnRvTG93ZXJDYXNlKCkgPT09ICdkaWFsb2cnO1xuICB9XG5cbiAgLyoqXG4gICAqIEBwYXJhbSB7IUhUTUxEaWFsb2dFbGVtZW50fSBkaWFsb2cgdG8gdXBncmFkZVxuICAgKiBAY29uc3RydWN0b3JcbiAgICovXG4gIGZ1bmN0aW9uIGRpYWxvZ1BvbHlmaWxsSW5mbyhkaWFsb2cpIHtcbiAgICB0aGlzLmRpYWxvZ18gPSBkaWFsb2c7XG4gICAgdGhpcy5yZXBsYWNlZFN0eWxlVG9wXyA9IGZhbHNlO1xuICAgIHRoaXMub3BlbkFzTW9kYWxfID0gZmFsc2U7XG5cbiAgICAvLyBTZXQgYTExeSByb2xlLiBCcm93c2VycyB0aGF0IHN1cHBvcnQgZGlhbG9nIGltcGxpY2l0bHkga25vdyB0aGlzIGFscmVhZHkuXG4gICAgaWYgKCFkaWFsb2cuaGFzQXR0cmlidXRlKCdyb2xlJykpIHtcbiAgICAgIGRpYWxvZy5zZXRBdHRyaWJ1dGUoJ3JvbGUnLCAnZGlhbG9nJyk7XG4gICAgfVxuXG4gICAgZGlhbG9nLnNob3cgPSB0aGlzLnNob3cuYmluZCh0aGlzKTtcbiAgICBkaWFsb2cuc2hvd01vZGFsID0gdGhpcy5zaG93TW9kYWwuYmluZCh0aGlzKTtcbiAgICBkaWFsb2cuY2xvc2UgPSB0aGlzLmNsb3NlLmJpbmQodGhpcyk7XG5cbiAgICBpZiAoISgncmV0dXJuVmFsdWUnIGluIGRpYWxvZykpIHtcbiAgICAgIGRpYWxvZy5yZXR1cm5WYWx1ZSA9ICcnO1xuICAgIH1cblxuICAgIGlmICgnTXV0YXRpb25PYnNlcnZlcicgaW4gd2luZG93KSB7XG4gICAgICB2YXIgbW8gPSBuZXcgTXV0YXRpb25PYnNlcnZlcih0aGlzLm1heWJlSGlkZU1vZGFsLmJpbmQodGhpcykpO1xuICAgICAgbW8ub2JzZXJ2ZShkaWFsb2csIHthdHRyaWJ1dGVzOiB0cnVlLCBhdHRyaWJ1dGVGaWx0ZXI6IFsnb3BlbiddfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIElFMTAgYW5kIGJlbG93IHN1cHBvcnQuIE5vdGUgdGhhdCBET01Ob2RlUmVtb3ZlZCBldGMgZmlyZSBfYmVmb3JlXyByZW1vdmFsLiBUaGV5IGFsc29cbiAgICAgIC8vIHNlZW0gdG8gZmlyZSBldmVuIGlmIHRoZSBlbGVtZW50IHdhcyByZW1vdmVkIGFzIHBhcnQgb2YgYSBwYXJlbnQgcmVtb3ZhbC4gVXNlIHRoZSByZW1vdmVkXG4gICAgICAvLyBldmVudHMgdG8gZm9yY2UgZG93bmdyYWRlICh1c2VmdWwgaWYgcmVtb3ZlZC9pbW1lZGlhdGVseSBhZGRlZCkuXG4gICAgICB2YXIgcmVtb3ZlZCA9IGZhbHNlO1xuICAgICAgdmFyIGNiID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJlbW92ZWQgPyB0aGlzLmRvd25ncmFkZU1vZGFsKCkgOiB0aGlzLm1heWJlSGlkZU1vZGFsKCk7XG4gICAgICAgIHJlbW92ZWQgPSBmYWxzZTtcbiAgICAgIH0uYmluZCh0aGlzKTtcbiAgICAgIHZhciB0aW1lb3V0O1xuICAgICAgdmFyIGRlbGF5TW9kZWwgPSBmdW5jdGlvbihldikge1xuICAgICAgICBpZiAoZXYudGFyZ2V0ICE9PSBkaWFsb2cpIHsgcmV0dXJuOyB9ICAvLyBub3QgZm9yIGEgY2hpbGQgZWxlbWVudFxuICAgICAgICB2YXIgY2FuZCA9ICdET01Ob2RlUmVtb3ZlZCc7XG4gICAgICAgIHJlbW92ZWQgfD0gKGV2LnR5cGUuc3Vic3RyKDAsIGNhbmQubGVuZ3RoKSA9PT0gY2FuZCk7XG4gICAgICAgIHdpbmRvdy5jbGVhclRpbWVvdXQodGltZW91dCk7XG4gICAgICAgIHRpbWVvdXQgPSB3aW5kb3cuc2V0VGltZW91dChjYiwgMCk7XG4gICAgICB9O1xuICAgICAgWydET01BdHRyTW9kaWZpZWQnLCAnRE9NTm9kZVJlbW92ZWQnLCAnRE9NTm9kZVJlbW92ZWRGcm9tRG9jdW1lbnQnXS5mb3JFYWNoKGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgICAgZGlhbG9nLmFkZEV2ZW50TGlzdGVuZXIobmFtZSwgZGVsYXlNb2RlbCk7XG4gICAgICB9KTtcbiAgICB9XG4gICAgLy8gTm90ZSB0aGF0IHRoZSBET00gaXMgb2JzZXJ2ZWQgaW5zaWRlIERpYWxvZ01hbmFnZXIgd2hpbGUgYW55IGRpYWxvZ1xuICAgIC8vIGlzIGJlaW5nIGRpc3BsYXllZCBhcyBhIG1vZGFsLCB0byBjYXRjaCBtb2RhbCByZW1vdmFsIGZyb20gdGhlIERPTS5cblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShkaWFsb2csICdvcGVuJywge1xuICAgICAgc2V0OiB0aGlzLnNldE9wZW4uYmluZCh0aGlzKSxcbiAgICAgIGdldDogZGlhbG9nLmhhc0F0dHJpYnV0ZS5iaW5kKGRpYWxvZywgJ29wZW4nKVxuICAgIH0pO1xuXG4gICAgdGhpcy5iYWNrZHJvcF8gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICB0aGlzLmJhY2tkcm9wXy5jbGFzc05hbWUgPSAnYmFja2Ryb3AnO1xuICAgIHRoaXMuYmFja2Ryb3BfLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgdGhpcy5iYWNrZHJvcENsaWNrXy5iaW5kKHRoaXMpKTtcbiAgfVxuXG4gIGRpYWxvZ1BvbHlmaWxsSW5mby5wcm90b3R5cGUgPSB7XG5cbiAgICBnZXQgZGlhbG9nKCkge1xuICAgICAgcmV0dXJuIHRoaXMuZGlhbG9nXztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogTWF5YmUgcmVtb3ZlIHRoaXMgZGlhbG9nIGZyb20gdGhlIG1vZGFsIHRvcCBsYXllci4gVGhpcyBpcyBjYWxsZWQgd2hlblxuICAgICAqIGEgbW9kYWwgZGlhbG9nIG1heSBubyBsb25nZXIgYmUgdGVuYWJsZSwgZS5nLiwgd2hlbiB0aGUgZGlhbG9nIGlzIG5vXG4gICAgICogbG9uZ2VyIG9wZW4gb3IgaXMgbm8gbG9uZ2VyIHBhcnQgb2YgdGhlIERPTS5cbiAgICAgKi9cbiAgICBtYXliZUhpZGVNb2RhbDogZnVuY3Rpb24oKSB7XG4gICAgICBpZiAodGhpcy5kaWFsb2dfLmhhc0F0dHJpYnV0ZSgnb3BlbicpICYmIGRvY3VtZW50LmJvZHkuY29udGFpbnModGhpcy5kaWFsb2dfKSkgeyByZXR1cm47IH1cbiAgICAgIHRoaXMuZG93bmdyYWRlTW9kYWwoKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlIHRoaXMgZGlhbG9nIGZyb20gdGhlIG1vZGFsIHRvcCBsYXllciwgbGVhdmluZyBpdCBhcyBhIG5vbi1tb2RhbC5cbiAgICAgKi9cbiAgICBkb3duZ3JhZGVNb2RhbDogZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoIXRoaXMub3BlbkFzTW9kYWxfKSB7IHJldHVybjsgfVxuICAgICAgdGhpcy5vcGVuQXNNb2RhbF8gPSBmYWxzZTtcbiAgICAgIHRoaXMuZGlhbG9nXy5zdHlsZS56SW5kZXggPSAnJztcblxuICAgICAgLy8gVGhpcyB3b24ndCBtYXRjaCB0aGUgbmF0aXZlIDxkaWFsb2c+IGV4YWN0bHkgYmVjYXVzZSBpZiB0aGUgdXNlciBzZXQgdG9wIG9uIGEgY2VudGVyZWRcbiAgICAgIC8vIHBvbHlmaWxsIGRpYWxvZywgdGhhdCB0b3AgZ2V0cyB0aHJvd24gYXdheSB3aGVuIHRoZSBkaWFsb2cgaXMgY2xvc2VkLiBOb3Qgc3VyZSBpdCdzXG4gICAgICAvLyBwb3NzaWJsZSB0byBwb2x5ZmlsbCB0aGlzIHBlcmZlY3RseS5cbiAgICAgIGlmICh0aGlzLnJlcGxhY2VkU3R5bGVUb3BfKSB7XG4gICAgICAgIHRoaXMuZGlhbG9nXy5zdHlsZS50b3AgPSAnJztcbiAgICAgICAgdGhpcy5yZXBsYWNlZFN0eWxlVG9wXyA9IGZhbHNlO1xuICAgICAgfVxuXG4gICAgICAvLyBDbGVhciB0aGUgYmFja2Ryb3AgYW5kIHJlbW92ZSBmcm9tIHRoZSBtYW5hZ2VyLlxuICAgICAgdGhpcy5iYWNrZHJvcF8ucGFyZW50Tm9kZSAmJiB0aGlzLmJhY2tkcm9wXy5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKHRoaXMuYmFja2Ryb3BfKTtcbiAgICAgIGRpYWxvZ1BvbHlmaWxsLmRtLnJlbW92ZURpYWxvZyh0aGlzKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtib29sZWFufSB2YWx1ZSB3aGV0aGVyIHRvIG9wZW4gb3IgY2xvc2UgdGhpcyBkaWFsb2dcbiAgICAgKi9cbiAgICBzZXRPcGVuOiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgaWYgKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuZGlhbG9nXy5oYXNBdHRyaWJ1dGUoJ29wZW4nKSB8fCB0aGlzLmRpYWxvZ18uc2V0QXR0cmlidXRlKCdvcGVuJywgJycpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5kaWFsb2dfLnJlbW92ZUF0dHJpYnV0ZSgnb3BlbicpO1xuICAgICAgICB0aGlzLm1heWJlSGlkZU1vZGFsKCk7ICAvLyBuYi4gcmVkdW5kYW50IHdpdGggTXV0YXRpb25PYnNlcnZlclxuICAgICAgfVxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBIYW5kbGVzIGNsaWNrcyBvbiB0aGUgZmFrZSAuYmFja2Ryb3AgZWxlbWVudCwgcmVkaXJlY3RpbmcgdGhlbSBhcyBpZlxuICAgICAqIHRoZXkgd2VyZSBvbiB0aGUgZGlhbG9nIGl0c2VsZi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7IUV2ZW50fSBlIHRvIHJlZGlyZWN0XG4gICAgICovXG4gICAgYmFja2Ryb3BDbGlja186IGZ1bmN0aW9uKGUpIHtcbiAgICAgIGlmICghdGhpcy5kaWFsb2dfLmhhc0F0dHJpYnV0ZSgndGFiaW5kZXgnKSkge1xuICAgICAgICAvLyBDbGlja2luZyBvbiB0aGUgYmFja2Ryb3Agc2hvdWxkIG1vdmUgdGhlIGltcGxpY2l0IGN1cnNvciwgZXZlbiBpZiBkaWFsb2cgY2Fubm90IGJlXG4gICAgICAgIC8vIGZvY3VzZWQuIENyZWF0ZSBhIGZha2UgdGhpbmcgdG8gZm9jdXMgb24uIElmIHRoZSBiYWNrZHJvcCB3YXMgX2JlZm9yZV8gdGhlIGRpYWxvZywgdGhpc1xuICAgICAgICAvLyB3b3VsZCBub3QgYmUgbmVlZGVkIC0gY2xpY2tzIHdvdWxkIG1vdmUgdGhlIGltcGxpY2l0IGN1cnNvciB0aGVyZS5cbiAgICAgICAgdmFyIGZha2UgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgICAgdGhpcy5kaWFsb2dfLmluc2VydEJlZm9yZShmYWtlLCB0aGlzLmRpYWxvZ18uZmlyc3RDaGlsZCk7XG4gICAgICAgIGZha2UudGFiSW5kZXggPSAtMTtcbiAgICAgICAgZmFrZS5mb2N1cygpO1xuICAgICAgICB0aGlzLmRpYWxvZ18ucmVtb3ZlQ2hpbGQoZmFrZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmRpYWxvZ18uZm9jdXMoKTtcbiAgICAgIH1cblxuICAgICAgdmFyIHJlZGlyZWN0ZWRFdmVudCA9IGRvY3VtZW50LmNyZWF0ZUV2ZW50KCdNb3VzZUV2ZW50cycpO1xuICAgICAgcmVkaXJlY3RlZEV2ZW50LmluaXRNb3VzZUV2ZW50KGUudHlwZSwgZS5idWJibGVzLCBlLmNhbmNlbGFibGUsIHdpbmRvdyxcbiAgICAgICAgICBlLmRldGFpbCwgZS5zY3JlZW5YLCBlLnNjcmVlblksIGUuY2xpZW50WCwgZS5jbGllbnRZLCBlLmN0cmxLZXksXG4gICAgICAgICAgZS5hbHRLZXksIGUuc2hpZnRLZXksIGUubWV0YUtleSwgZS5idXR0b24sIGUucmVsYXRlZFRhcmdldCk7XG4gICAgICB0aGlzLmRpYWxvZ18uZGlzcGF0Y2hFdmVudChyZWRpcmVjdGVkRXZlbnQpO1xuICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogRm9jdXNlcyBvbiB0aGUgZmlyc3QgZm9jdXNhYmxlIGVsZW1lbnQgd2l0aGluIHRoZSBkaWFsb2cuIFRoaXMgd2lsbCBhbHdheXMgYmx1ciB0aGUgY3VycmVudFxuICAgICAqIGZvY3VzLCBldmVuIGlmIG5vdGhpbmcgd2l0aGluIHRoZSBkaWFsb2cgaXMgZm91bmQuXG4gICAgICovXG4gICAgZm9jdXNfOiBmdW5jdGlvbigpIHtcbiAgICAgIC8vIEZpbmQgZWxlbWVudCB3aXRoIGBhdXRvZm9jdXNgIGF0dHJpYnV0ZSwgb3IgZmFsbCBiYWNrIHRvIHRoZSBmaXJzdCBmb3JtL3RhYmluZGV4IGNvbnRyb2wuXG4gICAgICB2YXIgdGFyZ2V0ID0gdGhpcy5kaWFsb2dfLnF1ZXJ5U2VsZWN0b3IoJ1thdXRvZm9jdXNdOm5vdChbZGlzYWJsZWRdKScpO1xuICAgICAgaWYgKCF0YXJnZXQgJiYgdGhpcy5kaWFsb2dfLnRhYkluZGV4ID49IDApIHtcbiAgICAgICAgdGFyZ2V0ID0gdGhpcy5kaWFsb2dfO1xuICAgICAgfVxuICAgICAgaWYgKCF0YXJnZXQpIHtcbiAgICAgICAgLy8gTm90ZSB0aGF0IHRoaXMgaXMgJ2FueSBmb2N1c2FibGUgYXJlYScuIFRoaXMgbGlzdCBpcyBwcm9iYWJseSBub3QgZXhoYXVzdGl2ZSwgYnV0IHRoZVxuICAgICAgICAvLyBhbHRlcm5hdGl2ZSBpbnZvbHZlcyBzdGVwcGluZyB0aHJvdWdoIGFuZCB0cnlpbmcgdG8gZm9jdXMgZXZlcnl0aGluZy5cbiAgICAgICAgdmFyIG9wdHMgPSBbJ2J1dHRvbicsICdpbnB1dCcsICdrZXlnZW4nLCAnc2VsZWN0JywgJ3RleHRhcmVhJ107XG4gICAgICAgIHZhciBxdWVyeSA9IG9wdHMubWFwKGZ1bmN0aW9uKGVsKSB7XG4gICAgICAgICAgcmV0dXJuIGVsICsgJzpub3QoW2Rpc2FibGVkXSknO1xuICAgICAgICB9KTtcbiAgICAgICAgLy8gVE9ETyhzYW10aG9yKTogdGFiaW5kZXggdmFsdWVzIHRoYXQgYXJlIG5vdCBudW1lcmljIGFyZSBub3QgZm9jdXNhYmxlLlxuICAgICAgICBxdWVyeS5wdXNoKCdbdGFiaW5kZXhdOm5vdChbZGlzYWJsZWRdKTpub3QoW3RhYmluZGV4PVwiXCJdKScpOyAgLy8gdGFiaW5kZXggIT0gXCJcIiwgbm90IGRpc2FibGVkXG4gICAgICAgIHRhcmdldCA9IHRoaXMuZGlhbG9nXy5xdWVyeVNlbGVjdG9yKHF1ZXJ5LmpvaW4oJywgJykpO1xuICAgICAgfVxuICAgICAgc2FmZUJsdXIoZG9jdW1lbnQuYWN0aXZlRWxlbWVudCk7XG4gICAgICB0YXJnZXQgJiYgdGFyZ2V0LmZvY3VzKCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIHpJbmRleCBmb3IgdGhlIGJhY2tkcm9wIGFuZCBkaWFsb2cuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gZGlhbG9nWlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBiYWNrZHJvcFpcbiAgICAgKi9cbiAgICB1cGRhdGVaSW5kZXg6IGZ1bmN0aW9uKGRpYWxvZ1osIGJhY2tkcm9wWikge1xuICAgICAgaWYgKGRpYWxvZ1ogPCBiYWNrZHJvcFopIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdkaWFsb2daIHNob3VsZCBuZXZlciBiZSA8IGJhY2tkcm9wWicpO1xuICAgICAgfVxuICAgICAgdGhpcy5kaWFsb2dfLnN0eWxlLnpJbmRleCA9IGRpYWxvZ1o7XG4gICAgICB0aGlzLmJhY2tkcm9wXy5zdHlsZS56SW5kZXggPSBiYWNrZHJvcFo7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFNob3dzIHRoZSBkaWFsb2cuIElmIHRoZSBkaWFsb2cgaXMgYWxyZWFkeSBvcGVuLCB0aGlzIGRvZXMgbm90aGluZy5cbiAgICAgKi9cbiAgICBzaG93OiBmdW5jdGlvbigpIHtcbiAgICAgIGlmICghdGhpcy5kaWFsb2dfLm9wZW4pIHtcbiAgICAgICAgdGhpcy5zZXRPcGVuKHRydWUpO1xuICAgICAgICB0aGlzLmZvY3VzXygpO1xuICAgICAgfVxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBTaG93IHRoaXMgZGlhbG9nIG1vZGFsbHkuXG4gICAgICovXG4gICAgc2hvd01vZGFsOiBmdW5jdGlvbigpIHtcbiAgICAgIGlmICh0aGlzLmRpYWxvZ18uaGFzQXR0cmlidXRlKCdvcGVuJykpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdGYWlsZWQgdG8gZXhlY3V0ZSBcXCdzaG93TW9kYWxcXCcgb24gZGlhbG9nOiBUaGUgZWxlbWVudCBpcyBhbHJlYWR5IG9wZW4sIGFuZCB0aGVyZWZvcmUgY2Fubm90IGJlIG9wZW5lZCBtb2RhbGx5LicpO1xuICAgICAgfVxuICAgICAgaWYgKCFkb2N1bWVudC5ib2R5LmNvbnRhaW5zKHRoaXMuZGlhbG9nXykpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdGYWlsZWQgdG8gZXhlY3V0ZSBcXCdzaG93TW9kYWxcXCcgb24gZGlhbG9nOiBUaGUgZWxlbWVudCBpcyBub3QgaW4gYSBEb2N1bWVudC4nKTtcbiAgICAgIH1cbiAgICAgIGlmICghZGlhbG9nUG9seWZpbGwuZG0ucHVzaERpYWxvZyh0aGlzKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZhaWxlZCB0byBleGVjdXRlIFxcJ3Nob3dNb2RhbFxcJyBvbiBkaWFsb2c6IFRoZXJlIGFyZSB0b28gbWFueSBvcGVuIG1vZGFsIGRpYWxvZ3MuJyk7XG4gICAgICB9XG5cbiAgICAgIGlmIChjcmVhdGVzU3RhY2tpbmdDb250ZXh0KHRoaXMuZGlhbG9nXy5wYXJlbnRFbGVtZW50KSkge1xuICAgICAgICBjb25zb2xlLndhcm4oJ0EgZGlhbG9nIGlzIGJlaW5nIHNob3duIGluc2lkZSBhIHN0YWNraW5nIGNvbnRleHQuICcgK1xuICAgICAgICAgICAgJ1RoaXMgbWF5IGNhdXNlIGl0IHRvIGJlIHVudXNhYmxlLiBGb3IgbW9yZSBpbmZvcm1hdGlvbiwgc2VlIHRoaXMgbGluazogJyArXG4gICAgICAgICAgICAnaHR0cHM6Ly9naXRodWIuY29tL0dvb2dsZUNocm9tZS9kaWFsb2ctcG9seWZpbGwvI3N0YWNraW5nLWNvbnRleHQnKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5zZXRPcGVuKHRydWUpO1xuICAgICAgdGhpcy5vcGVuQXNNb2RhbF8gPSB0cnVlO1xuXG4gICAgICAvLyBPcHRpb25hbGx5IGNlbnRlciB2ZXJ0aWNhbGx5LCByZWxhdGl2ZSB0byB0aGUgY3VycmVudCB2aWV3cG9ydC5cbiAgICAgIGlmIChkaWFsb2dQb2x5ZmlsbC5uZWVkc0NlbnRlcmluZyh0aGlzLmRpYWxvZ18pKSB7XG4gICAgICAgIGRpYWxvZ1BvbHlmaWxsLnJlcG9zaXRpb24odGhpcy5kaWFsb2dfKTtcbiAgICAgICAgdGhpcy5yZXBsYWNlZFN0eWxlVG9wXyA9IHRydWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnJlcGxhY2VkU3R5bGVUb3BfID0gZmFsc2U7XG4gICAgICB9XG5cbiAgICAgIC8vIEluc2VydCBiYWNrZHJvcC5cbiAgICAgIHRoaXMuZGlhbG9nXy5wYXJlbnROb2RlLmluc2VydEJlZm9yZSh0aGlzLmJhY2tkcm9wXywgdGhpcy5kaWFsb2dfLm5leHRTaWJsaW5nKTtcblxuICAgICAgLy8gRm9jdXMgb24gd2hhdGV2ZXIgaW5zaWRlIHRoZSBkaWFsb2cuXG4gICAgICB0aGlzLmZvY3VzXygpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBDbG9zZXMgdGhpcyBIVE1MRGlhbG9nRWxlbWVudC4gVGhpcyBpcyBvcHRpb25hbCB2cyBjbGVhcmluZyB0aGUgb3BlblxuICAgICAqIGF0dHJpYnV0ZSwgaG93ZXZlciB0aGlzIGZpcmVzIGEgJ2Nsb3NlJyBldmVudC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nPX0gb3B0X3JldHVyblZhbHVlIHRvIHVzZSBhcyB0aGUgcmV0dXJuVmFsdWVcbiAgICAgKi9cbiAgICBjbG9zZTogZnVuY3Rpb24ob3B0X3JldHVyblZhbHVlKSB7XG4gICAgICBpZiAoIXRoaXMuZGlhbG9nXy5oYXNBdHRyaWJ1dGUoJ29wZW4nKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZhaWxlZCB0byBleGVjdXRlIFxcJ2Nsb3NlXFwnIG9uIGRpYWxvZzogVGhlIGVsZW1lbnQgZG9lcyBub3QgaGF2ZSBhbiBcXCdvcGVuXFwnIGF0dHJpYnV0ZSwgYW5kIHRoZXJlZm9yZSBjYW5ub3QgYmUgY2xvc2VkLicpO1xuICAgICAgfVxuICAgICAgdGhpcy5zZXRPcGVuKGZhbHNlKTtcblxuICAgICAgLy8gTGVhdmUgcmV0dXJuVmFsdWUgdW50b3VjaGVkIGluIGNhc2UgaXQgd2FzIHNldCBkaXJlY3RseSBvbiB0aGUgZWxlbWVudFxuICAgICAgaWYgKG9wdF9yZXR1cm5WYWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHRoaXMuZGlhbG9nXy5yZXR1cm5WYWx1ZSA9IG9wdF9yZXR1cm5WYWx1ZTtcbiAgICAgIH1cblxuICAgICAgLy8gVHJpZ2dlcmluZyBcImNsb3NlXCIgZXZlbnQgZm9yIGFueSBhdHRhY2hlZCBsaXN0ZW5lcnMgb24gdGhlIDxkaWFsb2c+LlxuICAgICAgdmFyIGNsb3NlRXZlbnQgPSBuZXcgc3VwcG9ydEN1c3RvbUV2ZW50KCdjbG9zZScsIHtcbiAgICAgICAgYnViYmxlczogZmFsc2UsXG4gICAgICAgIGNhbmNlbGFibGU6IGZhbHNlXG4gICAgICB9KTtcbiAgICAgIHRoaXMuZGlhbG9nXy5kaXNwYXRjaEV2ZW50KGNsb3NlRXZlbnQpO1xuICAgIH1cblxuICB9O1xuXG4gIHZhciBkaWFsb2dQb2x5ZmlsbCA9IHt9O1xuXG4gIGRpYWxvZ1BvbHlmaWxsLnJlcG9zaXRpb24gPSBmdW5jdGlvbihlbGVtZW50KSB7XG4gICAgdmFyIHNjcm9sbFRvcCA9IGRvY3VtZW50LmJvZHkuc2Nyb2xsVG9wIHx8IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zY3JvbGxUb3A7XG4gICAgdmFyIHRvcFZhbHVlID0gc2Nyb2xsVG9wICsgKHdpbmRvdy5pbm5lckhlaWdodCAtIGVsZW1lbnQub2Zmc2V0SGVpZ2h0KSAvIDI7XG4gICAgZWxlbWVudC5zdHlsZS50b3AgPSBNYXRoLm1heChzY3JvbGxUb3AsIHRvcFZhbHVlKSArICdweCc7XG4gIH07XG5cbiAgZGlhbG9nUG9seWZpbGwuaXNJbmxpbmVQb3NpdGlvblNldEJ5U3R5bGVzaGVldCA9IGZ1bmN0aW9uKGVsZW1lbnQpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGRvY3VtZW50LnN0eWxlU2hlZXRzLmxlbmd0aDsgKytpKSB7XG4gICAgICB2YXIgc3R5bGVTaGVldCA9IGRvY3VtZW50LnN0eWxlU2hlZXRzW2ldO1xuICAgICAgdmFyIGNzc1J1bGVzID0gbnVsbDtcbiAgICAgIC8vIFNvbWUgYnJvd3NlcnMgdGhyb3cgb24gY3NzUnVsZXMuXG4gICAgICB0cnkge1xuICAgICAgICBjc3NSdWxlcyA9IHN0eWxlU2hlZXQuY3NzUnVsZXM7XG4gICAgICB9IGNhdGNoIChlKSB7fVxuICAgICAgaWYgKCFjc3NSdWxlcykgeyBjb250aW51ZTsgfVxuICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBjc3NSdWxlcy5sZW5ndGg7ICsraikge1xuICAgICAgICB2YXIgcnVsZSA9IGNzc1J1bGVzW2pdO1xuICAgICAgICB2YXIgc2VsZWN0ZWROb2RlcyA9IG51bGw7XG4gICAgICAgIC8vIElnbm9yZSBlcnJvcnMgb24gaW52YWxpZCBzZWxlY3RvciB0ZXh0cy5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBzZWxlY3RlZE5vZGVzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChydWxlLnNlbGVjdG9yVGV4dCk7XG4gICAgICAgIH0gY2F0Y2goZSkge31cbiAgICAgICAgaWYgKCFzZWxlY3RlZE5vZGVzIHx8ICFpbk5vZGVMaXN0KHNlbGVjdGVkTm9kZXMsIGVsZW1lbnQpKSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIGNzc1RvcCA9IHJ1bGUuc3R5bGUuZ2V0UHJvcGVydHlWYWx1ZSgndG9wJyk7XG4gICAgICAgIHZhciBjc3NCb3R0b20gPSBydWxlLnN0eWxlLmdldFByb3BlcnR5VmFsdWUoJ2JvdHRvbScpO1xuICAgICAgICBpZiAoKGNzc1RvcCAmJiBjc3NUb3AgIT09ICdhdXRvJykgfHwgKGNzc0JvdHRvbSAmJiBjc3NCb3R0b20gIT09ICdhdXRvJykpIHtcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH07XG5cbiAgZGlhbG9nUG9seWZpbGwubmVlZHNDZW50ZXJpbmcgPSBmdW5jdGlvbihkaWFsb2cpIHtcbiAgICB2YXIgY29tcHV0ZWRTdHlsZSA9IHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKGRpYWxvZyk7XG4gICAgaWYgKGNvbXB1dGVkU3R5bGUucG9zaXRpb24gIT09ICdhYnNvbHV0ZScpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBXZSBtdXN0IGRldGVybWluZSB3aGV0aGVyIHRoZSB0b3AvYm90dG9tIHNwZWNpZmllZCB2YWx1ZSBpcyBub24tYXV0by4gIEluXG4gICAgLy8gV2ViS2l0L0JsaW5rLCBjaGVja2luZyBjb21wdXRlZFN0eWxlLnRvcCA9PSAnYXV0bycgaXMgc3VmZmljaWVudCwgYnV0XG4gICAgLy8gRmlyZWZveCByZXR1cm5zIHRoZSB1c2VkIHZhbHVlLiBTbyB3ZSBkbyB0aGlzIGNyYXp5IHRoaW5nIGluc3RlYWQ6IGNoZWNrXG4gICAgLy8gdGhlIGlubGluZSBzdHlsZSBhbmQgdGhlbiBnbyB0aHJvdWdoIENTUyBydWxlcy5cbiAgICBpZiAoKGRpYWxvZy5zdHlsZS50b3AgIT09ICdhdXRvJyAmJiBkaWFsb2cuc3R5bGUudG9wICE9PSAnJykgfHxcbiAgICAgICAgKGRpYWxvZy5zdHlsZS5ib3R0b20gIT09ICdhdXRvJyAmJiBkaWFsb2cuc3R5bGUuYm90dG9tICE9PSAnJykpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgcmV0dXJuICFkaWFsb2dQb2x5ZmlsbC5pc0lubGluZVBvc2l0aW9uU2V0QnlTdHlsZXNoZWV0KGRpYWxvZyk7XG4gIH07XG5cbiAgLyoqXG4gICAqIEBwYXJhbSB7IUVsZW1lbnR9IGVsZW1lbnQgdG8gZm9yY2UgdXBncmFkZVxuICAgKi9cbiAgZGlhbG9nUG9seWZpbGwuZm9yY2VSZWdpc3RlckRpYWxvZyA9IGZ1bmN0aW9uKGVsZW1lbnQpIHtcbiAgICBpZiAod2luZG93LkhUTUxEaWFsb2dFbGVtZW50IHx8IGVsZW1lbnQuc2hvd01vZGFsKSB7XG4gICAgICBjb25zb2xlLndhcm4oJ1RoaXMgYnJvd3NlciBhbHJlYWR5IHN1cHBvcnRzIDxkaWFsb2c+LCB0aGUgcG9seWZpbGwgJyArXG4gICAgICAgICAgJ21heSBub3Qgd29yayBjb3JyZWN0bHknLCBlbGVtZW50KTtcbiAgICB9XG4gICAgaWYgKGVsZW1lbnQubG9jYWxOYW1lICE9PSAnZGlhbG9nJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdGYWlsZWQgdG8gcmVnaXN0ZXIgZGlhbG9nOiBUaGUgZWxlbWVudCBpcyBub3QgYSBkaWFsb2cuJyk7XG4gICAgfVxuICAgIG5ldyBkaWFsb2dQb2x5ZmlsbEluZm8oLyoqIEB0eXBlIHshSFRNTERpYWxvZ0VsZW1lbnR9ICovIChlbGVtZW50KSk7XG4gIH07XG5cbiAgLyoqXG4gICAqIEBwYXJhbSB7IUVsZW1lbnR9IGVsZW1lbnQgdG8gdXBncmFkZSwgaWYgbmVjZXNzYXJ5XG4gICAqL1xuICBkaWFsb2dQb2x5ZmlsbC5yZWdpc3RlckRpYWxvZyA9IGZ1bmN0aW9uKGVsZW1lbnQpIHtcbiAgICBpZiAoIWVsZW1lbnQuc2hvd01vZGFsKSB7XG4gICAgICBkaWFsb2dQb2x5ZmlsbC5mb3JjZVJlZ2lzdGVyRGlhbG9nKGVsZW1lbnQpO1xuICAgIH1cbiAgfTtcblxuICAvKipcbiAgICogQGNvbnN0cnVjdG9yXG4gICAqL1xuICBkaWFsb2dQb2x5ZmlsbC5EaWFsb2dNYW5hZ2VyID0gZnVuY3Rpb24oKSB7XG4gICAgLyoqIEB0eXBlIHshQXJyYXk8IWRpYWxvZ1BvbHlmaWxsSW5mbz59ICovXG4gICAgdGhpcy5wZW5kaW5nRGlhbG9nU3RhY2sgPSBbXTtcblxuICAgIHZhciBjaGVja0RPTSA9IHRoaXMuY2hlY2tET01fLmJpbmQodGhpcyk7XG5cbiAgICAvLyBUaGUgb3ZlcmxheSBpcyB1c2VkIHRvIHNpbXVsYXRlIGhvdyBhIG1vZGFsIGRpYWxvZyBibG9ja3MgdGhlIGRvY3VtZW50LlxuICAgIC8vIFRoZSBibG9ja2luZyBkaWFsb2cgaXMgcG9zaXRpb25lZCBvbiB0b3Agb2YgdGhlIG92ZXJsYXksIGFuZCB0aGUgcmVzdCBvZlxuICAgIC8vIHRoZSBkaWFsb2dzIG9uIHRoZSBwZW5kaW5nIGRpYWxvZyBzdGFjayBhcmUgcG9zaXRpb25lZCBiZWxvdyBpdC4gSW4gdGhlXG4gICAgLy8gYWN0dWFsIGltcGxlbWVudGF0aW9uLCB0aGUgbW9kYWwgZGlhbG9nIHN0YWNraW5nIGlzIGNvbnRyb2xsZWQgYnkgdGhlXG4gICAgLy8gdG9wIGxheWVyLCB3aGVyZSB6LWluZGV4IGhhcyBubyBlZmZlY3QuXG4gICAgdGhpcy5vdmVybGF5ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgdGhpcy5vdmVybGF5LmNsYXNzTmFtZSA9ICdfZGlhbG9nX292ZXJsYXknO1xuICAgIHRoaXMub3ZlcmxheS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGZ1bmN0aW9uKGUpIHtcbiAgICAgIHRoaXMuZm9yd2FyZFRhYl8gPSB1bmRlZmluZWQ7XG4gICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgY2hlY2tET00oW10pOyAgLy8gc2FuaXR5LWNoZWNrIERPTVxuICAgIH0uYmluZCh0aGlzKSk7XG5cbiAgICB0aGlzLmhhbmRsZUtleV8gPSB0aGlzLmhhbmRsZUtleV8uYmluZCh0aGlzKTtcbiAgICB0aGlzLmhhbmRsZUZvY3VzXyA9IHRoaXMuaGFuZGxlRm9jdXNfLmJpbmQodGhpcyk7XG5cbiAgICB0aGlzLnpJbmRleExvd18gPSAxMDAwMDA7XG4gICAgdGhpcy56SW5kZXhIaWdoXyA9IDEwMDAwMCArIDE1MDtcblxuICAgIHRoaXMuZm9yd2FyZFRhYl8gPSB1bmRlZmluZWQ7XG5cbiAgICBpZiAoJ011dGF0aW9uT2JzZXJ2ZXInIGluIHdpbmRvdykge1xuICAgICAgdGhpcy5tb18gPSBuZXcgTXV0YXRpb25PYnNlcnZlcihmdW5jdGlvbihyZWNvcmRzKSB7XG4gICAgICAgIHZhciByZW1vdmVkID0gW107XG4gICAgICAgIHJlY29yZHMuZm9yRWFjaChmdW5jdGlvbihyZWMpIHtcbiAgICAgICAgICBmb3IgKHZhciBpID0gMCwgYzsgYyA9IHJlYy5yZW1vdmVkTm9kZXNbaV07ICsraSkge1xuICAgICAgICAgICAgaWYgKCEoYyBpbnN0YW5jZW9mIEVsZW1lbnQpKSB7XG4gICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChjLmxvY2FsTmFtZSA9PT0gJ2RpYWxvZycpIHtcbiAgICAgICAgICAgICAgcmVtb3ZlZC5wdXNoKGMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmVtb3ZlZCA9IHJlbW92ZWQuY29uY2F0KGMucXVlcnlTZWxlY3RvckFsbCgnZGlhbG9nJykpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHJlbW92ZWQubGVuZ3RoICYmIGNoZWNrRE9NKHJlbW92ZWQpO1xuICAgICAgfSk7XG4gICAgfVxuICB9O1xuXG4gIC8qKlxuICAgKiBDYWxsZWQgb24gdGhlIGZpcnN0IG1vZGFsIGRpYWxvZyBiZWluZyBzaG93bi4gQWRkcyB0aGUgb3ZlcmxheSBhbmQgcmVsYXRlZFxuICAgKiBoYW5kbGVycy5cbiAgICovXG4gIGRpYWxvZ1BvbHlmaWxsLkRpYWxvZ01hbmFnZXIucHJvdG90eXBlLmJsb2NrRG9jdW1lbnQgPSBmdW5jdGlvbigpIHtcbiAgICBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignZm9jdXMnLCB0aGlzLmhhbmRsZUZvY3VzXywgdHJ1ZSk7XG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIHRoaXMuaGFuZGxlS2V5Xyk7XG4gICAgdGhpcy5tb18gJiYgdGhpcy5tb18ub2JzZXJ2ZShkb2N1bWVudCwge2NoaWxkTGlzdDogdHJ1ZSwgc3VidHJlZTogdHJ1ZX0pO1xuICB9O1xuXG4gIC8qKlxuICAgKiBDYWxsZWQgb24gdGhlIGZpcnN0IG1vZGFsIGRpYWxvZyBiZWluZyByZW1vdmVkLCBpLmUuLCB3aGVuIG5vIG1vcmUgbW9kYWxcbiAgICogZGlhbG9ncyBhcmUgdmlzaWJsZS5cbiAgICovXG4gIGRpYWxvZ1BvbHlmaWxsLkRpYWxvZ01hbmFnZXIucHJvdG90eXBlLnVuYmxvY2tEb2N1bWVudCA9IGZ1bmN0aW9uKCkge1xuICAgIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdmb2N1cycsIHRoaXMuaGFuZGxlRm9jdXNfLCB0cnVlKTtcbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdrZXlkb3duJywgdGhpcy5oYW5kbGVLZXlfKTtcbiAgICB0aGlzLm1vXyAmJiB0aGlzLm1vXy5kaXNjb25uZWN0KCk7XG4gIH07XG5cbiAgLyoqXG4gICAqIFVwZGF0ZXMgdGhlIHN0YWNraW5nIG9mIGFsbCBrbm93biBkaWFsb2dzLlxuICAgKi9cbiAgZGlhbG9nUG9seWZpbGwuRGlhbG9nTWFuYWdlci5wcm90b3R5cGUudXBkYXRlU3RhY2tpbmcgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgekluZGV4ID0gdGhpcy56SW5kZXhIaWdoXztcblxuICAgIGZvciAodmFyIGkgPSAwLCBkcGk7IGRwaSA9IHRoaXMucGVuZGluZ0RpYWxvZ1N0YWNrW2ldOyArK2kpIHtcbiAgICAgIGRwaS51cGRhdGVaSW5kZXgoLS16SW5kZXgsIC0tekluZGV4KTtcbiAgICAgIGlmIChpID09PSAwKSB7XG4gICAgICAgIHRoaXMub3ZlcmxheS5zdHlsZS56SW5kZXggPSAtLXpJbmRleDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBNYWtlIHRoZSBvdmVybGF5IGEgc2libGluZyBvZiB0aGUgZGlhbG9nIGl0c2VsZi5cbiAgICB2YXIgbGFzdCA9IHRoaXMucGVuZGluZ0RpYWxvZ1N0YWNrWzBdO1xuICAgIGlmIChsYXN0KSB7XG4gICAgICB2YXIgcCA9IGxhc3QuZGlhbG9nLnBhcmVudE5vZGUgfHwgZG9jdW1lbnQuYm9keTtcbiAgICAgIHAuYXBwZW5kQ2hpbGQodGhpcy5vdmVybGF5KTtcbiAgICB9IGVsc2UgaWYgKHRoaXMub3ZlcmxheS5wYXJlbnROb2RlKSB7XG4gICAgICB0aGlzLm92ZXJsYXkucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCh0aGlzLm92ZXJsYXkpO1xuICAgIH1cbiAgfTtcblxuICAvKipcbiAgICogQHBhcmFtIHtFbGVtZW50fSBjYW5kaWRhdGUgdG8gY2hlY2sgaWYgY29udGFpbmVkIG9yIGlzIHRoZSB0b3AtbW9zdCBtb2RhbCBkaWFsb2dcbiAgICogQHJldHVybiB7Ym9vbGVhbn0gd2hldGhlciBjYW5kaWRhdGUgaXMgY29udGFpbmVkIGluIHRvcCBkaWFsb2dcbiAgICovXG4gIGRpYWxvZ1BvbHlmaWxsLkRpYWxvZ01hbmFnZXIucHJvdG90eXBlLmNvbnRhaW5lZEJ5VG9wRGlhbG9nXyA9IGZ1bmN0aW9uKGNhbmRpZGF0ZSkge1xuICAgIHdoaWxlIChjYW5kaWRhdGUgPSBmaW5kTmVhcmVzdERpYWxvZyhjYW5kaWRhdGUpKSB7XG4gICAgICBmb3IgKHZhciBpID0gMCwgZHBpOyBkcGkgPSB0aGlzLnBlbmRpbmdEaWFsb2dTdGFja1tpXTsgKytpKSB7XG4gICAgICAgIGlmIChkcGkuZGlhbG9nID09PSBjYW5kaWRhdGUpIHtcbiAgICAgICAgICByZXR1cm4gaSA9PT0gMDsgIC8vIG9ubHkgdmFsaWQgaWYgdG9wLW1vc3RcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgY2FuZGlkYXRlID0gY2FuZGlkYXRlLnBhcmVudEVsZW1lbnQ7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfTtcblxuICBkaWFsb2dQb2x5ZmlsbC5EaWFsb2dNYW5hZ2VyLnByb3RvdHlwZS5oYW5kbGVGb2N1c18gPSBmdW5jdGlvbihldmVudCkge1xuICAgIGlmICh0aGlzLmNvbnRhaW5lZEJ5VG9wRGlhbG9nXyhldmVudC50YXJnZXQpKSB7IHJldHVybjsgfVxuXG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICBzYWZlQmx1cigvKiogQHR5cGUge0VsZW1lbnR9ICovIChldmVudC50YXJnZXQpKTtcblxuICAgIGlmICh0aGlzLmZvcndhcmRUYWJfID09PSB1bmRlZmluZWQpIHsgcmV0dXJuOyB9ICAvLyBtb3ZlIGZvY3VzIG9ubHkgZnJvbSBhIHRhYiBrZXlcblxuICAgIHZhciBkcGkgPSB0aGlzLnBlbmRpbmdEaWFsb2dTdGFja1swXTtcbiAgICB2YXIgZGlhbG9nID0gZHBpLmRpYWxvZztcbiAgICB2YXIgcG9zaXRpb24gPSBkaWFsb2cuY29tcGFyZURvY3VtZW50UG9zaXRpb24oZXZlbnQudGFyZ2V0KTtcbiAgICBpZiAocG9zaXRpb24gJiBOb2RlLkRPQ1VNRU5UX1BPU0lUSU9OX1BSRUNFRElORykge1xuICAgICAgaWYgKHRoaXMuZm9yd2FyZFRhYl8pIHsgIC8vIGZvcndhcmRcbiAgICAgICAgZHBpLmZvY3VzXygpO1xuICAgICAgfSBlbHNlIHsgIC8vIGJhY2t3YXJkc1xuICAgICAgICBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuZm9jdXMoKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLy8gVE9ETzogRm9jdXMgYWZ0ZXIgdGhlIGRpYWxvZywgaXMgaWdub3JlZC5cbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG4gIH07XG5cbiAgZGlhbG9nUG9seWZpbGwuRGlhbG9nTWFuYWdlci5wcm90b3R5cGUuaGFuZGxlS2V5XyA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgdGhpcy5mb3J3YXJkVGFiXyA9IHVuZGVmaW5lZDtcbiAgICBpZiAoZXZlbnQua2V5Q29kZSA9PT0gMjcpIHtcbiAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgIHZhciBjYW5jZWxFdmVudCA9IG5ldyBzdXBwb3J0Q3VzdG9tRXZlbnQoJ2NhbmNlbCcsIHtcbiAgICAgICAgYnViYmxlczogZmFsc2UsXG4gICAgICAgIGNhbmNlbGFibGU6IHRydWVcbiAgICAgIH0pO1xuICAgICAgdmFyIGRwaSA9IHRoaXMucGVuZGluZ0RpYWxvZ1N0YWNrWzBdO1xuICAgICAgaWYgKGRwaSAmJiBkcGkuZGlhbG9nLmRpc3BhdGNoRXZlbnQoY2FuY2VsRXZlbnQpKSB7XG4gICAgICAgIGRwaS5kaWFsb2cuY2xvc2UoKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGV2ZW50LmtleUNvZGUgPT09IDkpIHtcbiAgICAgIHRoaXMuZm9yd2FyZFRhYl8gPSAhZXZlbnQuc2hpZnRLZXk7XG4gICAgfVxuICB9O1xuXG4gIC8qKlxuICAgKiBGaW5kcyBhbmQgZG93bmdyYWRlcyBhbnkga25vd24gbW9kYWwgZGlhbG9ncyB0aGF0IGFyZSBubyBsb25nZXIgZGlzcGxheWVkLiBEaWFsb2dzIHRoYXQgYXJlXG4gICAqIHJlbW92ZWQgYW5kIGltbWVkaWF0ZWx5IHJlYWRkZWQgZG9uJ3Qgc3RheSBtb2RhbCwgdGhleSBiZWNvbWUgbm9ybWFsLlxuICAgKlxuICAgKiBAcGFyYW0geyFBcnJheTwhSFRNTERpYWxvZ0VsZW1lbnQ+fSByZW1vdmVkIHRoYXQgaGF2ZSBkZWZpbml0ZWx5IGJlZW4gcmVtb3ZlZFxuICAgKi9cbiAgZGlhbG9nUG9seWZpbGwuRGlhbG9nTWFuYWdlci5wcm90b3R5cGUuY2hlY2tET01fID0gZnVuY3Rpb24ocmVtb3ZlZCkge1xuICAgIC8vIFRoaXMgb3BlcmF0ZXMgb24gYSBjbG9uZSBiZWNhdXNlIGl0IG1heSBjYXVzZSBpdCB0byBjaGFuZ2UuIEVhY2ggY2hhbmdlIGFsc28gY2FsbHNcbiAgICAvLyB1cGRhdGVTdGFja2luZywgd2hpY2ggb25seSBhY3R1YWxseSBuZWVkcyB0byBoYXBwZW4gb25jZS4gQnV0IHdobyByZW1vdmVzIG1hbnkgbW9kYWwgZGlhbG9nc1xuICAgIC8vIGF0IGEgdGltZT8hXG4gICAgdmFyIGNsb25lID0gdGhpcy5wZW5kaW5nRGlhbG9nU3RhY2suc2xpY2UoKTtcbiAgICBjbG9uZS5mb3JFYWNoKGZ1bmN0aW9uKGRwaSkge1xuICAgICAgaWYgKHJlbW92ZWQuaW5kZXhPZihkcGkuZGlhbG9nKSAhPT0gLTEpIHtcbiAgICAgICAgZHBpLmRvd25ncmFkZU1vZGFsKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBkcGkubWF5YmVIaWRlTW9kYWwoKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfTtcblxuICAvKipcbiAgICogQHBhcmFtIHshZGlhbG9nUG9seWZpbGxJbmZvfSBkcGlcbiAgICogQHJldHVybiB7Ym9vbGVhbn0gd2hldGhlciB0aGUgZGlhbG9nIHdhcyBhbGxvd2VkXG4gICAqL1xuICBkaWFsb2dQb2x5ZmlsbC5EaWFsb2dNYW5hZ2VyLnByb3RvdHlwZS5wdXNoRGlhbG9nID0gZnVuY3Rpb24oZHBpKSB7XG4gICAgdmFyIGFsbG93ZWQgPSAodGhpcy56SW5kZXhIaWdoXyAtIHRoaXMuekluZGV4TG93XykgLyAyIC0gMTtcbiAgICBpZiAodGhpcy5wZW5kaW5nRGlhbG9nU3RhY2subGVuZ3RoID49IGFsbG93ZWQpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgaWYgKHRoaXMucGVuZGluZ0RpYWxvZ1N0YWNrLnVuc2hpZnQoZHBpKSA9PT0gMSkge1xuICAgICAgdGhpcy5ibG9ja0RvY3VtZW50KCk7XG4gICAgfVxuICAgIHRoaXMudXBkYXRlU3RhY2tpbmcoKTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcblxuICAvKipcbiAgICogQHBhcmFtIHshZGlhbG9nUG9seWZpbGxJbmZvfSBkcGlcbiAgICovXG4gIGRpYWxvZ1BvbHlmaWxsLkRpYWxvZ01hbmFnZXIucHJvdG90eXBlLnJlbW92ZURpYWxvZyA9IGZ1bmN0aW9uKGRwaSkge1xuICAgIHZhciBpbmRleCA9IHRoaXMucGVuZGluZ0RpYWxvZ1N0YWNrLmluZGV4T2YoZHBpKTtcbiAgICBpZiAoaW5kZXggPT09IC0xKSB7IHJldHVybjsgfVxuXG4gICAgdGhpcy5wZW5kaW5nRGlhbG9nU3RhY2suc3BsaWNlKGluZGV4LCAxKTtcbiAgICBpZiAodGhpcy5wZW5kaW5nRGlhbG9nU3RhY2subGVuZ3RoID09PSAwKSB7XG4gICAgICB0aGlzLnVuYmxvY2tEb2N1bWVudCgpO1xuICAgIH1cbiAgICB0aGlzLnVwZGF0ZVN0YWNraW5nKCk7XG4gIH07XG5cbiAgZGlhbG9nUG9seWZpbGwuZG0gPSBuZXcgZGlhbG9nUG9seWZpbGwuRGlhbG9nTWFuYWdlcigpO1xuICBkaWFsb2dQb2x5ZmlsbC5mb3JtU3VibWl0dGVyID0gbnVsbDtcbiAgZGlhbG9nUG9seWZpbGwudXNlVmFsdWUgPSBudWxsO1xuXG4gIC8qKlxuICAgKiBJbnN0YWxscyBnbG9iYWwgaGFuZGxlcnMsIHN1Y2ggYXMgY2xpY2sgbGlzdGVycyBhbmQgbmF0aXZlIG1ldGhvZCBvdmVycmlkZXMuIFRoZXNlIGFyZSBuZWVkZWRcbiAgICogZXZlbiBpZiBhIG5vIGRpYWxvZyBpcyByZWdpc3RlcmVkLCBhcyB0aGV5IGRlYWwgd2l0aCA8Zm9ybSBtZXRob2Q9XCJkaWFsb2dcIj4uXG4gICAqL1xuICBpZiAod2luZG93LkhUTUxEaWFsb2dFbGVtZW50ID09PSB1bmRlZmluZWQpIHtcblxuICAgIC8qKlxuICAgICAqIElmIEhUTUxGb3JtRWxlbWVudCB0cmFuc2xhdGVzIG1ldGhvZD1cIkRJQUxPR1wiIGludG8gJ2dldCcsIHRoZW4gcmVwbGFjZSB0aGUgZGVzY3JpcHRvciB3aXRoXG4gICAgICogb25lIHRoYXQgcmV0dXJucyB0aGUgY29ycmVjdCB2YWx1ZS5cbiAgICAgKi9cbiAgICB2YXIgdGVzdEZvcm0gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdmb3JtJyk7XG4gICAgdGVzdEZvcm0uc2V0QXR0cmlidXRlKCdtZXRob2QnLCAnZGlhbG9nJyk7XG4gICAgaWYgKHRlc3RGb3JtLm1ldGhvZCAhPT0gJ2RpYWxvZycpIHtcbiAgICAgIHZhciBtZXRob2REZXNjcmlwdG9yID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihIVE1MRm9ybUVsZW1lbnQucHJvdG90eXBlLCAnbWV0aG9kJyk7XG4gICAgICBpZiAobWV0aG9kRGVzY3JpcHRvcikge1xuICAgICAgICAvLyBUT0RPOiBvbGRlciBpT1MgYW5kIG9sZGVyIFBoYW50b21KUyBmYWlsIHRvIHJldHVybiB0aGUgZGVzY3JpcHRvciBoZXJlXG4gICAgICAgIHZhciByZWFsR2V0ID0gbWV0aG9kRGVzY3JpcHRvci5nZXQ7XG4gICAgICAgIG1ldGhvZERlc2NyaXB0b3IuZ2V0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgaWYgKGlzRm9ybU1ldGhvZERpYWxvZyh0aGlzKSkge1xuICAgICAgICAgICAgcmV0dXJuICdkaWFsb2cnO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gcmVhbEdldC5jYWxsKHRoaXMpO1xuICAgICAgICB9O1xuICAgICAgICB2YXIgcmVhbFNldCA9IG1ldGhvZERlc2NyaXB0b3Iuc2V0O1xuICAgICAgICBtZXRob2REZXNjcmlwdG9yLnNldCA9IGZ1bmN0aW9uKHYpIHtcbiAgICAgICAgICBpZiAodHlwZW9mIHYgPT09ICdzdHJpbmcnICYmIHYudG9Mb3dlckNhc2UoKSA9PT0gJ2RpYWxvZycpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnNldEF0dHJpYnV0ZSgnbWV0aG9kJywgdik7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiByZWFsU2V0LmNhbGwodGhpcywgdik7XG4gICAgICAgIH07XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShIVE1MRm9ybUVsZW1lbnQucHJvdG90eXBlLCAnbWV0aG9kJywgbWV0aG9kRGVzY3JpcHRvcik7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2xvYmFsICdjbGljaycgaGFuZGxlciwgdG8gY2FwdHVyZSB0aGUgPGlucHV0IHR5cGU9XCJzdWJtaXRcIj4gb3IgPGJ1dHRvbj4gZWxlbWVudCB3aGljaCBoYXNcbiAgICAgKiBzdWJtaXR0ZWQgYSA8Zm9ybSBtZXRob2Q9XCJkaWFsb2dcIj4uIE5lZWRlZCBhcyBTYWZhcmkgYW5kIG90aGVycyBkb24ndCByZXBvcnQgdGhpcyBpbnNpZGVcbiAgICAgKiBkb2N1bWVudC5hY3RpdmVFbGVtZW50LlxuICAgICAqL1xuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZnVuY3Rpb24oZXYpIHtcbiAgICAgIGRpYWxvZ1BvbHlmaWxsLmZvcm1TdWJtaXR0ZXIgPSBudWxsO1xuICAgICAgZGlhbG9nUG9seWZpbGwudXNlVmFsdWUgPSBudWxsO1xuICAgICAgaWYgKGV2LmRlZmF1bHRQcmV2ZW50ZWQpIHsgcmV0dXJuOyB9ICAvLyBlLmcuIGEgc3VibWl0IHdoaWNoIHByZXZlbnRzIGRlZmF1bHQgc3VibWlzc2lvblxuXG4gICAgICB2YXIgdGFyZ2V0ID0gLyoqIEB0eXBlIHtFbGVtZW50fSAqLyAoZXYudGFyZ2V0KTtcbiAgICAgIGlmICghdGFyZ2V0IHx8ICFpc0Zvcm1NZXRob2REaWFsb2codGFyZ2V0LmZvcm0pKSB7IHJldHVybjsgfVxuXG4gICAgICB2YXIgdmFsaWQgPSAodGFyZ2V0LnR5cGUgPT09ICdzdWJtaXQnICYmIFsnYnV0dG9uJywgJ2lucHV0J10uaW5kZXhPZih0YXJnZXQubG9jYWxOYW1lKSA+IC0xKTtcbiAgICAgIGlmICghdmFsaWQpIHtcbiAgICAgICAgaWYgKCEodGFyZ2V0LmxvY2FsTmFtZSA9PT0gJ2lucHV0JyAmJiB0YXJnZXQudHlwZSA9PT0gJ2ltYWdlJykpIHsgcmV0dXJuOyB9XG4gICAgICAgIC8vIHRoaXMgaXMgYSA8aW5wdXQgdHlwZT1cImltYWdlXCI+LCB3aGljaCBjYW4gc3VibWl0IGZvcm1zXG4gICAgICAgIGRpYWxvZ1BvbHlmaWxsLnVzZVZhbHVlID0gZXYub2Zmc2V0WCArICcsJyArIGV2Lm9mZnNldFk7XG4gICAgICB9XG5cbiAgICAgIHZhciBkaWFsb2cgPSBmaW5kTmVhcmVzdERpYWxvZyh0YXJnZXQpO1xuICAgICAgaWYgKCFkaWFsb2cpIHsgcmV0dXJuOyB9XG5cbiAgICAgIGRpYWxvZ1BvbHlmaWxsLmZvcm1TdWJtaXR0ZXIgPSB0YXJnZXQ7XG4gICAgfSwgZmFsc2UpO1xuXG4gICAgLyoqXG4gICAgICogUmVwbGFjZSB0aGUgbmF0aXZlIEhUTUxGb3JtRWxlbWVudC5zdWJtaXQoKSBtZXRob2QsIGFzIGl0IHdvbid0IGZpcmUgdGhlXG4gICAgICogc3VibWl0IGV2ZW50IGFuZCBnaXZlIHVzIGEgY2hhbmNlIHRvIHJlc3BvbmQuXG4gICAgICovXG4gICAgdmFyIG5hdGl2ZUZvcm1TdWJtaXQgPSBIVE1MRm9ybUVsZW1lbnQucHJvdG90eXBlLnN1Ym1pdDtcbiAgICBmdW5jdGlvbiByZXBsYWNlbWVudEZvcm1TdWJtaXQoKSB7XG4gICAgICBpZiAoIWlzRm9ybU1ldGhvZERpYWxvZyh0aGlzKSkge1xuICAgICAgICByZXR1cm4gbmF0aXZlRm9ybVN1Ym1pdC5jYWxsKHRoaXMpO1xuICAgICAgfVxuICAgICAgdmFyIGRpYWxvZyA9IGZpbmROZWFyZXN0RGlhbG9nKHRoaXMpO1xuICAgICAgZGlhbG9nICYmIGRpYWxvZy5jbG9zZSgpO1xuICAgIH1cbiAgICBIVE1MRm9ybUVsZW1lbnQucHJvdG90eXBlLnN1Ym1pdCA9IHJlcGxhY2VtZW50Rm9ybVN1Ym1pdDtcblxuICAgIC8qKlxuICAgICAqIEdsb2JhbCBmb3JtICdkaWFsb2cnIG1ldGhvZCBoYW5kbGVyLiBDbG9zZXMgYSBkaWFsb2cgY29ycmVjdGx5IG9uIHN1Ym1pdFxuICAgICAqIGFuZCBwb3NzaWJseSBzZXRzIGl0cyByZXR1cm4gdmFsdWUuXG4gICAgICovXG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignc3VibWl0JywgZnVuY3Rpb24oZXYpIHtcbiAgICAgIHZhciBmb3JtID0gLyoqIEB0eXBlIHtIVE1MRm9ybUVsZW1lbnR9ICovIChldi50YXJnZXQpO1xuICAgICAgaWYgKCFpc0Zvcm1NZXRob2REaWFsb2coZm9ybSkpIHsgcmV0dXJuOyB9XG4gICAgICBldi5wcmV2ZW50RGVmYXVsdCgpO1xuXG4gICAgICB2YXIgZGlhbG9nID0gZmluZE5lYXJlc3REaWFsb2coZm9ybSk7XG4gICAgICBpZiAoIWRpYWxvZykgeyByZXR1cm47IH1cblxuICAgICAgLy8gRm9ybXMgY2FuIG9ubHkgYmUgc3VibWl0dGVkIHZpYSAuc3VibWl0KCkgb3IgYSBjbGljayAoPyksIGJ1dCBhbnl3YXk6IHNhbml0eS1jaGVjayB0aGF0XG4gICAgICAvLyB0aGUgc3VibWl0dGVyIGlzIGNvcnJlY3QgYmVmb3JlIHVzaW5nIGl0cyB2YWx1ZSBhcyAucmV0dXJuVmFsdWUuXG4gICAgICB2YXIgcyA9IGRpYWxvZ1BvbHlmaWxsLmZvcm1TdWJtaXR0ZXI7XG4gICAgICBpZiAocyAmJiBzLmZvcm0gPT09IGZvcm0pIHtcbiAgICAgICAgZGlhbG9nLmNsb3NlKGRpYWxvZ1BvbHlmaWxsLnVzZVZhbHVlIHx8IHMudmFsdWUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZGlhbG9nLmNsb3NlKCk7XG4gICAgICB9XG4gICAgICBkaWFsb2dQb2x5ZmlsbC5mb3JtU3VibWl0dGVyID0gbnVsbDtcbiAgICB9LCB0cnVlKTtcbiAgfVxuXG4gIGRpYWxvZ1BvbHlmaWxsWydmb3JjZVJlZ2lzdGVyRGlhbG9nJ10gPSBkaWFsb2dQb2x5ZmlsbC5mb3JjZVJlZ2lzdGVyRGlhbG9nO1xuICBkaWFsb2dQb2x5ZmlsbFsncmVnaXN0ZXJEaWFsb2cnXSA9IGRpYWxvZ1BvbHlmaWxsLnJlZ2lzdGVyRGlhbG9nO1xuXG4gIGlmICh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmICdhbWQnIGluIGRlZmluZSkge1xuICAgIC8vIEFNRCBzdXBwb3J0XG4gICAgZGVmaW5lKGZ1bmN0aW9uKCkgeyByZXR1cm4gZGlhbG9nUG9seWZpbGw7IH0pO1xuICB9IGVsc2UgaWYgKHR5cGVvZiBtb2R1bGUgPT09ICdvYmplY3QnICYmIHR5cGVvZiBtb2R1bGVbJ2V4cG9ydHMnXSA9PT0gJ29iamVjdCcpIHtcbiAgICAvLyBDb21tb25KUyBzdXBwb3J0XG4gICAgbW9kdWxlWydleHBvcnRzJ10gPSBkaWFsb2dQb2x5ZmlsbDtcbiAgfSBlbHNlIHtcbiAgICAvLyBhbGwgb3RoZXJzXG4gICAgd2luZG93WydkaWFsb2dQb2x5ZmlsbCddID0gZGlhbG9nUG9seWZpbGw7XG4gIH1cbn0pKCk7XG4iLCJpbXBvcnQgZGlhbG9nUG9seWZpbGwgZnJvbSAnZGlhbG9nLXBvbHlmaWxsJ1xuXG5jb25zdCBsYW5nICAgICAgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdodG1sJykuZ2V0QXR0cmlidXRlKCdsYW5nJylcbmNvbnN0IGlzRW5nbGlzaCA9IGxhbmcgPT09ICdlbidcbmNvbnN0IHJhZiAgICAgICA9IHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWVcblxuLy8vLy8vXG4vLyBESUFMT0dcbi8vLy8vL1xuXG4vLy0gZGlhbG9nIGhhbmRsaW5nXG4vLy0gd2luZG93LmNvbmZpcm0gaXMgcmFpc2luZyB3YXJuaW5ncyBpbiBjaHJvbWXigKZcbmNvbnN0IGRpYWxvZyAgICAgID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLmpzLWRpYWxvZy1jb25maXJtJylcbmlmICghZGlhbG9nLnNob3dNb2RhbCkge1xuICBkaWFsb2dQb2x5ZmlsbC5yZWdpc3RlckRpYWxvZyhkaWFsb2cpXG59XG5jb25zdCB0aXRsZSAgICAgICA9IGRpYWxvZy5xdWVyeVNlbGVjdG9yKCcuanMtZGlhbG9nLXRpdGxlJylcbmNvbnN0IGRlc2NyaXB0aW9uID0gZGlhbG9nLnF1ZXJ5U2VsZWN0b3IoJy5qcy1kaWFsb2ctZGVzY3JpcHRpb24nKVxubGV0IGNvbmZpcm1MaW5rICAgPSBkaWFsb2cucXVlcnlTZWxlY3RvcignLmpzLWRpYWxvZy1jb25maXJtJylcbmNvbnN0IGNhbmNlbEJ0biAgID0gZGlhbG9nLnF1ZXJ5U2VsZWN0b3IoJy5qcy1kaWFsb2ctY2FuY2VsJylcbmNhbmNlbEJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIF8gPT4gZGlhbG9nLmNsb3NlKCkgKVxuZGlhbG9nLmFkZEV2ZW50TGlzdGVuZXIoJ2NhbmNlbCcsIF8gPT4gcmVzZXREaWFsb2coKSApXG5kaWFsb2cuYWRkRXZlbnRMaXN0ZW5lcignY2xvc2UnLCAgXyA9PiByZXNldERpYWxvZygpIClcbmZ1bmN0aW9uIHJlc2V0RGlhbG9nKCkge1xuICB0aXRsZS50ZXh0Q29udGVudCAgICAgICA9ICcnXG4gIGRlc2NyaXB0aW9uLnRleHRDb250ZW50ID0gJydcbiAgY29uZmlybUxpbmsuc2V0QXR0cmlidXRlKCdocmVmJywgJyMnKVxuICAvLy0gY2xvbmUgdG8gcmVtb3ZlIGFsbCBldmVudCBsaXN0ZW5lcnNcbiAgY29uc3QgY29uZmlybUxpbmtDbG9uZSAgPSBjb25maXJtTGluay5jbG9uZU5vZGUodHJ1ZSlcbiAgY29uZmlybUxpbmsucGFyZW50Tm9kZS5yZXBsYWNlQ2hpbGQoY29uZmlybUxpbmtDbG9uZSwgY29uZmlybUxpbmspXG4gIGNvbmZpcm1MaW5rICAgICAgICAgICAgID0gY29uZmlybUxpbmtDbG9uZVxufVxuZnVuY3Rpb24gb3BlbkRpYWxvZyggZGF0YXMgKSB7XG4gIHRpdGxlLnRleHRDb250ZW50ICAgICAgID0gZGF0YXMudGl0bGVcbiAgZGVzY3JpcHRpb24udGV4dENvbnRlbnQgPSBkYXRhcy5kZXNjcmlwdGlvblxuICByYWYoIF8gPT4gZGlhbG9nLnNob3dNb2RhbCgpIClcbn1cblxuLy8vLy8vXG4vLyBURU1QTEFURVNcbi8vLy8vL1xuXG4vLy0tLS0tIGRlbGV0ZVxuXG5jb25zdCBkZWxldGVCdXR0b25zID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnLmpzLWRlbGV0ZS10ZW1wbGF0ZScpXG5hZGRMaXN0ZW5lcnMoZGVsZXRlQnV0dG9ucywgJ2NsaWNrJywgYXNrVGVtcGxhdGVEZWxldGlvbilcbmZ1bmN0aW9uIGFza1RlbXBsYXRlRGVsZXRpb24oZSkge1xuICBlLnByZXZlbnREZWZhdWx0KClcbiAgY29uc3QgbGluayAgICAgICAgID0gZS5jdXJyZW50VGFyZ2V0XG4gIGNvbnN0IHRlbXBsYXRlTmFtZSA9IGxpbmsuZGF0YXNldC5uYW1lXG4gIGNvbmZpcm1MaW5rLnNldEF0dHJpYnV0ZSggJ2hyZWYnLCBsaW5rLmdldEF0dHJpYnV0ZSgnaHJlZicpIClcbiAgb3BlbkRpYWxvZygge1xuICAgIHRpdGxlOiAgICAgICAgJ0RlbGV0ZSB0ZW1wbGF0ZScsXG4gICAgZGVzY3JpcHRpb246ICBgYXJlIHlvdSBzdXJlIHlvdSB3YW50IHRvIGRlbGV0ZSAke3RlbXBsYXRlTmFtZX0/YCxcbiAgfSApXG59XG5cbi8vLS0tLS0gaGFuZGxlIG5vdGlmaWNhdGlvbnNcblxuY29uc3Qgbm90aWZpY2F0aW9uID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI25vdGlmaWNhdGlvbicpXG5pZiAobm90aWZpY2F0aW9uKSB7XG4gIHdpbmRvdy5zZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcbiAgICBub3RpZmljYXRpb24uY2xhc3NMaXN0LnJlbW92ZSgnbWRsLXNuYWNrYmFyLS1hY3RpdmUnKVxuICB9LCAyNzAwKVxufVxuXG4vLy8vLy9cbi8vIFVTRVJTXG4vLy8vLy9cblxuLy8tLS0tLSBSRVNFVFxuXG5jb25zdCByZXNldFVzZXJzICA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5qcy1yZXNldC11c2VyJylcbmFkZExpc3RlbmVycyhyZXNldFVzZXJzLCAnY2xpY2snLCBhc2tVc2VyUmVzZXQpXG5mdW5jdGlvbiBhc2tVc2VyUmVzZXQoZSkge1xuICBlLnByZXZlbnREZWZhdWx0KClcbiAgY29uc3QgbGluayAgICAgID0gZS5jdXJyZW50VGFyZ2V0XG4gIGNvbnN0IHVzZXJOYW1lICA9IGxpbmsuZGF0YXNldC5uYW1lXG4gIGNvbmZpcm1MaW5rLnNldEF0dHJpYnV0ZSggJ2hyZWYnLCBsaW5rLmdldEF0dHJpYnV0ZSgnaHJlZicpIClcbiAgb3BlbkRpYWxvZygge1xuICAgIHRpdGxlOiAgICAgICAgaXNFbmdsaXNoID8gJ1Jlc2V0JyA6ICdSw6lpbml0aWFsaXNlcicsXG4gICAgZGVzY3JpcHRpb246ICBpc0VuZ2xpc2ggPyBgYXJlIHlvdSBzdXJlIHlvdSB3YW50IHRvIHJlc2V0ICR7dXNlck5hbWV9IHBhc3N3b3JkP2AgOiBgw6p0ZXMgdm91cyBzw7tyIGRlIHZvdWxvaXIgcsOpaW5pdGlhbGlzZXIgbGUgbW90IGRlIHBhc3NlIGRlICAke3VzZXJOYW1lfSA/YCxcbiAgfSApXG59XG5cbi8vLS0tLS0gQUNUSVZBVEVcblxuY29uc3QgYWN0aXZhdGVVc2VycyAgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcuanMtdXNlci1hY3RpdmF0ZScpXG5hZGRMaXN0ZW5lcnMoYWN0aXZhdGVVc2VycywgJ2NsaWNrJywgYXNrVXNlckFjdGl2YXRpb24pXG5mdW5jdGlvbiBhc2tVc2VyQWN0aXZhdGlvbihlKSB7XG4gIGUucHJldmVudERlZmF1bHQoKVxuICBjb25zdCBsaW5rICAgICAgPSBlLmN1cnJlbnRUYXJnZXRcbiAgY29uc3QgdXNlck5hbWUgID0gbGluay5kYXRhc2V0Lm5hbWVcbiAgY29uZmlybUxpbmsuc2V0QXR0cmlidXRlKCAnaHJlZicsIGxpbmsuZ2V0QXR0cmlidXRlKCdocmVmJykgKVxuICBvcGVuRGlhbG9nKCB7XG4gICAgdGl0bGU6ICAgICAgICBpc0VuZ2xpc2ggPyAnQWN0aXZhdGUnIDogJ0FjdGl2ZXInLFxuICAgIGRlc2NyaXB0aW9uOiAgaXNFbmdsaXNoID8gYGFyZSB5b3Ugc3VyZSB5b3Ugd2FudCB0byBhY3RpdmF0ZSAke3VzZXJOYW1lfT9gIDogYMOqdGVzIHZvdXMgc8O7ciBkZSB2b3Vsb2lyIGFjdGl2ZXIgJHt1c2VyTmFtZX0gP2AsXG4gIH0gKVxufVxuXG4vLy0tLS0tIERFQUNUSVZBVEVcblxuY29uc3QgZGVhY3RpdmF0ZVVzZXJzICA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5qcy11c2VyLWRlYWN0aXZhdGUnKVxuYWRkTGlzdGVuZXJzKGRlYWN0aXZhdGVVc2VycywgJ2NsaWNrJywgYXNrVXNlckRlYWN0aXZhdGlvbilcbmZ1bmN0aW9uIGFza1VzZXJEZWFjdGl2YXRpb24oZSkge1xuICBlLnByZXZlbnREZWZhdWx0KClcbiAgY29uc3QgbGluayAgICAgID0gZS5jdXJyZW50VGFyZ2V0XG4gIGNvbnN0IHVzZXJOYW1lICA9IGxpbmsuZGF0YXNldC5uYW1lXG4gIGNvbmZpcm1MaW5rLnNldEF0dHJpYnV0ZSggJ2hyZWYnLCBsaW5rLmdldEF0dHJpYnV0ZSgnaHJlZicpIClcbiAgb3BlbkRpYWxvZygge1xuICAgIHRpdGxlOiAgICAgICAgaXNFbmdsaXNoID8gJ0RlYWN0aXZhdGUnIDogJ0TDqXNhY3RpdmVyJyxcbiAgICBkZXNjcmlwdGlvbjogIGlzRW5nbGlzaCA/IGBhcmUgeW91IHN1cmUgeW91IHdhbnQgdG8gZGVhY3RpdmF0ZSAke3VzZXJOYW1lfT9gIDogYMOqdGVzIHZvdXMgc8O7ciBkZSB2b3Vsb2lyIGTDqXNhY3RpdmVyICR7dXNlck5hbWV9ID9gLFxuICB9IClcbn1cblxuLy8vLy8vXG4vLyBVVElMU1xuLy8vLy8vXG5cbmZ1bmN0aW9uIGFkZExpc3RlbmVycyggZWxlbXMsIGV2ZW50TmFtZSwgY2FsbGJhY2sgKSB7XG4gIGlmICghZWxlbXMubGVuZ3RoKSByZXR1cm5cbiAgO1suLi5lbGVtc10uZm9yRWFjaCggZWxlbSA9PiBlbGVtLmFkZEV2ZW50TGlzdGVuZXIoIGV2ZW50TmFtZSwgY2FsbGJhY2spIClcbn1cblxuZnVuY3Rpb24gZ2V0UGFyZW50KCBlbGVtLCBzZWxlY3RvciApIHtcbiAgbGV0IHBhcmVudCA9IGZhbHNlXG4gIGZvciAoIDsgZWxlbSAmJiBlbGVtICE9PSBkb2N1bWVudDsgZWxlbSA9IGVsZW0ucGFyZW50Tm9kZSApIHtcbiAgICBpZiAoIGVsZW0ubWF0Y2hlcyggc2VsZWN0b3IgKSApIHtcbiAgICAgIHBhcmVudCA9IGVsZW1cbiAgICAgIGJyZWFrXG4gICAgfVxuICB9XG4gIHJldHVybiBwYXJlbnRcbn1cbiJdfQ==
