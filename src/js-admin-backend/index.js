import dialogPolyfill from 'dialog-polyfill'

const lang      = document.querySelector('html').getAttribute('lang')
const isEnglish = lang === 'en'
const raf       = window.requestAnimationFrame

//////
// DIALOG
//////

//- dialog handling
//- window.confirm is raising warnings in chrome…
const dialog      = document.querySelector('.js-dialog-confirm')
if (!dialog.showModal) {
  dialogPolyfill.registerDialog(dialog)
}
const title       = dialog.querySelector('.js-dialog-title')
const description = dialog.querySelector('.js-dialog-description')
let confirmLink   = dialog.querySelector('.js-dialog-confirm')
const cancelBtn   = dialog.querySelector('.js-dialog-cancel')
cancelBtn.addEventListener('click', _ => dialog.close() )
dialog.addEventListener('cancel', _ => resetDialog() )
dialog.addEventListener('close',  _ => resetDialog() )
function resetDialog() {
  title.textContent       = ''
  description.textContent = ''
  confirmLink.setAttribute('href', '#')
  //- clone to remove all event listeners
  const confirmLinkClone  = confirmLink.cloneNode(true)
  confirmLink.parentNode.replaceChild(confirmLinkClone, confirmLink)
  confirmLink             = confirmLinkClone
}
function openDialog( datas ) {
  title.textContent       = datas.title
  description.textContent = datas.description
  raf( _ => dialog.showModal() )
}

//////
// TEMPLATES
//////

//----- delete

const deleteButtons = document.querySelectorAll('.js-delete-template')
addListeners(deleteButtons, 'click', askTemplateDeletion)
function askTemplateDeletion(e) {
  e.preventDefault()
  const link         = e.currentTarget
  const templateName = link.dataset.name
  confirmLink.setAttribute( 'href', link.getAttribute('href') )
  openDialog( {
    title:        'Delete template',
    description:  `are you sure you want to delete ${templateName}?`,
  } )
}

//----- handle notifications

const notification = document.querySelector('#notification')
if (notification) {
  window.setTimeout(function () {
    notification.classList.remove('mdl-snackbar--active')
  }, 2700)
}

//////
// USERS
//////

//----- RESET

const resetUsers  = document.querySelectorAll('.js-reset-user')
addListeners(resetUsers, 'click', askUserReset)
function askUserReset(e) {
  e.preventDefault()
  const link      = e.currentTarget
  const userName  = link.dataset.name
  confirmLink.setAttribute( 'href', link.getAttribute('href') )
  openDialog( {
    title:        isEnglish ? 'Reset' : 'Réinitialiser',
    description:  isEnglish ? `are you sure you want to reset ${userName} password?` : `êtes vous sûr de vouloir réinitialiser le mot de passe de  ${userName} ?`,
  } )
}

//----- ACTIVATE

const activateUsers  = document.querySelectorAll('.js-user-activate')
addListeners(activateUsers, 'click', askUserActivation)
function askUserActivation(e) {
  e.preventDefault()
  const link      = e.currentTarget
  const userName  = link.dataset.name
  confirmLink.setAttribute( 'href', link.getAttribute('href') )
  openDialog( {
    title:        isEnglish ? 'Activate' : 'Activer',
    description:  isEnglish ? `are you sure you want to activate ${userName}?` : `êtes vous sûr de vouloir activer ${userName} ?`,
  } )
}

//----- DEACTIVATE

const deactivateUsers  = document.querySelectorAll('.js-user-deactivate')
addListeners(deactivateUsers, 'click', askUserDeactivation)
function askUserDeactivation(e) {
  e.preventDefault()
  const link      = e.currentTarget
  const userName  = link.dataset.name
  confirmLink.setAttribute( 'href', link.getAttribute('href') )
  openDialog( {
    title:        isEnglish ? 'Deactivate' : 'Désactiver',
    description:  isEnglish ? `are you sure you want to deactivate ${userName}?` : `êtes vous sûr de vouloir désactiver ${userName} ?`,
  } )
}

//////
// UTILS
//////

function addListeners( elems, eventName, callback ) {
  if (!elems.length) return
  ;[...elems].forEach( elem => elem.addEventListener( eventName, callback) )
}

function getParent( elem, selector ) {
  let parent = false
  for ( ; elem && elem !== document; elem = elem.parentNode ) {
    if ( elem.matches( selector ) ) {
      parent = elem
      break
    }
  }
  return parent
}
