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
        // nb. Some older iOS and older PhantomJS fail to return the descriptor. Don't do anything
        // and don't bother to update the element.
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
    var replacementFormSubmit = function () {
      if (!isFormMethodDialog(this)) {
        return nativeFormSubmit.call(this);
      }
      var dialog = findNearestDialog(this);
      dialog && dialog.close();
    };
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
"use strict";var _dialogPolyfill=require("dialog-polyfill"),_dialogPolyfill2=_interopRequireDefault(_dialogPolyfill);function _interopRequireDefault(e){return e&&e.__esModule?e:{default:e}}function _toConsumableArray(e){if(Array.isArray(e)){for(var t=0,i=Array(e.length);t<e.length;t++)i[t]=e[t];return i}return Array.from(e)}var lang=document.querySelector("html").getAttribute("lang"),isEnglish="en"===lang,raf=window.requestAnimationFrame,dialog=document.querySelector(".js-dialog-confirm");dialog.showModal||_dialogPolyfill2.default.registerDialog(dialog);var title=dialog.querySelector(".js-dialog-title"),description=dialog.querySelector(".js-dialog-description"),confirmLink=dialog.querySelector(".js-dialog-confirm"),cancelBtn=dialog.querySelector(".js-dialog-cancel");function resetDialog(){title.textContent="",description.textContent="",confirmLink.setAttribute("href","#");var e=confirmLink.cloneNode(!0);confirmLink.parentNode.replaceChild(e,confirmLink),confirmLink=e}function openDialog(e){title.textContent=e.title,description.textContent=e.description,raf(function(e){return dialog.showModal()})}cancelBtn.addEventListener("click",function(e){return dialog.close()}),dialog.addEventListener("cancel",function(e){return resetDialog()}),dialog.addEventListener("close",function(e){return resetDialog()});var deleteButtons=document.querySelectorAll(".js-delete-template");function askTemplateDeletion(e){e.preventDefault();var t=e.currentTarget,i=t.dataset.name;confirmLink.setAttribute("href",t.getAttribute("href")),openDialog({title:"Delete template",description:"are you sure you want to delete "+i+"?"})}addListeners(deleteButtons,"click",askTemplateDeletion);var notification=document.querySelector("#notification");notification&&window.setTimeout(function(){notification.classList.remove("mdl-snackbar--active")},2700);var resetUsers=document.querySelectorAll(".js-reset-user");function askUserReset(e){e.preventDefault();var t=e.currentTarget,i=t.dataset.name;confirmLink.setAttribute("href",t.getAttribute("href")),openDialog({title:isEnglish?"Reset":"Réinitialiser",description:isEnglish?"are you sure you want to reset "+i+" password?":"êtes vous sûr de vouloir réinitialiser le mot de passe de  "+i+" ?"})}addListeners(resetUsers,"click",askUserReset);var activateUsers=document.querySelectorAll(".js-user-activate");function askUserActivation(e){e.preventDefault();var t=e.currentTarget,i=t.dataset.name;confirmLink.setAttribute("href",t.getAttribute("href")),openDialog({title:isEnglish?"Activate":"Activer",description:isEnglish?"are you sure you want to activate "+i+"?":"êtes vous sûr de vouloir activer "+i+" ?"})}addListeners(activateUsers,"click",askUserActivation);var deactivateUsers=document.querySelectorAll(".js-user-deactivate");function askUserDeactivation(e){e.preventDefault();var t=e.currentTarget,i=t.dataset.name;confirmLink.setAttribute("href",t.getAttribute("href")),openDialog({title:isEnglish?"Deactivate":"Désactiver",description:isEnglish?"are you sure you want to deactivate "+i+"?":"êtes vous sûr de vouloir désactiver "+i+" ?"})}function addListeners(e,t,i){e.length&&[].concat(_toConsumableArray(e)).forEach(function(e){return e.addEventListener(t,i)})}function getParent(e,t){for(var i=!1;e&&e!==document;e=e.parentNode)if(e.matches(t)){i=e;break}return i}addListeners(deactivateUsers,"click",askUserDeactivation);

},{"dialog-polyfill":1}]},{},[2])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvZGlhbG9nLXBvbHlmaWxsL2RpYWxvZy1wb2x5ZmlsbC5qcyIsInNyYy9qcy1hZG1pbi1iYWNrZW5kL2luZGV4LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O2FDbHVCQSxJQUFBLGdCQUFBLFFBQUEsNlJBRUEsSUFBTSxLQUFZLFNBQVMsY0FBYyxRQUFRLGFBQWEsUUFDeEQsVUFBcUIsT0FBVCxLQUNaLElBQVksT0FBTyxzQkFRbkIsT0FBYyxTQUFTLGNBQWMsc0JBQ3RDLE9BQU8sV0FDVixpQkFBQSxRQUFlLGVBQWUsUUFFaEMsSUFBTSxNQUFjLE9BQU8sY0FBYyxvQkFDbkMsWUFBYyxPQUFPLGNBQWMsMEJBQ3JDLFlBQWdCLE9BQU8sY0FBYyxzQkFDbkMsVUFBYyxPQUFPLGNBQWMscUJBSXpDLFNBQVMsY0FDUCxNQUFNLFlBQW9CLEdBQzFCLFlBQVksWUFBYyxHQUMxQixZQUFZLGFBQWEsT0FBUSxLQUVqQyxJQUFNLEVBQW9CLFlBQVksV0FBVSxHQUNoRCxZQUFZLFdBQVcsYUFBYSxFQUFrQixhQUN0RCxZQUEwQixFQUU1QixTQUFTLFdBQVksR0FDbkIsTUFBTSxZQUFvQixFQUFNLE1BQ2hDLFlBQVksWUFBYyxFQUFNLFlBQ2hDLElBQUssU0FBQSxHQUFBLE9BQUssT0FBTyxjQWZuQixVQUFVLGlCQUFpQixRQUFTLFNBQUEsR0FBQSxPQUFLLE9BQU8sVUFDaEQsT0FBTyxpQkFBaUIsU0FBVSxTQUFBLEdBQUEsT0FBSyxnQkFDdkMsT0FBTyxpQkFBaUIsUUFBVSxTQUFBLEdBQUEsT0FBSyxnQkFzQnZDLElBQU0sY0FBZ0IsU0FBUyxpQkFBaUIsdUJBRWhELFNBQVMsb0JBQW9CLEdBQzNCLEVBQUUsaUJBQ0YsSUFBTSxFQUFlLEVBQUUsY0FDakIsRUFBZSxFQUFLLFFBQVEsS0FDbEMsWUFBWSxhQUFjLE9BQVEsRUFBSyxhQUFhLFNBQ3BELFdBQVksQ0FDVixNQUFjLGtCQUNkLFlBQUEsbUNBQWlELEVBQWpELE1BUkosYUFBYSxjQUFlLFFBQVMscUJBY3JDLElBQU0sYUFBZSxTQUFTLGNBQWMsaUJBQ3hDLGNBQ0YsT0FBTyxXQUFXLFdBQ2hCLGFBQWEsVUFBVSxPQUFPLHlCQUM3QixNQVNMLElBQU0sV0FBYyxTQUFTLGlCQUFpQixrQkFFOUMsU0FBUyxhQUFhLEdBQ3BCLEVBQUUsaUJBQ0YsSUFBTSxFQUFZLEVBQUUsY0FDZCxFQUFZLEVBQUssUUFBUSxLQUMvQixZQUFZLGFBQWMsT0FBUSxFQUFLLGFBQWEsU0FDcEQsV0FBWSxDQUNWLE1BQWMsVUFBWSxRQUFVLGdCQUNwQyxZQUFjLFVBQUEsa0NBQThDLEVBQTlDLGFBQUEsOERBQW1JLEVBQW5JLE9BUmxCLGFBQWEsV0FBWSxRQUFTLGNBY2xDLElBQU0sY0FBaUIsU0FBUyxpQkFBaUIscUJBRWpELFNBQVMsa0JBQWtCLEdBQ3pCLEVBQUUsaUJBQ0YsSUFBTSxFQUFZLEVBQUUsY0FDZCxFQUFZLEVBQUssUUFBUSxLQUMvQixZQUFZLGFBQWMsT0FBUSxFQUFLLGFBQWEsU0FDcEQsV0FBWSxDQUNWLE1BQWMsVUFBWSxXQUFhLFVBQ3ZDLFlBQWMsVUFBQSxxQ0FBaUQsRUFBakQsSUFBQSxvQ0FBbUcsRUFBbkcsT0FSbEIsYUFBYSxjQUFlLFFBQVMsbUJBY3JDLElBQU0sZ0JBQW1CLFNBQVMsaUJBQWlCLHVCQUVuRCxTQUFTLG9CQUFvQixHQUMzQixFQUFFLGlCQUNGLElBQU0sRUFBWSxFQUFFLGNBQ2QsRUFBWSxFQUFLLFFBQVEsS0FDL0IsWUFBWSxhQUFjLE9BQVEsRUFBSyxhQUFhLFNBQ3BELFdBQVksQ0FDVixNQUFjLFVBQVksYUFBZSxhQUN6QyxZQUFjLFVBQUEsdUNBQW1ELEVBQW5ELElBQUEsdUNBQXdHLEVBQXhHLE9BUWxCLFNBQVMsYUFBYyxFQUFPLEVBQVcsR0FDbEMsRUFBTSxRQUNWLEdBQUEsT0FBQSxtQkFBSSxJQUFPLFFBQVMsU0FBQSxHQUFBLE9BQVEsRUFBSyxpQkFBa0IsRUFBVyxLQUdqRSxTQUFTLFVBQVcsRUFBTSxHQUV4QixJQURBLElBQUksR0FBUyxFQUNMLEdBQVEsSUFBUyxTQUFVLEVBQU8sRUFBSyxXQUM3QyxHQUFLLEVBQUssUUFBUyxHQUFhLENBQzlCLEVBQVMsRUFDVCxNQUdKLE9BQU8sRUE3QlQsYUFBYSxnQkFBaUIsUUFBUyIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIoZnVuY3Rpb24oKSB7XG5cbiAgLy8gbmIuIFRoaXMgaXMgZm9yIElFMTAgYW5kIGxvd2VyIF9vbmx5Xy5cbiAgdmFyIHN1cHBvcnRDdXN0b21FdmVudCA9IHdpbmRvdy5DdXN0b21FdmVudDtcbiAgaWYgKCFzdXBwb3J0Q3VzdG9tRXZlbnQgfHwgdHlwZW9mIHN1cHBvcnRDdXN0b21FdmVudCA9PT0gJ29iamVjdCcpIHtcbiAgICBzdXBwb3J0Q3VzdG9tRXZlbnQgPSBmdW5jdGlvbiBDdXN0b21FdmVudChldmVudCwgeCkge1xuICAgICAgeCA9IHggfHwge307XG4gICAgICB2YXIgZXYgPSBkb2N1bWVudC5jcmVhdGVFdmVudCgnQ3VzdG9tRXZlbnQnKTtcbiAgICAgIGV2LmluaXRDdXN0b21FdmVudChldmVudCwgISF4LmJ1YmJsZXMsICEheC5jYW5jZWxhYmxlLCB4LmRldGFpbCB8fCBudWxsKTtcbiAgICAgIHJldHVybiBldjtcbiAgICB9O1xuICAgIHN1cHBvcnRDdXN0b21FdmVudC5wcm90b3R5cGUgPSB3aW5kb3cuRXZlbnQucHJvdG90eXBlO1xuICB9XG5cbiAgLyoqXG4gICAqIEBwYXJhbSB7RWxlbWVudH0gZWwgdG8gY2hlY2sgZm9yIHN0YWNraW5nIGNvbnRleHRcbiAgICogQHJldHVybiB7Ym9vbGVhbn0gd2hldGhlciB0aGlzIGVsIG9yIGl0cyBwYXJlbnRzIGNyZWF0ZXMgYSBzdGFja2luZyBjb250ZXh0XG4gICAqL1xuICBmdW5jdGlvbiBjcmVhdGVzU3RhY2tpbmdDb250ZXh0KGVsKSB7XG4gICAgd2hpbGUgKGVsICYmIGVsICE9PSBkb2N1bWVudC5ib2R5KSB7XG4gICAgICB2YXIgcyA9IHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKGVsKTtcbiAgICAgIHZhciBpbnZhbGlkID0gZnVuY3Rpb24oaywgb2spIHtcbiAgICAgICAgcmV0dXJuICEoc1trXSA9PT0gdW5kZWZpbmVkIHx8IHNba10gPT09IG9rKTtcbiAgICAgIH1cbiAgICAgIGlmIChzLm9wYWNpdHkgPCAxIHx8XG4gICAgICAgICAgaW52YWxpZCgnekluZGV4JywgJ2F1dG8nKSB8fFxuICAgICAgICAgIGludmFsaWQoJ3RyYW5zZm9ybScsICdub25lJykgfHxcbiAgICAgICAgICBpbnZhbGlkKCdtaXhCbGVuZE1vZGUnLCAnbm9ybWFsJykgfHxcbiAgICAgICAgICBpbnZhbGlkKCdmaWx0ZXInLCAnbm9uZScpIHx8XG4gICAgICAgICAgaW52YWxpZCgncGVyc3BlY3RpdmUnLCAnbm9uZScpIHx8XG4gICAgICAgICAgc1snaXNvbGF0aW9uJ10gPT09ICdpc29sYXRlJyB8fFxuICAgICAgICAgIHMucG9zaXRpb24gPT09ICdmaXhlZCcgfHxcbiAgICAgICAgICBzLndlYmtpdE92ZXJmbG93U2Nyb2xsaW5nID09PSAndG91Y2gnKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgICAgZWwgPSBlbC5wYXJlbnRFbGVtZW50O1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICAvKipcbiAgICogRmluZHMgdGhlIG5lYXJlc3QgPGRpYWxvZz4gZnJvbSB0aGUgcGFzc2VkIGVsZW1lbnQuXG4gICAqXG4gICAqIEBwYXJhbSB7RWxlbWVudH0gZWwgdG8gc2VhcmNoIGZyb21cbiAgICogQHJldHVybiB7SFRNTERpYWxvZ0VsZW1lbnR9IGRpYWxvZyBmb3VuZFxuICAgKi9cbiAgZnVuY3Rpb24gZmluZE5lYXJlc3REaWFsb2coZWwpIHtcbiAgICB3aGlsZSAoZWwpIHtcbiAgICAgIGlmIChlbC5sb2NhbE5hbWUgPT09ICdkaWFsb2cnKSB7XG4gICAgICAgIHJldHVybiAvKiogQHR5cGUge0hUTUxEaWFsb2dFbGVtZW50fSAqLyAoZWwpO1xuICAgICAgfVxuICAgICAgZWwgPSBlbC5wYXJlbnRFbGVtZW50O1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBCbHVyIHRoZSBzcGVjaWZpZWQgZWxlbWVudCwgYXMgbG9uZyBhcyBpdCdzIG5vdCB0aGUgSFRNTCBib2R5IGVsZW1lbnQuXG4gICAqIFRoaXMgd29ya3MgYXJvdW5kIGFuIElFOS8xMCBidWcgLSBibHVycmluZyB0aGUgYm9keSBjYXVzZXMgV2luZG93cyB0b1xuICAgKiBibHVyIHRoZSB3aG9sZSBhcHBsaWNhdGlvbi5cbiAgICpcbiAgICogQHBhcmFtIHtFbGVtZW50fSBlbCB0byBibHVyXG4gICAqL1xuICBmdW5jdGlvbiBzYWZlQmx1cihlbCkge1xuICAgIGlmIChlbCAmJiBlbC5ibHVyICYmIGVsICE9PSBkb2N1bWVudC5ib2R5KSB7XG4gICAgICBlbC5ibHVyKCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEBwYXJhbSB7IU5vZGVMaXN0fSBub2RlTGlzdCB0byBzZWFyY2hcbiAgICogQHBhcmFtIHtOb2RlfSBub2RlIHRvIGZpbmRcbiAgICogQHJldHVybiB7Ym9vbGVhbn0gd2hldGhlciBub2RlIGlzIGluc2lkZSBub2RlTGlzdFxuICAgKi9cbiAgZnVuY3Rpb24gaW5Ob2RlTGlzdChub2RlTGlzdCwgbm9kZSkge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbm9kZUxpc3QubGVuZ3RoOyArK2kpIHtcbiAgICAgIGlmIChub2RlTGlzdFtpXSA9PT0gbm9kZSkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgLyoqXG4gICAqIEBwYXJhbSB7SFRNTEZvcm1FbGVtZW50fSBlbCB0byBjaGVja1xuICAgKiBAcmV0dXJuIHtib29sZWFufSB3aGV0aGVyIHRoaXMgZm9ybSBoYXMgbWV0aG9kPVwiZGlhbG9nXCJcbiAgICovXG4gIGZ1bmN0aW9uIGlzRm9ybU1ldGhvZERpYWxvZyhlbCkge1xuICAgIGlmICghZWwgfHwgIWVsLmhhc0F0dHJpYnV0ZSgnbWV0aG9kJykpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgcmV0dXJuIGVsLmdldEF0dHJpYnV0ZSgnbWV0aG9kJykudG9Mb3dlckNhc2UoKSA9PT0gJ2RpYWxvZyc7XG4gIH1cblxuICAvKipcbiAgICogQHBhcmFtIHshSFRNTERpYWxvZ0VsZW1lbnR9IGRpYWxvZyB0byB1cGdyYWRlXG4gICAqIEBjb25zdHJ1Y3RvclxuICAgKi9cbiAgZnVuY3Rpb24gZGlhbG9nUG9seWZpbGxJbmZvKGRpYWxvZykge1xuICAgIHRoaXMuZGlhbG9nXyA9IGRpYWxvZztcbiAgICB0aGlzLnJlcGxhY2VkU3R5bGVUb3BfID0gZmFsc2U7XG4gICAgdGhpcy5vcGVuQXNNb2RhbF8gPSBmYWxzZTtcblxuICAgIC8vIFNldCBhMTF5IHJvbGUuIEJyb3dzZXJzIHRoYXQgc3VwcG9ydCBkaWFsb2cgaW1wbGljaXRseSBrbm93IHRoaXMgYWxyZWFkeS5cbiAgICBpZiAoIWRpYWxvZy5oYXNBdHRyaWJ1dGUoJ3JvbGUnKSkge1xuICAgICAgZGlhbG9nLnNldEF0dHJpYnV0ZSgncm9sZScsICdkaWFsb2cnKTtcbiAgICB9XG5cbiAgICBkaWFsb2cuc2hvdyA9IHRoaXMuc2hvdy5iaW5kKHRoaXMpO1xuICAgIGRpYWxvZy5zaG93TW9kYWwgPSB0aGlzLnNob3dNb2RhbC5iaW5kKHRoaXMpO1xuICAgIGRpYWxvZy5jbG9zZSA9IHRoaXMuY2xvc2UuYmluZCh0aGlzKTtcblxuICAgIGlmICghKCdyZXR1cm5WYWx1ZScgaW4gZGlhbG9nKSkge1xuICAgICAgZGlhbG9nLnJldHVyblZhbHVlID0gJyc7XG4gICAgfVxuXG4gICAgaWYgKCdNdXRhdGlvbk9ic2VydmVyJyBpbiB3aW5kb3cpIHtcbiAgICAgIHZhciBtbyA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKHRoaXMubWF5YmVIaWRlTW9kYWwuYmluZCh0aGlzKSk7XG4gICAgICBtby5vYnNlcnZlKGRpYWxvZywge2F0dHJpYnV0ZXM6IHRydWUsIGF0dHJpYnV0ZUZpbHRlcjogWydvcGVuJ119KTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gSUUxMCBhbmQgYmVsb3cgc3VwcG9ydC4gTm90ZSB0aGF0IERPTU5vZGVSZW1vdmVkIGV0YyBmaXJlIF9iZWZvcmVfIHJlbW92YWwuIFRoZXkgYWxzb1xuICAgICAgLy8gc2VlbSB0byBmaXJlIGV2ZW4gaWYgdGhlIGVsZW1lbnQgd2FzIHJlbW92ZWQgYXMgcGFydCBvZiBhIHBhcmVudCByZW1vdmFsLiBVc2UgdGhlIHJlbW92ZWRcbiAgICAgIC8vIGV2ZW50cyB0byBmb3JjZSBkb3duZ3JhZGUgKHVzZWZ1bCBpZiByZW1vdmVkL2ltbWVkaWF0ZWx5IGFkZGVkKS5cbiAgICAgIHZhciByZW1vdmVkID0gZmFsc2U7XG4gICAgICB2YXIgY2IgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmVtb3ZlZCA/IHRoaXMuZG93bmdyYWRlTW9kYWwoKSA6IHRoaXMubWF5YmVIaWRlTW9kYWwoKTtcbiAgICAgICAgcmVtb3ZlZCA9IGZhbHNlO1xuICAgICAgfS5iaW5kKHRoaXMpO1xuICAgICAgdmFyIHRpbWVvdXQ7XG4gICAgICB2YXIgZGVsYXlNb2RlbCA9IGZ1bmN0aW9uKGV2KSB7XG4gICAgICAgIGlmIChldi50YXJnZXQgIT09IGRpYWxvZykgeyByZXR1cm47IH0gIC8vIG5vdCBmb3IgYSBjaGlsZCBlbGVtZW50XG4gICAgICAgIHZhciBjYW5kID0gJ0RPTU5vZGVSZW1vdmVkJztcbiAgICAgICAgcmVtb3ZlZCB8PSAoZXYudHlwZS5zdWJzdHIoMCwgY2FuZC5sZW5ndGgpID09PSBjYW5kKTtcbiAgICAgICAgd2luZG93LmNsZWFyVGltZW91dCh0aW1lb3V0KTtcbiAgICAgICAgdGltZW91dCA9IHdpbmRvdy5zZXRUaW1lb3V0KGNiLCAwKTtcbiAgICAgIH07XG4gICAgICBbJ0RPTUF0dHJNb2RpZmllZCcsICdET01Ob2RlUmVtb3ZlZCcsICdET01Ob2RlUmVtb3ZlZEZyb21Eb2N1bWVudCddLmZvckVhY2goZnVuY3Rpb24obmFtZSkge1xuICAgICAgICBkaWFsb2cuYWRkRXZlbnRMaXN0ZW5lcihuYW1lLCBkZWxheU1vZGVsKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICAvLyBOb3RlIHRoYXQgdGhlIERPTSBpcyBvYnNlcnZlZCBpbnNpZGUgRGlhbG9nTWFuYWdlciB3aGlsZSBhbnkgZGlhbG9nXG4gICAgLy8gaXMgYmVpbmcgZGlzcGxheWVkIGFzIGEgbW9kYWwsIHRvIGNhdGNoIG1vZGFsIHJlbW92YWwgZnJvbSB0aGUgRE9NLlxuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGRpYWxvZywgJ29wZW4nLCB7XG4gICAgICBzZXQ6IHRoaXMuc2V0T3Blbi5iaW5kKHRoaXMpLFxuICAgICAgZ2V0OiBkaWFsb2cuaGFzQXR0cmlidXRlLmJpbmQoZGlhbG9nLCAnb3BlbicpXG4gICAgfSk7XG5cbiAgICB0aGlzLmJhY2tkcm9wXyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIHRoaXMuYmFja2Ryb3BfLmNsYXNzTmFtZSA9ICdiYWNrZHJvcCc7XG4gICAgdGhpcy5iYWNrZHJvcF8uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCB0aGlzLmJhY2tkcm9wQ2xpY2tfLmJpbmQodGhpcykpO1xuICB9XG5cbiAgZGlhbG9nUG9seWZpbGxJbmZvLnByb3RvdHlwZSA9IHtcblxuICAgIGdldCBkaWFsb2coKSB7XG4gICAgICByZXR1cm4gdGhpcy5kaWFsb2dfO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBNYXliZSByZW1vdmUgdGhpcyBkaWFsb2cgZnJvbSB0aGUgbW9kYWwgdG9wIGxheWVyLiBUaGlzIGlzIGNhbGxlZCB3aGVuXG4gICAgICogYSBtb2RhbCBkaWFsb2cgbWF5IG5vIGxvbmdlciBiZSB0ZW5hYmxlLCBlLmcuLCB3aGVuIHRoZSBkaWFsb2cgaXMgbm9cbiAgICAgKiBsb25nZXIgb3BlbiBvciBpcyBubyBsb25nZXIgcGFydCBvZiB0aGUgRE9NLlxuICAgICAqL1xuICAgIG1heWJlSGlkZU1vZGFsOiBmdW5jdGlvbigpIHtcbiAgICAgIGlmICh0aGlzLmRpYWxvZ18uaGFzQXR0cmlidXRlKCdvcGVuJykgJiYgZG9jdW1lbnQuYm9keS5jb250YWlucyh0aGlzLmRpYWxvZ18pKSB7IHJldHVybjsgfVxuICAgICAgdGhpcy5kb3duZ3JhZGVNb2RhbCgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmUgdGhpcyBkaWFsb2cgZnJvbSB0aGUgbW9kYWwgdG9wIGxheWVyLCBsZWF2aW5nIGl0IGFzIGEgbm9uLW1vZGFsLlxuICAgICAqL1xuICAgIGRvd25ncmFkZU1vZGFsOiBmdW5jdGlvbigpIHtcbiAgICAgIGlmICghdGhpcy5vcGVuQXNNb2RhbF8pIHsgcmV0dXJuOyB9XG4gICAgICB0aGlzLm9wZW5Bc01vZGFsXyA9IGZhbHNlO1xuICAgICAgdGhpcy5kaWFsb2dfLnN0eWxlLnpJbmRleCA9ICcnO1xuXG4gICAgICAvLyBUaGlzIHdvbid0IG1hdGNoIHRoZSBuYXRpdmUgPGRpYWxvZz4gZXhhY3RseSBiZWNhdXNlIGlmIHRoZSB1c2VyIHNldCB0b3Agb24gYSBjZW50ZXJlZFxuICAgICAgLy8gcG9seWZpbGwgZGlhbG9nLCB0aGF0IHRvcCBnZXRzIHRocm93biBhd2F5IHdoZW4gdGhlIGRpYWxvZyBpcyBjbG9zZWQuIE5vdCBzdXJlIGl0J3NcbiAgICAgIC8vIHBvc3NpYmxlIHRvIHBvbHlmaWxsIHRoaXMgcGVyZmVjdGx5LlxuICAgICAgaWYgKHRoaXMucmVwbGFjZWRTdHlsZVRvcF8pIHtcbiAgICAgICAgdGhpcy5kaWFsb2dfLnN0eWxlLnRvcCA9ICcnO1xuICAgICAgICB0aGlzLnJlcGxhY2VkU3R5bGVUb3BfID0gZmFsc2U7XG4gICAgICB9XG5cbiAgICAgIC8vIENsZWFyIHRoZSBiYWNrZHJvcCBhbmQgcmVtb3ZlIGZyb20gdGhlIG1hbmFnZXIuXG4gICAgICB0aGlzLmJhY2tkcm9wXy5wYXJlbnROb2RlICYmIHRoaXMuYmFja2Ryb3BfLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQodGhpcy5iYWNrZHJvcF8pO1xuICAgICAgZGlhbG9nUG9seWZpbGwuZG0ucmVtb3ZlRGlhbG9nKHRoaXMpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IHZhbHVlIHdoZXRoZXIgdG8gb3BlbiBvciBjbG9zZSB0aGlzIGRpYWxvZ1xuICAgICAqL1xuICAgIHNldE9wZW46IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICBpZiAodmFsdWUpIHtcbiAgICAgICAgdGhpcy5kaWFsb2dfLmhhc0F0dHJpYnV0ZSgnb3BlbicpIHx8IHRoaXMuZGlhbG9nXy5zZXRBdHRyaWJ1dGUoJ29wZW4nLCAnJyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmRpYWxvZ18ucmVtb3ZlQXR0cmlidXRlKCdvcGVuJyk7XG4gICAgICAgIHRoaXMubWF5YmVIaWRlTW9kYWwoKTsgIC8vIG5iLiByZWR1bmRhbnQgd2l0aCBNdXRhdGlvbk9ic2VydmVyXG4gICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEhhbmRsZXMgY2xpY2tzIG9uIHRoZSBmYWtlIC5iYWNrZHJvcCBlbGVtZW50LCByZWRpcmVjdGluZyB0aGVtIGFzIGlmXG4gICAgICogdGhleSB3ZXJlIG9uIHRoZSBkaWFsb2cgaXRzZWxmLlxuICAgICAqXG4gICAgICogQHBhcmFtIHshRXZlbnR9IGUgdG8gcmVkaXJlY3RcbiAgICAgKi9cbiAgICBiYWNrZHJvcENsaWNrXzogZnVuY3Rpb24oZSkge1xuICAgICAgaWYgKCF0aGlzLmRpYWxvZ18uaGFzQXR0cmlidXRlKCd0YWJpbmRleCcpKSB7XG4gICAgICAgIC8vIENsaWNraW5nIG9uIHRoZSBiYWNrZHJvcCBzaG91bGQgbW92ZSB0aGUgaW1wbGljaXQgY3Vyc29yLCBldmVuIGlmIGRpYWxvZyBjYW5ub3QgYmVcbiAgICAgICAgLy8gZm9jdXNlZC4gQ3JlYXRlIGEgZmFrZSB0aGluZyB0byBmb2N1cyBvbi4gSWYgdGhlIGJhY2tkcm9wIHdhcyBfYmVmb3JlXyB0aGUgZGlhbG9nLCB0aGlzXG4gICAgICAgIC8vIHdvdWxkIG5vdCBiZSBuZWVkZWQgLSBjbGlja3Mgd291bGQgbW92ZSB0aGUgaW1wbGljaXQgY3Vyc29yIHRoZXJlLlxuICAgICAgICB2YXIgZmFrZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICB0aGlzLmRpYWxvZ18uaW5zZXJ0QmVmb3JlKGZha2UsIHRoaXMuZGlhbG9nXy5maXJzdENoaWxkKTtcbiAgICAgICAgZmFrZS50YWJJbmRleCA9IC0xO1xuICAgICAgICBmYWtlLmZvY3VzKCk7XG4gICAgICAgIHRoaXMuZGlhbG9nXy5yZW1vdmVDaGlsZChmYWtlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuZGlhbG9nXy5mb2N1cygpO1xuICAgICAgfVxuXG4gICAgICB2YXIgcmVkaXJlY3RlZEV2ZW50ID0gZG9jdW1lbnQuY3JlYXRlRXZlbnQoJ01vdXNlRXZlbnRzJyk7XG4gICAgICByZWRpcmVjdGVkRXZlbnQuaW5pdE1vdXNlRXZlbnQoZS50eXBlLCBlLmJ1YmJsZXMsIGUuY2FuY2VsYWJsZSwgd2luZG93LFxuICAgICAgICAgIGUuZGV0YWlsLCBlLnNjcmVlblgsIGUuc2NyZWVuWSwgZS5jbGllbnRYLCBlLmNsaWVudFksIGUuY3RybEtleSxcbiAgICAgICAgICBlLmFsdEtleSwgZS5zaGlmdEtleSwgZS5tZXRhS2V5LCBlLmJ1dHRvbiwgZS5yZWxhdGVkVGFyZ2V0KTtcbiAgICAgIHRoaXMuZGlhbG9nXy5kaXNwYXRjaEV2ZW50KHJlZGlyZWN0ZWRFdmVudCk7XG4gICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBGb2N1c2VzIG9uIHRoZSBmaXJzdCBmb2N1c2FibGUgZWxlbWVudCB3aXRoaW4gdGhlIGRpYWxvZy4gVGhpcyB3aWxsIGFsd2F5cyBibHVyIHRoZSBjdXJyZW50XG4gICAgICogZm9jdXMsIGV2ZW4gaWYgbm90aGluZyB3aXRoaW4gdGhlIGRpYWxvZyBpcyBmb3VuZC5cbiAgICAgKi9cbiAgICBmb2N1c186IGZ1bmN0aW9uKCkge1xuICAgICAgLy8gRmluZCBlbGVtZW50IHdpdGggYGF1dG9mb2N1c2AgYXR0cmlidXRlLCBvciBmYWxsIGJhY2sgdG8gdGhlIGZpcnN0IGZvcm0vdGFiaW5kZXggY29udHJvbC5cbiAgICAgIHZhciB0YXJnZXQgPSB0aGlzLmRpYWxvZ18ucXVlcnlTZWxlY3RvcignW2F1dG9mb2N1c106bm90KFtkaXNhYmxlZF0pJyk7XG4gICAgICBpZiAoIXRhcmdldCAmJiB0aGlzLmRpYWxvZ18udGFiSW5kZXggPj0gMCkge1xuICAgICAgICB0YXJnZXQgPSB0aGlzLmRpYWxvZ187XG4gICAgICB9XG4gICAgICBpZiAoIXRhcmdldCkge1xuICAgICAgICAvLyBOb3RlIHRoYXQgdGhpcyBpcyAnYW55IGZvY3VzYWJsZSBhcmVhJy4gVGhpcyBsaXN0IGlzIHByb2JhYmx5IG5vdCBleGhhdXN0aXZlLCBidXQgdGhlXG4gICAgICAgIC8vIGFsdGVybmF0aXZlIGludm9sdmVzIHN0ZXBwaW5nIHRocm91Z2ggYW5kIHRyeWluZyB0byBmb2N1cyBldmVyeXRoaW5nLlxuICAgICAgICB2YXIgb3B0cyA9IFsnYnV0dG9uJywgJ2lucHV0JywgJ2tleWdlbicsICdzZWxlY3QnLCAndGV4dGFyZWEnXTtcbiAgICAgICAgdmFyIHF1ZXJ5ID0gb3B0cy5tYXAoZnVuY3Rpb24oZWwpIHtcbiAgICAgICAgICByZXR1cm4gZWwgKyAnOm5vdChbZGlzYWJsZWRdKSc7XG4gICAgICAgIH0pO1xuICAgICAgICAvLyBUT0RPKHNhbXRob3IpOiB0YWJpbmRleCB2YWx1ZXMgdGhhdCBhcmUgbm90IG51bWVyaWMgYXJlIG5vdCBmb2N1c2FibGUuXG4gICAgICAgIHF1ZXJ5LnB1c2goJ1t0YWJpbmRleF06bm90KFtkaXNhYmxlZF0pOm5vdChbdGFiaW5kZXg9XCJcIl0pJyk7ICAvLyB0YWJpbmRleCAhPSBcIlwiLCBub3QgZGlzYWJsZWRcbiAgICAgICAgdGFyZ2V0ID0gdGhpcy5kaWFsb2dfLnF1ZXJ5U2VsZWN0b3IocXVlcnkuam9pbignLCAnKSk7XG4gICAgICB9XG4gICAgICBzYWZlQmx1cihkb2N1bWVudC5hY3RpdmVFbGVtZW50KTtcbiAgICAgIHRhcmdldCAmJiB0YXJnZXQuZm9jdXMoKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgekluZGV4IGZvciB0aGUgYmFja2Ryb3AgYW5kIGRpYWxvZy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBkaWFsb2daXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGJhY2tkcm9wWlxuICAgICAqL1xuICAgIHVwZGF0ZVpJbmRleDogZnVuY3Rpb24oZGlhbG9nWiwgYmFja2Ryb3BaKSB7XG4gICAgICBpZiAoZGlhbG9nWiA8IGJhY2tkcm9wWikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2RpYWxvZ1ogc2hvdWxkIG5ldmVyIGJlIDwgYmFja2Ryb3BaJyk7XG4gICAgICB9XG4gICAgICB0aGlzLmRpYWxvZ18uc3R5bGUuekluZGV4ID0gZGlhbG9nWjtcbiAgICAgIHRoaXMuYmFja2Ryb3BfLnN0eWxlLnpJbmRleCA9IGJhY2tkcm9wWjtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogU2hvd3MgdGhlIGRpYWxvZy4gSWYgdGhlIGRpYWxvZyBpcyBhbHJlYWR5IG9wZW4sIHRoaXMgZG9lcyBub3RoaW5nLlxuICAgICAqL1xuICAgIHNob3c6IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKCF0aGlzLmRpYWxvZ18ub3Blbikge1xuICAgICAgICB0aGlzLnNldE9wZW4odHJ1ZSk7XG4gICAgICAgIHRoaXMuZm9jdXNfKCk7XG4gICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFNob3cgdGhpcyBkaWFsb2cgbW9kYWxseS5cbiAgICAgKi9cbiAgICBzaG93TW9kYWw6IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHRoaXMuZGlhbG9nXy5oYXNBdHRyaWJ1dGUoJ29wZW4nKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZhaWxlZCB0byBleGVjdXRlIFxcJ3Nob3dNb2RhbFxcJyBvbiBkaWFsb2c6IFRoZSBlbGVtZW50IGlzIGFscmVhZHkgb3BlbiwgYW5kIHRoZXJlZm9yZSBjYW5ub3QgYmUgb3BlbmVkIG1vZGFsbHkuJyk7XG4gICAgICB9XG4gICAgICBpZiAoIWRvY3VtZW50LmJvZHkuY29udGFpbnModGhpcy5kaWFsb2dfKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZhaWxlZCB0byBleGVjdXRlIFxcJ3Nob3dNb2RhbFxcJyBvbiBkaWFsb2c6IFRoZSBlbGVtZW50IGlzIG5vdCBpbiBhIERvY3VtZW50LicpO1xuICAgICAgfVxuICAgICAgaWYgKCFkaWFsb2dQb2x5ZmlsbC5kbS5wdXNoRGlhbG9nKHRoaXMpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignRmFpbGVkIHRvIGV4ZWN1dGUgXFwnc2hvd01vZGFsXFwnIG9uIGRpYWxvZzogVGhlcmUgYXJlIHRvbyBtYW55IG9wZW4gbW9kYWwgZGlhbG9ncy4nKTtcbiAgICAgIH1cblxuICAgICAgaWYgKGNyZWF0ZXNTdGFja2luZ0NvbnRleHQodGhpcy5kaWFsb2dfLnBhcmVudEVsZW1lbnQpKSB7XG4gICAgICAgIGNvbnNvbGUud2FybignQSBkaWFsb2cgaXMgYmVpbmcgc2hvd24gaW5zaWRlIGEgc3RhY2tpbmcgY29udGV4dC4gJyArXG4gICAgICAgICAgICAnVGhpcyBtYXkgY2F1c2UgaXQgdG8gYmUgdW51c2FibGUuIEZvciBtb3JlIGluZm9ybWF0aW9uLCBzZWUgdGhpcyBsaW5rOiAnICtcbiAgICAgICAgICAgICdodHRwczovL2dpdGh1Yi5jb20vR29vZ2xlQ2hyb21lL2RpYWxvZy1wb2x5ZmlsbC8jc3RhY2tpbmctY29udGV4dCcpO1xuICAgICAgfVxuXG4gICAgICB0aGlzLnNldE9wZW4odHJ1ZSk7XG4gICAgICB0aGlzLm9wZW5Bc01vZGFsXyA9IHRydWU7XG5cbiAgICAgIC8vIE9wdGlvbmFsbHkgY2VudGVyIHZlcnRpY2FsbHksIHJlbGF0aXZlIHRvIHRoZSBjdXJyZW50IHZpZXdwb3J0LlxuICAgICAgaWYgKGRpYWxvZ1BvbHlmaWxsLm5lZWRzQ2VudGVyaW5nKHRoaXMuZGlhbG9nXykpIHtcbiAgICAgICAgZGlhbG9nUG9seWZpbGwucmVwb3NpdGlvbih0aGlzLmRpYWxvZ18pO1xuICAgICAgICB0aGlzLnJlcGxhY2VkU3R5bGVUb3BfID0gdHJ1ZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMucmVwbGFjZWRTdHlsZVRvcF8gPSBmYWxzZTtcbiAgICAgIH1cblxuICAgICAgLy8gSW5zZXJ0IGJhY2tkcm9wLlxuICAgICAgdGhpcy5kaWFsb2dfLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKHRoaXMuYmFja2Ryb3BfLCB0aGlzLmRpYWxvZ18ubmV4dFNpYmxpbmcpO1xuXG4gICAgICAvLyBGb2N1cyBvbiB3aGF0ZXZlciBpbnNpZGUgdGhlIGRpYWxvZy5cbiAgICAgIHRoaXMuZm9jdXNfKCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIENsb3NlcyB0aGlzIEhUTUxEaWFsb2dFbGVtZW50LiBUaGlzIGlzIG9wdGlvbmFsIHZzIGNsZWFyaW5nIHRoZSBvcGVuXG4gICAgICogYXR0cmlidXRlLCBob3dldmVyIHRoaXMgZmlyZXMgYSAnY2xvc2UnIGV2ZW50LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmc9fSBvcHRfcmV0dXJuVmFsdWUgdG8gdXNlIGFzIHRoZSByZXR1cm5WYWx1ZVxuICAgICAqL1xuICAgIGNsb3NlOiBmdW5jdGlvbihvcHRfcmV0dXJuVmFsdWUpIHtcbiAgICAgIGlmICghdGhpcy5kaWFsb2dfLmhhc0F0dHJpYnV0ZSgnb3BlbicpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignRmFpbGVkIHRvIGV4ZWN1dGUgXFwnY2xvc2VcXCcgb24gZGlhbG9nOiBUaGUgZWxlbWVudCBkb2VzIG5vdCBoYXZlIGFuIFxcJ29wZW5cXCcgYXR0cmlidXRlLCBhbmQgdGhlcmVmb3JlIGNhbm5vdCBiZSBjbG9zZWQuJyk7XG4gICAgICB9XG4gICAgICB0aGlzLnNldE9wZW4oZmFsc2UpO1xuXG4gICAgICAvLyBMZWF2ZSByZXR1cm5WYWx1ZSB1bnRvdWNoZWQgaW4gY2FzZSBpdCB3YXMgc2V0IGRpcmVjdGx5IG9uIHRoZSBlbGVtZW50XG4gICAgICBpZiAob3B0X3JldHVyblZhbHVlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgdGhpcy5kaWFsb2dfLnJldHVyblZhbHVlID0gb3B0X3JldHVyblZhbHVlO1xuICAgICAgfVxuXG4gICAgICAvLyBUcmlnZ2VyaW5nIFwiY2xvc2VcIiBldmVudCBmb3IgYW55IGF0dGFjaGVkIGxpc3RlbmVycyBvbiB0aGUgPGRpYWxvZz4uXG4gICAgICB2YXIgY2xvc2VFdmVudCA9IG5ldyBzdXBwb3J0Q3VzdG9tRXZlbnQoJ2Nsb3NlJywge1xuICAgICAgICBidWJibGVzOiBmYWxzZSxcbiAgICAgICAgY2FuY2VsYWJsZTogZmFsc2VcbiAgICAgIH0pO1xuICAgICAgdGhpcy5kaWFsb2dfLmRpc3BhdGNoRXZlbnQoY2xvc2VFdmVudCk7XG4gICAgfVxuXG4gIH07XG5cbiAgdmFyIGRpYWxvZ1BvbHlmaWxsID0ge307XG5cbiAgZGlhbG9nUG9seWZpbGwucmVwb3NpdGlvbiA9IGZ1bmN0aW9uKGVsZW1lbnQpIHtcbiAgICB2YXIgc2Nyb2xsVG9wID0gZG9jdW1lbnQuYm9keS5zY3JvbGxUb3AgfHwgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnNjcm9sbFRvcDtcbiAgICB2YXIgdG9wVmFsdWUgPSBzY3JvbGxUb3AgKyAod2luZG93LmlubmVySGVpZ2h0IC0gZWxlbWVudC5vZmZzZXRIZWlnaHQpIC8gMjtcbiAgICBlbGVtZW50LnN0eWxlLnRvcCA9IE1hdGgubWF4KHNjcm9sbFRvcCwgdG9wVmFsdWUpICsgJ3B4JztcbiAgfTtcblxuICBkaWFsb2dQb2x5ZmlsbC5pc0lubGluZVBvc2l0aW9uU2V0QnlTdHlsZXNoZWV0ID0gZnVuY3Rpb24oZWxlbWVudCkge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZG9jdW1lbnQuc3R5bGVTaGVldHMubGVuZ3RoOyArK2kpIHtcbiAgICAgIHZhciBzdHlsZVNoZWV0ID0gZG9jdW1lbnQuc3R5bGVTaGVldHNbaV07XG4gICAgICB2YXIgY3NzUnVsZXMgPSBudWxsO1xuICAgICAgLy8gU29tZSBicm93c2VycyB0aHJvdyBvbiBjc3NSdWxlcy5cbiAgICAgIHRyeSB7XG4gICAgICAgIGNzc1J1bGVzID0gc3R5bGVTaGVldC5jc3NSdWxlcztcbiAgICAgIH0gY2F0Y2ggKGUpIHt9XG4gICAgICBpZiAoIWNzc1J1bGVzKSB7IGNvbnRpbnVlOyB9XG4gICAgICBmb3IgKHZhciBqID0gMDsgaiA8IGNzc1J1bGVzLmxlbmd0aDsgKytqKSB7XG4gICAgICAgIHZhciBydWxlID0gY3NzUnVsZXNbal07XG4gICAgICAgIHZhciBzZWxlY3RlZE5vZGVzID0gbnVsbDtcbiAgICAgICAgLy8gSWdub3JlIGVycm9ycyBvbiBpbnZhbGlkIHNlbGVjdG9yIHRleHRzLlxuICAgICAgICB0cnkge1xuICAgICAgICAgIHNlbGVjdGVkTm9kZXMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKHJ1bGUuc2VsZWN0b3JUZXh0KTtcbiAgICAgICAgfSBjYXRjaChlKSB7fVxuICAgICAgICBpZiAoIXNlbGVjdGVkTm9kZXMgfHwgIWluTm9kZUxpc3Qoc2VsZWN0ZWROb2RlcywgZWxlbWVudCkpIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgY3NzVG9wID0gcnVsZS5zdHlsZS5nZXRQcm9wZXJ0eVZhbHVlKCd0b3AnKTtcbiAgICAgICAgdmFyIGNzc0JvdHRvbSA9IHJ1bGUuc3R5bGUuZ2V0UHJvcGVydHlWYWx1ZSgnYm90dG9tJyk7XG4gICAgICAgIGlmICgoY3NzVG9wICYmIGNzc1RvcCAhPT0gJ2F1dG8nKSB8fCAoY3NzQm90dG9tICYmIGNzc0JvdHRvbSAhPT0gJ2F1dG8nKSkge1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfTtcblxuICBkaWFsb2dQb2x5ZmlsbC5uZWVkc0NlbnRlcmluZyA9IGZ1bmN0aW9uKGRpYWxvZykge1xuICAgIHZhciBjb21wdXRlZFN0eWxlID0gd2luZG93LmdldENvbXB1dGVkU3R5bGUoZGlhbG9nKTtcbiAgICBpZiAoY29tcHV0ZWRTdHlsZS5wb3NpdGlvbiAhPT0gJ2Fic29sdXRlJykge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIC8vIFdlIG11c3QgZGV0ZXJtaW5lIHdoZXRoZXIgdGhlIHRvcC9ib3R0b20gc3BlY2lmaWVkIHZhbHVlIGlzIG5vbi1hdXRvLiAgSW5cbiAgICAvLyBXZWJLaXQvQmxpbmssIGNoZWNraW5nIGNvbXB1dGVkU3R5bGUudG9wID09ICdhdXRvJyBpcyBzdWZmaWNpZW50LCBidXRcbiAgICAvLyBGaXJlZm94IHJldHVybnMgdGhlIHVzZWQgdmFsdWUuIFNvIHdlIGRvIHRoaXMgY3JhenkgdGhpbmcgaW5zdGVhZDogY2hlY2tcbiAgICAvLyB0aGUgaW5saW5lIHN0eWxlIGFuZCB0aGVuIGdvIHRocm91Z2ggQ1NTIHJ1bGVzLlxuICAgIGlmICgoZGlhbG9nLnN0eWxlLnRvcCAhPT0gJ2F1dG8nICYmIGRpYWxvZy5zdHlsZS50b3AgIT09ICcnKSB8fFxuICAgICAgICAoZGlhbG9nLnN0eWxlLmJvdHRvbSAhPT0gJ2F1dG8nICYmIGRpYWxvZy5zdHlsZS5ib3R0b20gIT09ICcnKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICByZXR1cm4gIWRpYWxvZ1BvbHlmaWxsLmlzSW5saW5lUG9zaXRpb25TZXRCeVN0eWxlc2hlZXQoZGlhbG9nKTtcbiAgfTtcblxuICAvKipcbiAgICogQHBhcmFtIHshRWxlbWVudH0gZWxlbWVudCB0byBmb3JjZSB1cGdyYWRlXG4gICAqL1xuICBkaWFsb2dQb2x5ZmlsbC5mb3JjZVJlZ2lzdGVyRGlhbG9nID0gZnVuY3Rpb24oZWxlbWVudCkge1xuICAgIGlmICh3aW5kb3cuSFRNTERpYWxvZ0VsZW1lbnQgfHwgZWxlbWVudC5zaG93TW9kYWwpIHtcbiAgICAgIGNvbnNvbGUud2FybignVGhpcyBicm93c2VyIGFscmVhZHkgc3VwcG9ydHMgPGRpYWxvZz4sIHRoZSBwb2x5ZmlsbCAnICtcbiAgICAgICAgICAnbWF5IG5vdCB3b3JrIGNvcnJlY3RseScsIGVsZW1lbnQpO1xuICAgIH1cbiAgICBpZiAoZWxlbWVudC5sb2NhbE5hbWUgIT09ICdkaWFsb2cnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZhaWxlZCB0byByZWdpc3RlciBkaWFsb2c6IFRoZSBlbGVtZW50IGlzIG5vdCBhIGRpYWxvZy4nKTtcbiAgICB9XG4gICAgbmV3IGRpYWxvZ1BvbHlmaWxsSW5mbygvKiogQHR5cGUgeyFIVE1MRGlhbG9nRWxlbWVudH0gKi8gKGVsZW1lbnQpKTtcbiAgfTtcblxuICAvKipcbiAgICogQHBhcmFtIHshRWxlbWVudH0gZWxlbWVudCB0byB1cGdyYWRlLCBpZiBuZWNlc3NhcnlcbiAgICovXG4gIGRpYWxvZ1BvbHlmaWxsLnJlZ2lzdGVyRGlhbG9nID0gZnVuY3Rpb24oZWxlbWVudCkge1xuICAgIGlmICghZWxlbWVudC5zaG93TW9kYWwpIHtcbiAgICAgIGRpYWxvZ1BvbHlmaWxsLmZvcmNlUmVnaXN0ZXJEaWFsb2coZWxlbWVudCk7XG4gICAgfVxuICB9O1xuXG4gIC8qKlxuICAgKiBAY29uc3RydWN0b3JcbiAgICovXG4gIGRpYWxvZ1BvbHlmaWxsLkRpYWxvZ01hbmFnZXIgPSBmdW5jdGlvbigpIHtcbiAgICAvKiogQHR5cGUgeyFBcnJheTwhZGlhbG9nUG9seWZpbGxJbmZvPn0gKi9cbiAgICB0aGlzLnBlbmRpbmdEaWFsb2dTdGFjayA9IFtdO1xuXG4gICAgdmFyIGNoZWNrRE9NID0gdGhpcy5jaGVja0RPTV8uYmluZCh0aGlzKTtcblxuICAgIC8vIFRoZSBvdmVybGF5IGlzIHVzZWQgdG8gc2ltdWxhdGUgaG93IGEgbW9kYWwgZGlhbG9nIGJsb2NrcyB0aGUgZG9jdW1lbnQuXG4gICAgLy8gVGhlIGJsb2NraW5nIGRpYWxvZyBpcyBwb3NpdGlvbmVkIG9uIHRvcCBvZiB0aGUgb3ZlcmxheSwgYW5kIHRoZSByZXN0IG9mXG4gICAgLy8gdGhlIGRpYWxvZ3Mgb24gdGhlIHBlbmRpbmcgZGlhbG9nIHN0YWNrIGFyZSBwb3NpdGlvbmVkIGJlbG93IGl0LiBJbiB0aGVcbiAgICAvLyBhY3R1YWwgaW1wbGVtZW50YXRpb24sIHRoZSBtb2RhbCBkaWFsb2cgc3RhY2tpbmcgaXMgY29udHJvbGxlZCBieSB0aGVcbiAgICAvLyB0b3AgbGF5ZXIsIHdoZXJlIHotaW5kZXggaGFzIG5vIGVmZmVjdC5cbiAgICB0aGlzLm92ZXJsYXkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICB0aGlzLm92ZXJsYXkuY2xhc3NOYW1lID0gJ19kaWFsb2dfb3ZlcmxheSc7XG4gICAgdGhpcy5vdmVybGF5LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZnVuY3Rpb24oZSkge1xuICAgICAgdGhpcy5mb3J3YXJkVGFiXyA9IHVuZGVmaW5lZDtcbiAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICBjaGVja0RPTShbXSk7ICAvLyBzYW5pdHktY2hlY2sgRE9NXG4gICAgfS5iaW5kKHRoaXMpKTtcblxuICAgIHRoaXMuaGFuZGxlS2V5XyA9IHRoaXMuaGFuZGxlS2V5Xy5iaW5kKHRoaXMpO1xuICAgIHRoaXMuaGFuZGxlRm9jdXNfID0gdGhpcy5oYW5kbGVGb2N1c18uYmluZCh0aGlzKTtcblxuICAgIHRoaXMuekluZGV4TG93XyA9IDEwMDAwMDtcbiAgICB0aGlzLnpJbmRleEhpZ2hfID0gMTAwMDAwICsgMTUwO1xuXG4gICAgdGhpcy5mb3J3YXJkVGFiXyA9IHVuZGVmaW5lZDtcblxuICAgIGlmICgnTXV0YXRpb25PYnNlcnZlcicgaW4gd2luZG93KSB7XG4gICAgICB0aGlzLm1vXyA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKGZ1bmN0aW9uKHJlY29yZHMpIHtcbiAgICAgICAgdmFyIHJlbW92ZWQgPSBbXTtcbiAgICAgICAgcmVjb3Jkcy5mb3JFYWNoKGZ1bmN0aW9uKHJlYykge1xuICAgICAgICAgIGZvciAodmFyIGkgPSAwLCBjOyBjID0gcmVjLnJlbW92ZWROb2Rlc1tpXTsgKytpKSB7XG4gICAgICAgICAgICBpZiAoIShjIGluc3RhbmNlb2YgRWxlbWVudCkpIHtcbiAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGMubG9jYWxOYW1lID09PSAnZGlhbG9nJykge1xuICAgICAgICAgICAgICByZW1vdmVkLnB1c2goYyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZW1vdmVkID0gcmVtb3ZlZC5jb25jYXQoYy5xdWVyeVNlbGVjdG9yQWxsKCdkaWFsb2cnKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgcmVtb3ZlZC5sZW5ndGggJiYgY2hlY2tET00ocmVtb3ZlZCk7XG4gICAgICB9KTtcbiAgICB9XG4gIH07XG5cbiAgLyoqXG4gICAqIENhbGxlZCBvbiB0aGUgZmlyc3QgbW9kYWwgZGlhbG9nIGJlaW5nIHNob3duLiBBZGRzIHRoZSBvdmVybGF5IGFuZCByZWxhdGVkXG4gICAqIGhhbmRsZXJzLlxuICAgKi9cbiAgZGlhbG9nUG9seWZpbGwuRGlhbG9nTWFuYWdlci5wcm90b3R5cGUuYmxvY2tEb2N1bWVudCA9IGZ1bmN0aW9uKCkge1xuICAgIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdmb2N1cycsIHRoaXMuaGFuZGxlRm9jdXNfLCB0cnVlKTtcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgdGhpcy5oYW5kbGVLZXlfKTtcbiAgICB0aGlzLm1vXyAmJiB0aGlzLm1vXy5vYnNlcnZlKGRvY3VtZW50LCB7Y2hpbGRMaXN0OiB0cnVlLCBzdWJ0cmVlOiB0cnVlfSk7XG4gIH07XG5cbiAgLyoqXG4gICAqIENhbGxlZCBvbiB0aGUgZmlyc3QgbW9kYWwgZGlhbG9nIGJlaW5nIHJlbW92ZWQsIGkuZS4sIHdoZW4gbm8gbW9yZSBtb2RhbFxuICAgKiBkaWFsb2dzIGFyZSB2aXNpYmxlLlxuICAgKi9cbiAgZGlhbG9nUG9seWZpbGwuRGlhbG9nTWFuYWdlci5wcm90b3R5cGUudW5ibG9ja0RvY3VtZW50ID0gZnVuY3Rpb24oKSB7XG4gICAgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2ZvY3VzJywgdGhpcy5oYW5kbGVGb2N1c18sIHRydWUpO1xuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCB0aGlzLmhhbmRsZUtleV8pO1xuICAgIHRoaXMubW9fICYmIHRoaXMubW9fLmRpc2Nvbm5lY3QoKTtcbiAgfTtcblxuICAvKipcbiAgICogVXBkYXRlcyB0aGUgc3RhY2tpbmcgb2YgYWxsIGtub3duIGRpYWxvZ3MuXG4gICAqL1xuICBkaWFsb2dQb2x5ZmlsbC5EaWFsb2dNYW5hZ2VyLnByb3RvdHlwZS51cGRhdGVTdGFja2luZyA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciB6SW5kZXggPSB0aGlzLnpJbmRleEhpZ2hfO1xuXG4gICAgZm9yICh2YXIgaSA9IDAsIGRwaTsgZHBpID0gdGhpcy5wZW5kaW5nRGlhbG9nU3RhY2tbaV07ICsraSkge1xuICAgICAgZHBpLnVwZGF0ZVpJbmRleCgtLXpJbmRleCwgLS16SW5kZXgpO1xuICAgICAgaWYgKGkgPT09IDApIHtcbiAgICAgICAgdGhpcy5vdmVybGF5LnN0eWxlLnpJbmRleCA9IC0tekluZGV4O1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIE1ha2UgdGhlIG92ZXJsYXkgYSBzaWJsaW5nIG9mIHRoZSBkaWFsb2cgaXRzZWxmLlxuICAgIHZhciBsYXN0ID0gdGhpcy5wZW5kaW5nRGlhbG9nU3RhY2tbMF07XG4gICAgaWYgKGxhc3QpIHtcbiAgICAgIHZhciBwID0gbGFzdC5kaWFsb2cucGFyZW50Tm9kZSB8fCBkb2N1bWVudC5ib2R5O1xuICAgICAgcC5hcHBlbmRDaGlsZCh0aGlzLm92ZXJsYXkpO1xuICAgIH0gZWxzZSBpZiAodGhpcy5vdmVybGF5LnBhcmVudE5vZGUpIHtcbiAgICAgIHRoaXMub3ZlcmxheS5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKHRoaXMub3ZlcmxheSk7XG4gICAgfVxuICB9O1xuXG4gIC8qKlxuICAgKiBAcGFyYW0ge0VsZW1lbnR9IGNhbmRpZGF0ZSB0byBjaGVjayBpZiBjb250YWluZWQgb3IgaXMgdGhlIHRvcC1tb3N0IG1vZGFsIGRpYWxvZ1xuICAgKiBAcmV0dXJuIHtib29sZWFufSB3aGV0aGVyIGNhbmRpZGF0ZSBpcyBjb250YWluZWQgaW4gdG9wIGRpYWxvZ1xuICAgKi9cbiAgZGlhbG9nUG9seWZpbGwuRGlhbG9nTWFuYWdlci5wcm90b3R5cGUuY29udGFpbmVkQnlUb3BEaWFsb2dfID0gZnVuY3Rpb24oY2FuZGlkYXRlKSB7XG4gICAgd2hpbGUgKGNhbmRpZGF0ZSA9IGZpbmROZWFyZXN0RGlhbG9nKGNhbmRpZGF0ZSkpIHtcbiAgICAgIGZvciAodmFyIGkgPSAwLCBkcGk7IGRwaSA9IHRoaXMucGVuZGluZ0RpYWxvZ1N0YWNrW2ldOyArK2kpIHtcbiAgICAgICAgaWYgKGRwaS5kaWFsb2cgPT09IGNhbmRpZGF0ZSkge1xuICAgICAgICAgIHJldHVybiBpID09PSAwOyAgLy8gb25seSB2YWxpZCBpZiB0b3AtbW9zdFxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBjYW5kaWRhdGUgPSBjYW5kaWRhdGUucGFyZW50RWxlbWVudDtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9O1xuXG4gIGRpYWxvZ1BvbHlmaWxsLkRpYWxvZ01hbmFnZXIucHJvdG90eXBlLmhhbmRsZUZvY3VzXyA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgaWYgKHRoaXMuY29udGFpbmVkQnlUb3BEaWFsb2dfKGV2ZW50LnRhcmdldCkpIHsgcmV0dXJuOyB9XG5cbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIHNhZmVCbHVyKC8qKiBAdHlwZSB7RWxlbWVudH0gKi8gKGV2ZW50LnRhcmdldCkpO1xuXG4gICAgaWYgKHRoaXMuZm9yd2FyZFRhYl8gPT09IHVuZGVmaW5lZCkgeyByZXR1cm47IH0gIC8vIG1vdmUgZm9jdXMgb25seSBmcm9tIGEgdGFiIGtleVxuXG4gICAgdmFyIGRwaSA9IHRoaXMucGVuZGluZ0RpYWxvZ1N0YWNrWzBdO1xuICAgIHZhciBkaWFsb2cgPSBkcGkuZGlhbG9nO1xuICAgIHZhciBwb3NpdGlvbiA9IGRpYWxvZy5jb21wYXJlRG9jdW1lbnRQb3NpdGlvbihldmVudC50YXJnZXQpO1xuICAgIGlmIChwb3NpdGlvbiAmIE5vZGUuRE9DVU1FTlRfUE9TSVRJT05fUFJFQ0VESU5HKSB7XG4gICAgICBpZiAodGhpcy5mb3J3YXJkVGFiXykgeyAgLy8gZm9yd2FyZFxuICAgICAgICBkcGkuZm9jdXNfKCk7XG4gICAgICB9IGVsc2UgeyAgLy8gYmFja3dhcmRzXG4gICAgICAgIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5mb2N1cygpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAvLyBUT0RPOiBGb2N1cyBhZnRlciB0aGUgZGlhbG9nLCBpcyBpZ25vcmVkLlxuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbiAgfTtcblxuICBkaWFsb2dQb2x5ZmlsbC5EaWFsb2dNYW5hZ2VyLnByb3RvdHlwZS5oYW5kbGVLZXlfID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICB0aGlzLmZvcndhcmRUYWJfID0gdW5kZWZpbmVkO1xuICAgIGlmIChldmVudC5rZXlDb2RlID09PSAyNykge1xuICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgdmFyIGNhbmNlbEV2ZW50ID0gbmV3IHN1cHBvcnRDdXN0b21FdmVudCgnY2FuY2VsJywge1xuICAgICAgICBidWJibGVzOiBmYWxzZSxcbiAgICAgICAgY2FuY2VsYWJsZTogdHJ1ZVxuICAgICAgfSk7XG4gICAgICB2YXIgZHBpID0gdGhpcy5wZW5kaW5nRGlhbG9nU3RhY2tbMF07XG4gICAgICBpZiAoZHBpICYmIGRwaS5kaWFsb2cuZGlzcGF0Y2hFdmVudChjYW5jZWxFdmVudCkpIHtcbiAgICAgICAgZHBpLmRpYWxvZy5jbG9zZSgpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoZXZlbnQua2V5Q29kZSA9PT0gOSkge1xuICAgICAgdGhpcy5mb3J3YXJkVGFiXyA9ICFldmVudC5zaGlmdEtleTtcbiAgICB9XG4gIH07XG5cbiAgLyoqXG4gICAqIEZpbmRzIGFuZCBkb3duZ3JhZGVzIGFueSBrbm93biBtb2RhbCBkaWFsb2dzIHRoYXQgYXJlIG5vIGxvbmdlciBkaXNwbGF5ZWQuIERpYWxvZ3MgdGhhdCBhcmVcbiAgICogcmVtb3ZlZCBhbmQgaW1tZWRpYXRlbHkgcmVhZGRlZCBkb24ndCBzdGF5IG1vZGFsLCB0aGV5IGJlY29tZSBub3JtYWwuXG4gICAqXG4gICAqIEBwYXJhbSB7IUFycmF5PCFIVE1MRGlhbG9nRWxlbWVudD59IHJlbW92ZWQgdGhhdCBoYXZlIGRlZmluaXRlbHkgYmVlbiByZW1vdmVkXG4gICAqL1xuICBkaWFsb2dQb2x5ZmlsbC5EaWFsb2dNYW5hZ2VyLnByb3RvdHlwZS5jaGVja0RPTV8gPSBmdW5jdGlvbihyZW1vdmVkKSB7XG4gICAgLy8gVGhpcyBvcGVyYXRlcyBvbiBhIGNsb25lIGJlY2F1c2UgaXQgbWF5IGNhdXNlIGl0IHRvIGNoYW5nZS4gRWFjaCBjaGFuZ2UgYWxzbyBjYWxsc1xuICAgIC8vIHVwZGF0ZVN0YWNraW5nLCB3aGljaCBvbmx5IGFjdHVhbGx5IG5lZWRzIHRvIGhhcHBlbiBvbmNlLiBCdXQgd2hvIHJlbW92ZXMgbWFueSBtb2RhbCBkaWFsb2dzXG4gICAgLy8gYXQgYSB0aW1lPyFcbiAgICB2YXIgY2xvbmUgPSB0aGlzLnBlbmRpbmdEaWFsb2dTdGFjay5zbGljZSgpO1xuICAgIGNsb25lLmZvckVhY2goZnVuY3Rpb24oZHBpKSB7XG4gICAgICBpZiAocmVtb3ZlZC5pbmRleE9mKGRwaS5kaWFsb2cpICE9PSAtMSkge1xuICAgICAgICBkcGkuZG93bmdyYWRlTW9kYWwoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGRwaS5tYXliZUhpZGVNb2RhbCgpO1xuICAgICAgfVxuICAgIH0pO1xuICB9O1xuXG4gIC8qKlxuICAgKiBAcGFyYW0geyFkaWFsb2dQb2x5ZmlsbEluZm99IGRwaVxuICAgKiBAcmV0dXJuIHtib29sZWFufSB3aGV0aGVyIHRoZSBkaWFsb2cgd2FzIGFsbG93ZWRcbiAgICovXG4gIGRpYWxvZ1BvbHlmaWxsLkRpYWxvZ01hbmFnZXIucHJvdG90eXBlLnB1c2hEaWFsb2cgPSBmdW5jdGlvbihkcGkpIHtcbiAgICB2YXIgYWxsb3dlZCA9ICh0aGlzLnpJbmRleEhpZ2hfIC0gdGhpcy56SW5kZXhMb3dfKSAvIDIgLSAxO1xuICAgIGlmICh0aGlzLnBlbmRpbmdEaWFsb2dTdGFjay5sZW5ndGggPj0gYWxsb3dlZCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBpZiAodGhpcy5wZW5kaW5nRGlhbG9nU3RhY2sudW5zaGlmdChkcGkpID09PSAxKSB7XG4gICAgICB0aGlzLmJsb2NrRG9jdW1lbnQoKTtcbiAgICB9XG4gICAgdGhpcy51cGRhdGVTdGFja2luZygpO1xuICAgIHJldHVybiB0cnVlO1xuICB9O1xuXG4gIC8qKlxuICAgKiBAcGFyYW0geyFkaWFsb2dQb2x5ZmlsbEluZm99IGRwaVxuICAgKi9cbiAgZGlhbG9nUG9seWZpbGwuRGlhbG9nTWFuYWdlci5wcm90b3R5cGUucmVtb3ZlRGlhbG9nID0gZnVuY3Rpb24oZHBpKSB7XG4gICAgdmFyIGluZGV4ID0gdGhpcy5wZW5kaW5nRGlhbG9nU3RhY2suaW5kZXhPZihkcGkpO1xuICAgIGlmIChpbmRleCA9PT0gLTEpIHsgcmV0dXJuOyB9XG5cbiAgICB0aGlzLnBlbmRpbmdEaWFsb2dTdGFjay5zcGxpY2UoaW5kZXgsIDEpO1xuICAgIGlmICh0aGlzLnBlbmRpbmdEaWFsb2dTdGFjay5sZW5ndGggPT09IDApIHtcbiAgICAgIHRoaXMudW5ibG9ja0RvY3VtZW50KCk7XG4gICAgfVxuICAgIHRoaXMudXBkYXRlU3RhY2tpbmcoKTtcbiAgfTtcblxuICBkaWFsb2dQb2x5ZmlsbC5kbSA9IG5ldyBkaWFsb2dQb2x5ZmlsbC5EaWFsb2dNYW5hZ2VyKCk7XG4gIGRpYWxvZ1BvbHlmaWxsLmZvcm1TdWJtaXR0ZXIgPSBudWxsO1xuICBkaWFsb2dQb2x5ZmlsbC51c2VWYWx1ZSA9IG51bGw7XG5cbiAgLyoqXG4gICAqIEluc3RhbGxzIGdsb2JhbCBoYW5kbGVycywgc3VjaCBhcyBjbGljayBsaXN0ZXJzIGFuZCBuYXRpdmUgbWV0aG9kIG92ZXJyaWRlcy4gVGhlc2UgYXJlIG5lZWRlZFxuICAgKiBldmVuIGlmIGEgbm8gZGlhbG9nIGlzIHJlZ2lzdGVyZWQsIGFzIHRoZXkgZGVhbCB3aXRoIDxmb3JtIG1ldGhvZD1cImRpYWxvZ1wiPi5cbiAgICovXG4gIGlmICh3aW5kb3cuSFRNTERpYWxvZ0VsZW1lbnQgPT09IHVuZGVmaW5lZCkge1xuXG4gICAgLyoqXG4gICAgICogSWYgSFRNTEZvcm1FbGVtZW50IHRyYW5zbGF0ZXMgbWV0aG9kPVwiRElBTE9HXCIgaW50byAnZ2V0JywgdGhlbiByZXBsYWNlIHRoZSBkZXNjcmlwdG9yIHdpdGhcbiAgICAgKiBvbmUgdGhhdCByZXR1cm5zIHRoZSBjb3JyZWN0IHZhbHVlLlxuICAgICAqL1xuICAgIHZhciB0ZXN0Rm9ybSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2Zvcm0nKTtcbiAgICB0ZXN0Rm9ybS5zZXRBdHRyaWJ1dGUoJ21ldGhvZCcsICdkaWFsb2cnKTtcbiAgICBpZiAodGVzdEZvcm0ubWV0aG9kICE9PSAnZGlhbG9nJykge1xuICAgICAgdmFyIG1ldGhvZERlc2NyaXB0b3IgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKEhUTUxGb3JtRWxlbWVudC5wcm90b3R5cGUsICdtZXRob2QnKTtcbiAgICAgIGlmIChtZXRob2REZXNjcmlwdG9yKSB7XG4gICAgICAgIC8vIG5iLiBTb21lIG9sZGVyIGlPUyBhbmQgb2xkZXIgUGhhbnRvbUpTIGZhaWwgdG8gcmV0dXJuIHRoZSBkZXNjcmlwdG9yLiBEb24ndCBkbyBhbnl0aGluZ1xuICAgICAgICAvLyBhbmQgZG9uJ3QgYm90aGVyIHRvIHVwZGF0ZSB0aGUgZWxlbWVudC5cbiAgICAgICAgdmFyIHJlYWxHZXQgPSBtZXRob2REZXNjcmlwdG9yLmdldDtcbiAgICAgICAgbWV0aG9kRGVzY3JpcHRvci5nZXQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICBpZiAoaXNGb3JtTWV0aG9kRGlhbG9nKHRoaXMpKSB7XG4gICAgICAgICAgICByZXR1cm4gJ2RpYWxvZyc7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiByZWFsR2V0LmNhbGwodGhpcyk7XG4gICAgICAgIH07XG4gICAgICAgIHZhciByZWFsU2V0ID0gbWV0aG9kRGVzY3JpcHRvci5zZXQ7XG4gICAgICAgIG1ldGhvZERlc2NyaXB0b3Iuc2V0ID0gZnVuY3Rpb24odikge1xuICAgICAgICAgIGlmICh0eXBlb2YgdiA9PT0gJ3N0cmluZycgJiYgdi50b0xvd2VyQ2FzZSgpID09PSAnZGlhbG9nJykge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuc2V0QXR0cmlidXRlKCdtZXRob2QnLCB2KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIHJlYWxTZXQuY2FsbCh0aGlzLCB2KTtcbiAgICAgICAgfTtcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KEhUTUxGb3JtRWxlbWVudC5wcm90b3R5cGUsICdtZXRob2QnLCBtZXRob2REZXNjcmlwdG9yKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHbG9iYWwgJ2NsaWNrJyBoYW5kbGVyLCB0byBjYXB0dXJlIHRoZSA8aW5wdXQgdHlwZT1cInN1Ym1pdFwiPiBvciA8YnV0dG9uPiBlbGVtZW50IHdoaWNoIGhhc1xuICAgICAqIHN1Ym1pdHRlZCBhIDxmb3JtIG1ldGhvZD1cImRpYWxvZ1wiPi4gTmVlZGVkIGFzIFNhZmFyaSBhbmQgb3RoZXJzIGRvbid0IHJlcG9ydCB0aGlzIGluc2lkZVxuICAgICAqIGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQuXG4gICAgICovXG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBmdW5jdGlvbihldikge1xuICAgICAgZGlhbG9nUG9seWZpbGwuZm9ybVN1Ym1pdHRlciA9IG51bGw7XG4gICAgICBkaWFsb2dQb2x5ZmlsbC51c2VWYWx1ZSA9IG51bGw7XG4gICAgICBpZiAoZXYuZGVmYXVsdFByZXZlbnRlZCkgeyByZXR1cm47IH0gIC8vIGUuZy4gYSBzdWJtaXQgd2hpY2ggcHJldmVudHMgZGVmYXVsdCBzdWJtaXNzaW9uXG5cbiAgICAgIHZhciB0YXJnZXQgPSAvKiogQHR5cGUge0VsZW1lbnR9ICovIChldi50YXJnZXQpO1xuICAgICAgaWYgKCF0YXJnZXQgfHwgIWlzRm9ybU1ldGhvZERpYWxvZyh0YXJnZXQuZm9ybSkpIHsgcmV0dXJuOyB9XG5cbiAgICAgIHZhciB2YWxpZCA9ICh0YXJnZXQudHlwZSA9PT0gJ3N1Ym1pdCcgJiYgWydidXR0b24nLCAnaW5wdXQnXS5pbmRleE9mKHRhcmdldC5sb2NhbE5hbWUpID4gLTEpO1xuICAgICAgaWYgKCF2YWxpZCkge1xuICAgICAgICBpZiAoISh0YXJnZXQubG9jYWxOYW1lID09PSAnaW5wdXQnICYmIHRhcmdldC50eXBlID09PSAnaW1hZ2UnKSkgeyByZXR1cm47IH1cbiAgICAgICAgLy8gdGhpcyBpcyBhIDxpbnB1dCB0eXBlPVwiaW1hZ2VcIj4sIHdoaWNoIGNhbiBzdWJtaXQgZm9ybXNcbiAgICAgICAgZGlhbG9nUG9seWZpbGwudXNlVmFsdWUgPSBldi5vZmZzZXRYICsgJywnICsgZXYub2Zmc2V0WTtcbiAgICAgIH1cblxuICAgICAgdmFyIGRpYWxvZyA9IGZpbmROZWFyZXN0RGlhbG9nKHRhcmdldCk7XG4gICAgICBpZiAoIWRpYWxvZykgeyByZXR1cm47IH1cblxuICAgICAgZGlhbG9nUG9seWZpbGwuZm9ybVN1Ym1pdHRlciA9IHRhcmdldDtcbiAgICB9LCBmYWxzZSk7XG5cbiAgICAvKipcbiAgICAgKiBSZXBsYWNlIHRoZSBuYXRpdmUgSFRNTEZvcm1FbGVtZW50LnN1Ym1pdCgpIG1ldGhvZCwgYXMgaXQgd29uJ3QgZmlyZSB0aGVcbiAgICAgKiBzdWJtaXQgZXZlbnQgYW5kIGdpdmUgdXMgYSBjaGFuY2UgdG8gcmVzcG9uZC5cbiAgICAgKi9cbiAgICB2YXIgbmF0aXZlRm9ybVN1Ym1pdCA9IEhUTUxGb3JtRWxlbWVudC5wcm90b3R5cGUuc3VibWl0O1xuICAgIHZhciByZXBsYWNlbWVudEZvcm1TdWJtaXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICBpZiAoIWlzRm9ybU1ldGhvZERpYWxvZyh0aGlzKSkge1xuICAgICAgICByZXR1cm4gbmF0aXZlRm9ybVN1Ym1pdC5jYWxsKHRoaXMpO1xuICAgICAgfVxuICAgICAgdmFyIGRpYWxvZyA9IGZpbmROZWFyZXN0RGlhbG9nKHRoaXMpO1xuICAgICAgZGlhbG9nICYmIGRpYWxvZy5jbG9zZSgpO1xuICAgIH07XG4gICAgSFRNTEZvcm1FbGVtZW50LnByb3RvdHlwZS5zdWJtaXQgPSByZXBsYWNlbWVudEZvcm1TdWJtaXQ7XG5cbiAgICAvKipcbiAgICAgKiBHbG9iYWwgZm9ybSAnZGlhbG9nJyBtZXRob2QgaGFuZGxlci4gQ2xvc2VzIGEgZGlhbG9nIGNvcnJlY3RseSBvbiBzdWJtaXRcbiAgICAgKiBhbmQgcG9zc2libHkgc2V0cyBpdHMgcmV0dXJuIHZhbHVlLlxuICAgICAqL1xuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ3N1Ym1pdCcsIGZ1bmN0aW9uKGV2KSB7XG4gICAgICB2YXIgZm9ybSA9IC8qKiBAdHlwZSB7SFRNTEZvcm1FbGVtZW50fSAqLyAoZXYudGFyZ2V0KTtcbiAgICAgIGlmICghaXNGb3JtTWV0aG9kRGlhbG9nKGZvcm0pKSB7IHJldHVybjsgfVxuICAgICAgZXYucHJldmVudERlZmF1bHQoKTtcblxuICAgICAgdmFyIGRpYWxvZyA9IGZpbmROZWFyZXN0RGlhbG9nKGZvcm0pO1xuICAgICAgaWYgKCFkaWFsb2cpIHsgcmV0dXJuOyB9XG5cbiAgICAgIC8vIEZvcm1zIGNhbiBvbmx5IGJlIHN1Ym1pdHRlZCB2aWEgLnN1Ym1pdCgpIG9yIGEgY2xpY2sgKD8pLCBidXQgYW55d2F5OiBzYW5pdHktY2hlY2sgdGhhdFxuICAgICAgLy8gdGhlIHN1Ym1pdHRlciBpcyBjb3JyZWN0IGJlZm9yZSB1c2luZyBpdHMgdmFsdWUgYXMgLnJldHVyblZhbHVlLlxuICAgICAgdmFyIHMgPSBkaWFsb2dQb2x5ZmlsbC5mb3JtU3VibWl0dGVyO1xuICAgICAgaWYgKHMgJiYgcy5mb3JtID09PSBmb3JtKSB7XG4gICAgICAgIGRpYWxvZy5jbG9zZShkaWFsb2dQb2x5ZmlsbC51c2VWYWx1ZSB8fCBzLnZhbHVlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGRpYWxvZy5jbG9zZSgpO1xuICAgICAgfVxuICAgICAgZGlhbG9nUG9seWZpbGwuZm9ybVN1Ym1pdHRlciA9IG51bGw7XG4gICAgfSwgdHJ1ZSk7XG4gIH1cblxuICBkaWFsb2dQb2x5ZmlsbFsnZm9yY2VSZWdpc3RlckRpYWxvZyddID0gZGlhbG9nUG9seWZpbGwuZm9yY2VSZWdpc3RlckRpYWxvZztcbiAgZGlhbG9nUG9seWZpbGxbJ3JlZ2lzdGVyRGlhbG9nJ10gPSBkaWFsb2dQb2x5ZmlsbC5yZWdpc3RlckRpYWxvZztcblxuICBpZiAodHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiAnYW1kJyBpbiBkZWZpbmUpIHtcbiAgICAvLyBBTUQgc3VwcG9ydFxuICAgIGRlZmluZShmdW5jdGlvbigpIHsgcmV0dXJuIGRpYWxvZ1BvbHlmaWxsOyB9KTtcbiAgfSBlbHNlIGlmICh0eXBlb2YgbW9kdWxlID09PSAnb2JqZWN0JyAmJiB0eXBlb2YgbW9kdWxlWydleHBvcnRzJ10gPT09ICdvYmplY3QnKSB7XG4gICAgLy8gQ29tbW9uSlMgc3VwcG9ydFxuICAgIG1vZHVsZVsnZXhwb3J0cyddID0gZGlhbG9nUG9seWZpbGw7XG4gIH0gZWxzZSB7XG4gICAgLy8gYWxsIG90aGVyc1xuICAgIHdpbmRvd1snZGlhbG9nUG9seWZpbGwnXSA9IGRpYWxvZ1BvbHlmaWxsO1xuICB9XG59KSgpO1xuIiwiaW1wb3J0IGRpYWxvZ1BvbHlmaWxsIGZyb20gJ2RpYWxvZy1wb2x5ZmlsbCdcblxuY29uc3QgbGFuZyAgICAgID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignaHRtbCcpLmdldEF0dHJpYnV0ZSgnbGFuZycpXG5jb25zdCBpc0VuZ2xpc2ggPSBsYW5nID09PSAnZW4nXG5jb25zdCByYWYgICAgICAgPSB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lXG5cbi8vLy8vL1xuLy8gRElBTE9HXG4vLy8vLy9cblxuLy8tIGRpYWxvZyBoYW5kbGluZ1xuLy8tIHdpbmRvdy5jb25maXJtIGlzIHJhaXNpbmcgd2FybmluZ3MgaW4gY2hyb21l4oCmXG5jb25zdCBkaWFsb2cgICAgICA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5qcy1kaWFsb2ctY29uZmlybScpXG5pZiAoIWRpYWxvZy5zaG93TW9kYWwpIHtcbiAgZGlhbG9nUG9seWZpbGwucmVnaXN0ZXJEaWFsb2coZGlhbG9nKVxufVxuY29uc3QgdGl0bGUgICAgICAgPSBkaWFsb2cucXVlcnlTZWxlY3RvcignLmpzLWRpYWxvZy10aXRsZScpXG5jb25zdCBkZXNjcmlwdGlvbiA9IGRpYWxvZy5xdWVyeVNlbGVjdG9yKCcuanMtZGlhbG9nLWRlc2NyaXB0aW9uJylcbmxldCBjb25maXJtTGluayAgID0gZGlhbG9nLnF1ZXJ5U2VsZWN0b3IoJy5qcy1kaWFsb2ctY29uZmlybScpXG5jb25zdCBjYW5jZWxCdG4gICA9IGRpYWxvZy5xdWVyeVNlbGVjdG9yKCcuanMtZGlhbG9nLWNhbmNlbCcpXG5jYW5jZWxCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBfID0+IGRpYWxvZy5jbG9zZSgpIClcbmRpYWxvZy5hZGRFdmVudExpc3RlbmVyKCdjYW5jZWwnLCBfID0+IHJlc2V0RGlhbG9nKCkgKVxuZGlhbG9nLmFkZEV2ZW50TGlzdGVuZXIoJ2Nsb3NlJywgIF8gPT4gcmVzZXREaWFsb2coKSApXG5mdW5jdGlvbiByZXNldERpYWxvZygpIHtcbiAgdGl0bGUudGV4dENvbnRlbnQgICAgICAgPSAnJ1xuICBkZXNjcmlwdGlvbi50ZXh0Q29udGVudCA9ICcnXG4gIGNvbmZpcm1MaW5rLnNldEF0dHJpYnV0ZSgnaHJlZicsICcjJylcbiAgLy8tIGNsb25lIHRvIHJlbW92ZSBhbGwgZXZlbnQgbGlzdGVuZXJzXG4gIGNvbnN0IGNvbmZpcm1MaW5rQ2xvbmUgID0gY29uZmlybUxpbmsuY2xvbmVOb2RlKHRydWUpXG4gIGNvbmZpcm1MaW5rLnBhcmVudE5vZGUucmVwbGFjZUNoaWxkKGNvbmZpcm1MaW5rQ2xvbmUsIGNvbmZpcm1MaW5rKVxuICBjb25maXJtTGluayAgICAgICAgICAgICA9IGNvbmZpcm1MaW5rQ2xvbmVcbn1cbmZ1bmN0aW9uIG9wZW5EaWFsb2coIGRhdGFzICkge1xuICB0aXRsZS50ZXh0Q29udGVudCAgICAgICA9IGRhdGFzLnRpdGxlXG4gIGRlc2NyaXB0aW9uLnRleHRDb250ZW50ID0gZGF0YXMuZGVzY3JpcHRpb25cbiAgcmFmKCBfID0+IGRpYWxvZy5zaG93TW9kYWwoKSApXG59XG5cbi8vLy8vL1xuLy8gVEVNUExBVEVTXG4vLy8vLy9cblxuLy8tLS0tLSBkZWxldGVcblxuY29uc3QgZGVsZXRlQnV0dG9ucyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5qcy1kZWxldGUtdGVtcGxhdGUnKVxuYWRkTGlzdGVuZXJzKGRlbGV0ZUJ1dHRvbnMsICdjbGljaycsIGFza1RlbXBsYXRlRGVsZXRpb24pXG5mdW5jdGlvbiBhc2tUZW1wbGF0ZURlbGV0aW9uKGUpIHtcbiAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gIGNvbnN0IGxpbmsgICAgICAgICA9IGUuY3VycmVudFRhcmdldFxuICBjb25zdCB0ZW1wbGF0ZU5hbWUgPSBsaW5rLmRhdGFzZXQubmFtZVxuICBjb25maXJtTGluay5zZXRBdHRyaWJ1dGUoICdocmVmJywgbGluay5nZXRBdHRyaWJ1dGUoJ2hyZWYnKSApXG4gIG9wZW5EaWFsb2coIHtcbiAgICB0aXRsZTogICAgICAgICdEZWxldGUgdGVtcGxhdGUnLFxuICAgIGRlc2NyaXB0aW9uOiAgYGFyZSB5b3Ugc3VyZSB5b3Ugd2FudCB0byBkZWxldGUgJHt0ZW1wbGF0ZU5hbWV9P2AsXG4gIH0gKVxufVxuXG4vLy0tLS0tIGhhbmRsZSBub3RpZmljYXRpb25zXG5cbmNvbnN0IG5vdGlmaWNhdGlvbiA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNub3RpZmljYXRpb24nKVxuaWYgKG5vdGlmaWNhdGlvbikge1xuICB3aW5kb3cuc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgbm90aWZpY2F0aW9uLmNsYXNzTGlzdC5yZW1vdmUoJ21kbC1zbmFja2Jhci0tYWN0aXZlJylcbiAgfSwgMjcwMClcbn1cblxuLy8vLy8vXG4vLyBVU0VSU1xuLy8vLy8vXG5cbi8vLS0tLS0gUkVTRVRcblxuY29uc3QgcmVzZXRVc2VycyAgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcuanMtcmVzZXQtdXNlcicpXG5hZGRMaXN0ZW5lcnMocmVzZXRVc2VycywgJ2NsaWNrJywgYXNrVXNlclJlc2V0KVxuZnVuY3Rpb24gYXNrVXNlclJlc2V0KGUpIHtcbiAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gIGNvbnN0IGxpbmsgICAgICA9IGUuY3VycmVudFRhcmdldFxuICBjb25zdCB1c2VyTmFtZSAgPSBsaW5rLmRhdGFzZXQubmFtZVxuICBjb25maXJtTGluay5zZXRBdHRyaWJ1dGUoICdocmVmJywgbGluay5nZXRBdHRyaWJ1dGUoJ2hyZWYnKSApXG4gIG9wZW5EaWFsb2coIHtcbiAgICB0aXRsZTogICAgICAgIGlzRW5nbGlzaCA/ICdSZXNldCcgOiAnUsOpaW5pdGlhbGlzZXInLFxuICAgIGRlc2NyaXB0aW9uOiAgaXNFbmdsaXNoID8gYGFyZSB5b3Ugc3VyZSB5b3Ugd2FudCB0byByZXNldCAke3VzZXJOYW1lfSBwYXNzd29yZD9gIDogYMOqdGVzIHZvdXMgc8O7ciBkZSB2b3Vsb2lyIHLDqWluaXRpYWxpc2VyIGxlIG1vdCBkZSBwYXNzZSBkZSAgJHt1c2VyTmFtZX0gP2AsXG4gIH0gKVxufVxuXG4vLy0tLS0tIEFDVElWQVRFXG5cbmNvbnN0IGFjdGl2YXRlVXNlcnMgID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnLmpzLXVzZXItYWN0aXZhdGUnKVxuYWRkTGlzdGVuZXJzKGFjdGl2YXRlVXNlcnMsICdjbGljaycsIGFza1VzZXJBY3RpdmF0aW9uKVxuZnVuY3Rpb24gYXNrVXNlckFjdGl2YXRpb24oZSkge1xuICBlLnByZXZlbnREZWZhdWx0KClcbiAgY29uc3QgbGluayAgICAgID0gZS5jdXJyZW50VGFyZ2V0XG4gIGNvbnN0IHVzZXJOYW1lICA9IGxpbmsuZGF0YXNldC5uYW1lXG4gIGNvbmZpcm1MaW5rLnNldEF0dHJpYnV0ZSggJ2hyZWYnLCBsaW5rLmdldEF0dHJpYnV0ZSgnaHJlZicpIClcbiAgb3BlbkRpYWxvZygge1xuICAgIHRpdGxlOiAgICAgICAgaXNFbmdsaXNoID8gJ0FjdGl2YXRlJyA6ICdBY3RpdmVyJyxcbiAgICBkZXNjcmlwdGlvbjogIGlzRW5nbGlzaCA/IGBhcmUgeW91IHN1cmUgeW91IHdhbnQgdG8gYWN0aXZhdGUgJHt1c2VyTmFtZX0/YCA6IGDDqnRlcyB2b3VzIHPDu3IgZGUgdm91bG9pciBhY3RpdmVyICR7dXNlck5hbWV9ID9gLFxuICB9IClcbn1cblxuLy8tLS0tLSBERUFDVElWQVRFXG5cbmNvbnN0IGRlYWN0aXZhdGVVc2VycyAgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcuanMtdXNlci1kZWFjdGl2YXRlJylcbmFkZExpc3RlbmVycyhkZWFjdGl2YXRlVXNlcnMsICdjbGljaycsIGFza1VzZXJEZWFjdGl2YXRpb24pXG5mdW5jdGlvbiBhc2tVc2VyRGVhY3RpdmF0aW9uKGUpIHtcbiAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gIGNvbnN0IGxpbmsgICAgICA9IGUuY3VycmVudFRhcmdldFxuICBjb25zdCB1c2VyTmFtZSAgPSBsaW5rLmRhdGFzZXQubmFtZVxuICBjb25maXJtTGluay5zZXRBdHRyaWJ1dGUoICdocmVmJywgbGluay5nZXRBdHRyaWJ1dGUoJ2hyZWYnKSApXG4gIG9wZW5EaWFsb2coIHtcbiAgICB0aXRsZTogICAgICAgIGlzRW5nbGlzaCA/ICdEZWFjdGl2YXRlJyA6ICdEw6lzYWN0aXZlcicsXG4gICAgZGVzY3JpcHRpb246ICBpc0VuZ2xpc2ggPyBgYXJlIHlvdSBzdXJlIHlvdSB3YW50IHRvIGRlYWN0aXZhdGUgJHt1c2VyTmFtZX0/YCA6IGDDqnRlcyB2b3VzIHPDu3IgZGUgdm91bG9pciBkw6lzYWN0aXZlciAke3VzZXJOYW1lfSA/YCxcbiAgfSApXG59XG5cbi8vLy8vL1xuLy8gVVRJTFNcbi8vLy8vL1xuXG5mdW5jdGlvbiBhZGRMaXN0ZW5lcnMoIGVsZW1zLCBldmVudE5hbWUsIGNhbGxiYWNrICkge1xuICBpZiAoIWVsZW1zLmxlbmd0aCkgcmV0dXJuXG4gIDtbLi4uZWxlbXNdLmZvckVhY2goIGVsZW0gPT4gZWxlbS5hZGRFdmVudExpc3RlbmVyKCBldmVudE5hbWUsIGNhbGxiYWNrKSApXG59XG5cbmZ1bmN0aW9uIGdldFBhcmVudCggZWxlbSwgc2VsZWN0b3IgKSB7XG4gIGxldCBwYXJlbnQgPSBmYWxzZVxuICBmb3IgKCA7IGVsZW0gJiYgZWxlbSAhPT0gZG9jdW1lbnQ7IGVsZW0gPSBlbGVtLnBhcmVudE5vZGUgKSB7XG4gICAgaWYgKCBlbGVtLm1hdGNoZXMoIHNlbGVjdG9yICkgKSB7XG4gICAgICBwYXJlbnQgPSBlbGVtXG4gICAgICBicmVha1xuICAgIH1cbiAgfVxuICByZXR1cm4gcGFyZW50XG59XG4iXX0=
