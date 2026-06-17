const KEY = 'flockops:data'
const LANG_KEY = 'flockops:lang'
const EXIT_DOWNLOAD_KEY = 'flockops:autoDownloadOnClose'
const AUTH_TOKEN_KEY = 'flockops:authToken'
const AUTH_USERNAME_KEY = 'flockops:authUsername'
const API_BASE = window.FLOCKOPS_API_BASE || 'https://flockops-hfyo.onrender.com'
const state = { paddocks: [], sheep: [], history: [], events: [], planningItems: [] }
const collapsedPaddockIds = new Set()
const expandedWeatherPaddocks = new Set()
const weatherCache = {}
const weatherLoading = new Set()
const WEATHER_TTL_MS = 60 * 60 * 1000
const PAYPAL_BILLING_CONFIG = {
  enabled: false,
  clientId: '',
  planId: '',
  currency: 'EUR'
}
let paypalSdkPromise = null
let pendingDeleteConfirm = null
let pendingInjectionPaddockId = null
let pendingInjectionZoneId = null
let pendingShearingPaddockId = null
let pendingShearingZoneId = null
let pendingInjectionSheepId = null
let pendingShearingSheepId = null
let pendingPlanningItemId = null
let pendingOutOfFlockSheepId = null
let hasTriggeredExitDownload = false
let reopenEmptyStorageModalAfterUpload = false
let hasInitializedPlanningFilters = false
let showAllOutOfFlockSheep = false
const MIN_SHEEP_BIRTH_DATE = '2000-01-01'
let authToken = null
let authUsername = null
let authFormMode = 'login'
let cloudSaveTimer = null
let pendingCloudState = null

const SEO_BY_LANG = {
  nl: {
    title: 'FlockOps | Schapenbeheer voor Weides en Zones',
    description: 'FlockOps is een snelle webapp voor schapenbeheer: weides, zones, verplaatsingen, historiek en lokale data-opslag met JSON export/import.',
    ogDescription: 'Beheer schapen, weides en zones in een snelle browserapp met historiek en JSON back-ups.',
    twitterDescription: 'Browsergebaseerde schapenbeheer app met zones, historiek en JSON back-ups.',
    structuredDescription: 'Webapp voor schapenbeheer met weides, zones, historiek en JSON import/export.',
    ogLocale: 'nl_BE'
  },
  en: {
    title: 'FlockOps | Sheep Management for Paddocks and Zones',
    description: 'FlockOps is a fast web app for sheep management: paddocks, zones, moves, history, and local storage with JSON export/import.',
    ogDescription: 'Manage sheep, paddocks, and zones in a fast browser app with history and JSON backups.',
    twitterDescription: 'Browser-based sheep management app with zones, history, and JSON backups.',
    structuredDescription: 'Web app for sheep management with paddocks, zones, history, and JSON import/export.',
    ogLocale: 'en_US'
  },
  fr: {
    title: 'FlockOps | Gestion des moutons par paturages et zones',
    description: 'FlockOps est une application web rapide pour la gestion des moutons: paturages, zones, deplacements, historique et stockage local avec export/import JSON.',
    ogDescription: 'Gerez moutons, paturages et zones dans une application navigateur rapide avec historique et sauvegardes JSON.',
    twitterDescription: 'Application de gestion des moutons dans le navigateur avec zones, historique et sauvegardes JSON.',
    structuredDescription: 'Application web pour la gestion des moutons avec paturages, zones, historique et import/export JSON.',
    ogLocale: 'fr_FR'
  }
}

const SEO_BASE_URL = 'https://bartgabriels.github.io/FlockOps/'
const SEO_HREFLANG_URLS = {
  nl: `${SEO_BASE_URL}?lang=nl`,
  en: `${SEO_BASE_URL}?lang=en`,
  fr: `${SEO_BASE_URL}?lang=fr`,
  'x-default': SEO_BASE_URL
}

function seoUrlForLang(lang){
  if(lang === 'en' || lang === 'fr') return `${SEO_BASE_URL}?lang=${lang}`
  return SEO_BASE_URL
}

function syncLanguageUrl(lang){
  try {
    const url = new URL(window.location.href)
    if(lang === 'nl') {
      url.searchParams.delete('lang')
    } else {
      url.searchParams.set('lang', lang)
    }
    window.history.replaceState({}, '', url.toString())
  } catch (error) {
    console.warn('Could not sync language query param:', error)
  }
}

const translations = window.FLOCKOPS_TRANSLATIONS || { nl: {} }
if(!window.FLOCKOPS_TRANSLATIONS){
  console.warn('Translations bundle not loaded; falling back to minimal dictionary')
}
let currentLang = (() => {
  try {
    const urlLang = new URLSearchParams(window.location.search).get('lang')
    if(urlLang && translations[urlLang]) return urlLang
    const saved = localStorage.getItem(LANG_KEY)
    return (saved && translations[saved]) ? saved : 'nl'
  } catch (e) {
    console.warn('localStorage not available, using default language')
    return 'nl'
  }
})()

function localeTag(){
  if(currentLang === 'en') return 'en-GB'
  if(currentLang === 'fr') return 'fr-FR'
  return 'nl-NL'
}

function t(key, params = {}){
  const base = translations[currentLang] || translations.nl
  const fallback = translations.nl
  const template = base[key] ?? fallback[key] ?? key
  return template.replace(/\{(\w+)\}/g, (_, name) => {
    const value = params[name]
    return value === undefined || value === null ? '' : String(value)
  })
}

function loadStoredAuth(){
  try {
    authToken = localStorage.getItem(AUTH_TOKEN_KEY)
    authUsername = localStorage.getItem(AUTH_USERNAME_KEY)
  } catch (error) {
    authToken = null
    authUsername = null
  }
}

function persistAuthSession(token, username){
  authToken = token
  authUsername = username
  try {
    localStorage.setItem(AUTH_TOKEN_KEY, token)
    localStorage.setItem(AUTH_USERNAME_KEY, username)
  } catch (error) {
    console.warn('Could not persist auth session to localStorage')
  }
  updateAuthUi()
}

function clearAuthSession(){
  authToken = null
  authUsername = null
  pendingCloudState = null
  if(cloudSaveTimer){
    clearTimeout(cloudSaveTimer)
    cloudSaveTimer = null
  }
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY)
    localStorage.removeItem(AUTH_USERNAME_KEY)
  } catch (error) {
    console.warn('Could not clear auth session from localStorage')
  }
  updateAuthUi()
}

function updateAuthUi(){
  const indicator = document.getElementById('auth-toggle-dot')
  const label = document.getElementById('auth-toggle-label')
  const userLabel = document.getElementById('auth-user-label')
  const userBlock = document.getElementById('auth-user-block')
  const toggleButton = document.getElementById('auth-toggle-btn')
  const profileBlock = document.getElementById('auth-profile-block')
  const profileToggleButton = document.getElementById('auth-profile-toggle-btn')
  const dropdown = document.getElementById('auth-profile-dropdown')
  const logoutMenuButton = document.getElementById('auth-logout-menu-btn')
  if(indicator){
    indicator.classList.toggle('is-online', !!authToken)
    indicator.classList.toggle('is-offline', !authToken)
  }
  if(label){
    label.textContent = t('auth.toggle.loginRegister')
  }
  if(userLabel){
    userLabel.textContent = authToken && authUsername ? authUsername : ''
  }
  if(userBlock){
    userBlock.classList.toggle('is-online', !!authToken)
  }
  if(toggleButton){
    toggleButton.style.display = authToken ? 'none' : 'inline-flex'
  }
  if(profileBlock){
    profileBlock.style.display = authToken ? 'inline-flex' : 'none'
  }
  if(profileToggleButton){
    profileToggleButton.style.display = authToken ? 'inline-flex' : 'none'
    profileToggleButton.setAttribute('aria-expanded', 'false')
  }
  if(dropdown){
    dropdown.classList.remove('is-open')
    dropdown.setAttribute('aria-hidden', 'true')
  }
  if(logoutMenuButton){
    logoutMenuButton.style.display = authToken ? 'inline-flex' : 'none'
  }
}

function setAuthFormMode(mode){
  authFormMode = mode === 'register' ? 'register' : 'login'
  const registerBtn = document.getElementById('auth-mode-register-btn')
  const loginBtn = document.getElementById('auth-mode-login-btn')
  const submitBtn = document.getElementById('auth-submit-btn')
  if(registerBtn){
    registerBtn.classList.toggle('is-active', authFormMode === 'register')
  }
  if(loginBtn){
    loginBtn.classList.toggle('is-active', authFormMode === 'login')
  }
  if(submitBtn){
    submitBtn.textContent = authFormMode === 'register' ? t('auth.register') : t('auth.login')
  }
}

function cloudStatePayload(){
  const sheepForStorage = state.sheep.map(sheep => ({
    ...sheep,
    injections: [],
    shearings: []
  }))
  return {
    ...state,
    history: [],
    sheep: sheepForStorage,
    planningItems: state.planningItems.filter(item => item && item.source === 'manual')
  }
}

async function apiFetch(path, options = {}){
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
  if(authToken){
    headers.Authorization = `Bearer ${authToken}`
  }
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  })
  let payload = null
  try {
    payload = await response.json()
  } catch (error) {
    payload = null
  }
  if(!response.ok){
    const message = payload?.message || `HTTP ${response.status}`
    throw new Error(message)
  }
  return payload
}

function setAuthStatusMessage(message, isError = false){
  const status = document.getElementById('auth-status-message')
  if(!status) return
  status.textContent = message || ''
  status.style.color = isError ? 'var(--error)' : 'var(--text-secondary)'
}

function openAuthModal(){
  if(authToken) return
  setAuthStatusMessage('')
  const emailInput = document.getElementById('auth-email')
  const passwordInput = document.getElementById('auth-password')
  setAuthFormMode('login')
  if(emailInput) emailInput.value = authUsername || ''
  if(passwordInput) passwordInput.value = ''
  openModal('auth-modal')
}

async function fetchCloudStateAndApply(){
  if(!authToken) return
  const result = await apiFetch('/state')
  if(result && result.data && typeof result.data === 'object'){
    hydrateState(result.data)
    save()
    render()
  }
}

function queueCloudSave(persistedState){
  if(!authToken) return
  pendingCloudState = persistedState
  if(cloudSaveTimer){
    clearTimeout(cloudSaveTimer)
  }
  cloudSaveTimer = setTimeout(async () => {
    const stateToSave = pendingCloudState
    pendingCloudState = null
    cloudSaveTimer = null
    try {
      await apiFetch('/state', {
        method: 'PUT',
        body: JSON.stringify({ data: stateToSave })
      })
    } catch (error) {
      console.warn('Cloud save failed:', error.message)
    }
  }, 700)
}

async function initializeCloudSession(){
  loadStoredAuth()
  updateAuthUi()
  if(!authToken) return
  try {
    await apiFetch('/auth/me')
    await fetchCloudStateAndApply()
  } catch (error) {
    clearAuthSession()
  }
}

function isPayPalBillingReady(){
  return PAYPAL_BILLING_CONFIG.enabled && !!PAYPAL_BILLING_CONFIG.clientId && !!PAYPAL_BILLING_CONFIG.planId
}

function loadPayPalSdk(){
  if(paypalSdkPromise) return paypalSdkPromise
  const src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(PAYPAL_BILLING_CONFIG.clientId)}&vault=true&intent=subscription&currency=${encodeURIComponent(PAYPAL_BILLING_CONFIG.currency)}`
  paypalSdkPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`)
    if(existing){
      if(window.paypal) {
        resolve(window.paypal)
        return
      }
      existing.addEventListener('load', () => resolve(window.paypal), { once: true })
      existing.addEventListener('error', reject, { once: true })
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.onload = () => resolve(window.paypal)
    script.onerror = reject
    document.head.appendChild(script)
  })
  return paypalSdkPromise
}

function renderPayPalBillingBlock(){
  const statusEl = document.getElementById('billing-paypal-status')
  const buttonEl = document.getElementById('billing-paypal-button')
  if(!statusEl || !buttonEl) return

  buttonEl.innerHTML = ''
  if(!isPayPalBillingReady()){
    statusEl.textContent = t('billing.paypal.unconfigured')
    statusEl.dataset.state = 'idle'
    return
  }

  statusEl.textContent = t('billing.paypal.ready')
  statusEl.dataset.state = 'ready'

  loadPayPalSdk()
    .then((paypal) => {
      if(!paypal?.Buttons) throw new Error('PayPal SDK unavailable')
      buttonEl.innerHTML = ''
      paypal.Buttons({
        style: {
          shape: 'pill',
          layout: 'vertical',
          label: 'subscribe'
        },
        createSubscription(data, actions){
          return actions.subscription.create({
            plan_id: PAYPAL_BILLING_CONFIG.planId
          })
        },
        onApprove(){
          statusEl.textContent = t('billing.paypal.approved')
          statusEl.dataset.state = 'approved'
        },
        onError(){
          statusEl.textContent = t('billing.paypal.error')
          statusEl.dataset.state = 'error'
        }
      }).render('#billing-paypal-button')
    })
    .catch(() => {
      statusEl.textContent = t('billing.paypal.error')
      statusEl.dataset.state = 'error'
    })
}

function setLanguage(lang){
  if(!translations[lang]) {
    console.warn(`Language ${lang} not available`)
    return
  }
  currentLang = lang
  try {
    localStorage.setItem(LANG_KEY, lang)
  } catch (e) {
    console.warn('Could not save language preference to localStorage')
  }
  syncLanguageUrl(lang)
  applyStaticTranslations()
  render()
}

function isAutoDownloadOnCloseEnabled(){
  try {
    return localStorage.getItem(EXIT_DOWNLOAD_KEY) === 'on'
  } catch (error) {
    return false
  }
}

function setAutoDownloadOnClose(enabled){
  const toggleButton = document.getElementById('exit-download-toggle-btn')
  if(toggleButton){
    toggleButton.setAttribute('aria-pressed', enabled ? 'true' : 'false')
  }
  const stateLabel = document.getElementById('exit-download-toggle-state')
  if(stateLabel){
    stateLabel.textContent = enabled ? t('ui.exitDownload.on') : t('ui.exitDownload.off')
  }
  try {
    localStorage.setItem(EXIT_DOWNLOAD_KEY, enabled ? 'on' : 'off')
  } catch (error) {
    console.warn('Could not save auto download preference to localStorage')
  }
}

function initAutoDownloadOnCloseToggle(){
  const toggleButton = document.getElementById('exit-download-toggle-btn')
  if(!toggleButton) return

  setAutoDownloadOnClose(isAutoDownloadOnCloseEnabled())

  toggleButton.addEventListener('click', () => {
    setAutoDownloadOnClose(!isAutoDownloadOnCloseEnabled())
  })
}

function recycleBinIcon(){
  return '<svg class="button-icon button-icon--delete" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M9 3a1 1 0 0 0-1 1v1H4.75a.75.75 0 0 0 0 1.5h.84l.82 10.31A2.25 2.25 0 0 0 8.64 19.5h6.72a2.25 2.25 0 0 0 2.23-1.69l.82-10.31h.84a.75.75 0 0 0 0-1.5H16V4a1 1 0 0 0-1-1H9zm1 2h4v0.5h-4V5zm-1.83 3.5a.75.75 0 0 1 .75.75v6.5a.75.75 0 0 1-1.5 0v-6.5a.75.75 0 0 1 .75-.75zm3.33 0a.75.75 0 0 1 .75.75v6.5a.75.75 0 0 1-1.5 0v-6.5a.75.75 0 0 1 .75-.75zm3.33 0a.75.75 0 0 1 .75.75v6.5a.75.75 0 0 1-1.5 0v-6.5a.75.75 0 0 1 .75-.75z"/></svg>'
}

function syringeIcon(iconClass = 'button-icon'){
  return `<img src="spuit.png" class="${iconClass}" alt="Spuit" />`
}

function scissorsIcon(iconClass = 'button-icon'){
  return `<img src="schaar.png" class="${iconClass}" alt="Schaar" />`
}

function calendarIcon(iconClass = 'button-icon'){
  return `<img src="calender.png" class="${iconClass}" alt="Calender" />`
}

function repeatIcon(iconClass = 'button-icon'){
  return `<img src="repeat.png" class="${iconClass}" alt="Repeat" />`
}

function isOutOfFlockSheep(sheep){
  return sheep && sheep.flockStatus === 'out'
}

function isActiveFlockSheep(sheep){
  return sheep && sheep.flockStatus !== 'out'
}

function outReasonLabel(reason){
  if(reason === 'slaughter') return t('sheep.out.reason.slaughter')
  if(reason === 'deceased') return t('sheep.out.reason.deceased')
  if(reason === 'sold') return t('sheep.out.reason.sold')
  return '-'
}

function outReasonIcon(reason){
  if(reason === 'slaughter') return '🔪'
  if(reason === 'deceased') return '✝'
  if(reason === 'sold') return '💰'
  return '•'
}

function escapeHtml(value){
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function doubleArrowIcon(){
  return '<svg class="button-icon button-icon--move" viewBox="0 0 1920 1920" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid meet"><g transform="translate(0,1920) scale(0.1,-0.1)"><path fill="currentColor" d="M12770 12920 c-19 -5 -45 -20 -57 -35 l-23 -26 0 -412 0 -412 -753 0 c-898 0 -844 6 -1231 -135 -71 -26 -157 -69 -209 -104 -21 -14 -42 -26 -47 -26 -6 0 -10 -4 -10 -10 0 -5 -5 -10 -10 -10 -12 0 -113 -77 -204 -155 -53 -44 -320 -331 -522 -559 -40 -45 -81 -88 -93 -96 -12 -8 -21 -18 -21 -23 0 -5 -19 -28 -42 -51 -24 -23 -62 -64 -86 -91 -24 -28 -81 -90 -128 -140 -46 -49 -461 -506 -921 -1015 -517 -570 -872 -954 -928 -1002 -238 -206 -534 -364 -845 -452 -269 -76 -289 -78 -1025 -85 l-660 -7 -64 -28 c-122 -53 -197 -120 -251 -226 -43 -86 -60 -155 -60 -251 0 -204 108 -380 285 -464 39 -18 77 -34 85 -35 8 -1 287 -5 620 -7 838 -6 1000 7 1352 107 79 22 152 45 163 50 18 9 56 23 250 95 86 31 183 82 358 186 270 162 439 293 643 501 72 73 542 588 1045 1143 502 556 935 1032 961 1059 26 27 48 51 48 55 0 3 20 26 44 51 141 145 175 181 216 230 48 58 68 79 224 238 84 85 112 107 191 146 166 84 175 85 953 88 l672 3 0 -408 c0 -261 4 -415 10 -428 17 -30 64 -49 126 -49 47 0 66 5 98 27 23 16 43 31 46 34 6 7 230 184 480 379 95 74 243 191 329 260 86 69 167 133 181 142 14 9 37 27 52 40 14 13 37 32 49 43 36 31 322 256 447 351 102 79 112 89 112 119 0 29 -11 41 -127 132 -263 205 -418 327 -429 337 -22 22 -100 86 -131 108 -18 13 -106 81 -195 152 -535 426 -811 640 -848 658 -37 19 -64 21 -120 8z"/><path fill="currentColor" d="M5009 12135 c-3 -2 -21 -5 -40 -6 -18 -1 -65 -17 -104 -35 -260 -122 -362 -445 -225 -714 54 -106 129 -173 251 -226 l64 -28 655 -6 c622 -6 662 -7 785 -29 405 -71 777 -243 1075 -496 79 -67 116 -105 259 -259 l54 -58 66 73 c36 40 89 97 116 126 28 28 63 67 79 85 16 18 62 69 103 113 41 44 93 101 116 126 23 25 80 87 127 138 47 51 87 97 89 102 5 17 -266 284 -389 383 -148 120 -211 163 -397 275 -175 104 -272 155 -358 186 -194 72 -232 86 -250 95 -38 19 -306 91 -408 111 -104 19 -121 21 -332 39 -118 10 -1327 15 -1336 5z"/><path fill="currentColor" d="M12738 9054 c-15 -8 -32 -23 -38 -34 -6 -12 -10 -167 -10 -427 l0 -408 -672 3 c-778 3 -787 4 -953 88 -79 39 -107 61 -191 146 -156 159 -176 180 -224 238 -25 29 -72 82 -105 115 -33 34 -77 81 -98 103 -20 23 -39 42 -41 42 -2 0 -102 -108 -221 -240 -119 -132 -221 -240 -225 -240 -4 0 -11 -9 -16 -19 -5 -11 -54 -68 -108 -126 -145 -154 -140 -129 -43 -232 45 -48 148 -160 229 -248 80 -89 172 -183 204 -211 91 -77 192 -154 204 -154 5 0 10 -4 10 -10 0 -5 4 -10 10 -10 5 0 26 -12 47 -26 52 -35 138 -78 209 -104 173 -63 270 -93 369 -113 108 -22 123 -22 862 -22 l753 0 0 -413 0 -414 28 -28 c36 -35 113 -48 163 -27 35 15 275 200 857 663 89 71 177 139 195 152 31 22 109 86 131 108 11 10 166 132 429 337 116 91 127 103 127 132 0 30 -10 40 -112 119 -125 95 -411 320 -447 351 -12 11 -35 30 -49 43 -15 13 -38 31 -52 40 -14 9 -81 62 -150 118 -69 55 -154 123 -190 151 -120 92 -645 506 -650 512 -3 3 -23 18 -46 34 -33 22 -51 27 -100 27 -32 -1 -71 -7 -86 -16z"/></g></svg>'
}

function openDeleteConfirm(kind, details = {}){
  pendingDeleteConfirm = { kind, details }
  const titleEl = document.getElementById('delete-confirm-title')
  const messageEl = document.getElementById('delete-confirm-message')
  const submitEl = document.getElementById('delete-confirm-submit')

  if(titleEl) titleEl.textContent = kind === 'sheep' ? t('aria.deleteSheep') : kind === 'zone' ? t('aria.deleteZone') : t('aria.deletePaddock')
  if(messageEl) messageEl.textContent = details.message || ''
  if(submitEl) submitEl.textContent = details.confirmLabel || t('actions.delete')

  openModal('delete-confirm-modal')
}

function openSheepOutOfFlockModal(sheepId){
  const sheep = state.sheep.find(s => s.id === sheepId)
  if(!sheep || isOutOfFlockSheep(sheep)) return
  pendingOutOfFlockSheepId = sheepId

  const sheepNameEl = document.getElementById('sheep-out-modal-sheep-name')
  const reasonInput = document.getElementById('sheep-out-modal-reason')
  const dateInput = document.getElementById('sheep-out-modal-date')
  const notesInput = document.getElementById('sheep-out-modal-notes')
  if(sheepNameEl) sheepNameEl.textContent = sheep.tag
  if(reasonInput) reasonInput.value = 'sold'
  if(dateInput) dateInput.value = todayIso()
  if(notesInput) notesInput.value = ''

  openModal('sheep-out-modal')
}

function closeSheepOutOfFlockModal(){
  pendingOutOfFlockSheepId = null
  closeModal('sheep-out-modal')
}

function moveSheepOutOfFlock(reason, date, notes = ''){
  if(!pendingOutOfFlockSheepId) return
  const sheep = state.sheep.find(s => s.id === pendingOutOfFlockSheepId)
  if(!sheep || isOutOfFlockSheep(sheep)) return

  const fromPaddockId = sheep.paddockId || null
  const fromZoneId = sheep.zoneId || null
  const normalizedNotes = typeof notes === 'string' && notes.trim() ? notes.trim() : null
  sheep.flockStatus = 'out'
  sheep.outReason = reason
  sheep.outDate = date
  sheep.outNotes = normalizedNotes
  sheep.outHidden = false
  sheep.outFromPaddockId = fromPaddockId
  sheep.outFromZoneId = fromZoneId
  sheep.paddockId = null
  sheep.zoneId = null
  sheep.lastUpdated = Date.now()

  addEvent('SHEEP_REMOVED_FROM_FLOCK', {
    sheepId: sheep.id,
    tag: sheep.tag,
    reason,
    date,
    notes: normalizedNotes,
    fromPaddockId,
    fromZoneId
  })

  save(); render(); closeSheepOutOfFlockModal()
}

function closeDeleteConfirmModal(){
  pendingDeleteConfirm = null
  closeModal('delete-confirm-modal')
}

function executeDeleteConfirmed(){
  if(!pendingDeleteConfirm) return
  const { kind, details } = pendingDeleteConfirm
  closeDeleteConfirmModal()

  if(kind === 'sheep'){
    const sheepId = details.sheepId
    if(!sheepId) return
    openSheepOutOfFlockModal(sheepId)
    return
  }

  if(kind === 'zone'){
    const paddockId = details.paddockId
    const zoneId = details.zoneId
    const paddock = getPaddock(paddockId)
    const zone = getZone(paddockId, zoneId)
    if(!paddock || !zone) return
    const sheepInZone = state.sheep.filter(s => isActiveFlockSheep(s) && s.paddockId === paddockId && s.zoneId === zoneId)
    if(sheepInZone.length){
      openZoneDeleteMoveModal(paddockId, zoneId, sheepInZone.length)
      return
    }
    paddock.zones = paddock.zones.filter(z => z.id !== zoneId)
    addEvent('ZONE_DELETED', {
      zoneId,
      paddockId,
      name: zone.name
    })
    save(); render()
    return
  }

  if(kind === 'paddock'){
    const paddockId = details.paddockId
    const paddock = getPaddock(paddockId)
    if(!paddock) return
    const sheepInPaddock = state.sheep.filter(s => isActiveFlockSheep(s) && s.paddockId === paddockId)
    if(sheepInPaddock.length){
      openPaddockDeleteMoveModal(paddockId, sheepInPaddock.length)
      return
    }
    state.paddocks = state.paddocks.filter(p => p.id !== paddockId)
    collapsedPaddockIds.delete(paddockId)
    expandedWeatherPaddocks.delete(paddockId)
    addEvent('PADDOCK_DELETED', {
      paddockId,
      name: paddock.name
    })
    save(); render()
  }
}

function applyStaticTranslations(){
  document.documentElement.lang = currentLang
  applySeoMetadata()
  const setText = (id, value) => {
    const el = document.getElementById(id)
    if(el) el.textContent = value
  }
  const setButtonLabel = (id, value) => {
    const el = document.getElementById(id)
    if(!el) return
    el.setAttribute('aria-label', value)
    el.setAttribute('title', value)
  }
  const setIconButton = (id, label) => {
    const el = document.getElementById(id)
    if(!el) return
    el.classList.add('icon-button')
    el.innerHTML = '<svg class="button-icon button-icon--save" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M5 3h10.5L19 6.5V21H5V3zm2 2v14h10V7.3L14.7 5H7zm1 1h5v3H8V6zm0 8h8v4H8v-4z"/></svg>'
    el.setAttribute('aria-label', label)
    el.setAttribute('title', label)
  }
  const setPlaceholder = (id, value) => {
    const el = document.getElementById(id)
    if(el) el.setAttribute('placeholder', value)
  }

  setText('app-title', t('app.title'))
  setText('app-subtitle', t('app.subtitle'))
  setText('download-data-btn', t('ui.save'))
  setText('upload-data-btn', t('ui.upload'))
  setText('clear-data-btn', t('ui.clear'))
  setText('auth-toggle-label', t('auth.toggle.loginRegister'))
  setText('auth-modal-title', t('auth.modal.title'))
  setText('auth-email-label', t('auth.email'))
  setText('auth-password-label', t('auth.password'))
  setText('auth-mode-register-btn', t('auth.mode.register'))
  setText('auth-mode-login-btn', t('auth.mode.login'))
  setText('auth-submit-btn', authFormMode === 'register' ? t('auth.register') : t('auth.login'))
  setText('auth-logout-menu-btn', t('auth.toggle.logout'))
  setButtonLabel('actions-menu-toggle-btn', t('ui.menu'))
  setText('exit-download-toggle-label', t('ui.exitDownload.label'))
  setAutoDownloadOnClose(isAutoDownloadOnCloseEnabled())
  setText('empty-storage-modal-title', t('onboarding.empty.title'))
  setText('empty-storage-modal-description', t('onboarding.empty.description'))
  setText('empty-storage-start-zero', t('onboarding.empty.startZero'))
  setText('empty-storage-upload-config', t('onboarding.empty.uploadConfig'))
  setText('empty-storage-upload-dummy', t('onboarding.empty.uploadDummy'))
  setText('tab-paddocks-btn', t('tab.paddocksZones'))
  setText('tab-sheep-btn', t('tab.sheep'))
  setText('tab-history-btn', t('tab.history'))
  setText('tab-pedigree-btn', t('tab.pedigree'))
  setText('tab-billing-btn', t('tab.billing'))
  setText('section-paddocks-title', t('section.paddocks'))
  setText('section-sheep-title', t('sheep.active.title'))
  setText('section-history-title', t('section.history'))
  setText('section-planning-title', t('section.planning'))
  setText('section-pedigree-title', t('section.pedigree'))
  setText('section-billing-title', t('section.billing'))
  setText('planning-filter-period-label', t('planning.filter.period'))
  setText('planning-filter-paddock-label', t('planning.filter.paddock'))
  setText('planning-filter-sheep-label', t('planning.filter.sheep'))
  setText('planning-filter-period-option-30', t('planning.filter.period.30'))
  setText('planning-filter-period-option-90', t('planning.filter.period.90'))
  setText('planning-filter-period-option-all', t('planning.filter.period.all'))
  setText('planning-add-btn', t('planning.add'))
  setText('planning-item-modal-title', t('planning.add.title'))
  setText('planning-item-type-label', t('planning.add.type'))
  setText('planning-item-type-option-injection', t('planning.add.type.injection'))
  setText('planning-item-type-option-shearing', t('planning.add.type.shearing'))
  setText('planning-item-type-option-custom', t('planning.add.type.custom'))
  setText('planning-item-sheep-label', t('planning.add.sheep'))
  setText('planning-item-paddock-label', t('planning.add.paddock'))
  setText('planning-item-zone-label', t('planning.add.zone'))
  setText('planning-item-select-all-btn', t('planning.add.selectAll'))
  setText('planning-item-select-all-paddocks-btn', t('planning.add.selectAllPaddocks'))
  setText('planning-item-select-all-zones-btn', t('planning.add.selectAllZones'))
  setText('planning-item-date-label', t('planning.add.date'))
  setText('planning-item-repeat-date-label', t('planning.add.repeatDate'))
  setText('planning-item-detail-label', t('planning.add.detail'))
  setPlaceholder('planning-item-detail', t('planning.add.detailPlaceholder'))
  setPlaceholder('auth-email', t('auth.emailPlaceholder'))
  setPlaceholder('auth-password', t('auth.passwordPlaceholder'))
  setIconButton('planning-item-submit', t('ui.add'))
  updateAuthUi()

  setText('sheep-modal-title', t('sheep.add.title'))
  setPlaceholder('sheep-modal-tag', t('sheep.add.tagPlaceholder'))
  setPlaceholder('sheep-modal-earmark', t('sheep.add.earmarkPlaceholder'))
  setText('sheep-modal-birth-date-label', t('sheep.birthDateLabel'))
  setText('sheep-modal-gender-label', t('sheep.genderLabel'))
  setText('sheep-modal-gender-female-label', t('sheep.gender.female'))
  setText('sheep-modal-gender-male-label', t('sheep.gender.male'))
  setText('sheep-modal-pedigree-label', t('sheep.pedigreeLabel'))
  setText('sheep-modal-location-label', t('sheep.locationLabel'))
  setText('sheep-modal-notes-label', t('sheep.notes.label'))
  setPlaceholder('sheep-modal-notes', t('sheep.notes.placeholder'))
  setIconButton('sheep-modal-submit', t('sheep.add.submit'))

  setText('sheep-out-modal-title', t('sheep.out.modal.title'))
  setText('sheep-out-modal-sheep-label', t('injection.sheepLabel'))
  setText('sheep-out-modal-reason-label', t('sheep.out.modal.reason'))
  setText('sheep-out-modal-date-label', t('sheep.out.modal.date'))
  setText('sheep-out-modal-notes-label', t('sheep.out.modal.notes'))
  setPlaceholder('sheep-out-modal-notes', t('sheep.out.modal.notesPlaceholder'))
  setText('sheep-out-reason-option-slaughter', t('sheep.out.reason.slaughter'))
  setText('sheep-out-reason-option-deceased', t('sheep.out.reason.deceased'))
  setText('sheep-out-reason-option-sold', t('sheep.out.reason.sold'))
  setIconButton('sheep-out-modal-submit', t('ui.save'))

  setText('sheep-edit-modal-title', t('sheep.edit.title'))
  setPlaceholder('sheep-tag-edit-input', t('sheep.edit.tagPlaceholder'))
  setText('sheep-edit-earmark-label', t('sheep.edit.earmarkLabel'))
  setPlaceholder('sheep-edit-earmark-input', t('sheep.edit.earmarkPlaceholder'))
  setText('sheep-edit-birth-date-label', t('sheep.birthDateLabel'))
  setText('sheep-edit-gender-label', t('sheep.genderLabel'))
  setText('sheep-edit-pedigree-label', t('sheep.pedigreeLabel'))
  setText('sheep-edit-location-label', t('sheep.locationLabel'))
  setText('sheep-edit-notes-label', t('sheep.notes.label'))
  setPlaceholder('sheep-edit-notes', t('sheep.notes.placeholder'))
  setIconButton('sheep-edit-modal-submit', t('sheep.edit.submit'))

  // Paddock modals
  setText('paddock-modal-title', t('paddock.add.title'))
  setPlaceholder('paddock-modal-name', t('paddock.namePlaceholder'))
  setPlaceholder('paddock-modal-postcode', t('paddock.postcodePlaceholder'))
  setText('paddock-modal-notes-label', t('paddock.notes.label'))
  setPlaceholder('paddock-modal-notes', t('paddock.notes.placeholder'))
  setIconButton('paddock-modal-submit', t('ui.add'))
  
  setText('paddock-edit-modal-title', t('paddock.edit.title'))
  setPlaceholder('paddock-edit-name', t('paddock.namePlaceholder'))
  setPlaceholder('paddock-edit-postcode', t('paddock.postcodePlaceholder'))
  setText('paddock-edit-notes-label', t('paddock.notes.label'))
  setPlaceholder('paddock-edit-notes', t('paddock.notes.placeholder'))
  setIconButton('paddock-edit-submit', t('ui.save'))

  setText('paddock-injection-modal-title', t('injection.title'))
  setText('paddock-injection-paddock-label', t('injection.paddockLabel'))
  setText('paddock-injection-date-label', t('injection.dateLabel'))
  setText('paddock-injection-product-label', t('injection.productLabel'))
  setPlaceholder('paddock-injection-product', t('injection.productPlaceholder'))
  setText('paddock-injection-repeat-label', t('injection.repeatLabel'))
  setText('paddock-injection-no-repeat-label', t('injection.noRepeatLabel'))
  setText('paddock-injection-sheep-list-label', t('injection.sheepListLabel'))
  setIconButton('paddock-injection-submit', t('injection.submit'))

  setText('paddock-shearing-modal-title', t('shearing.title'))
  setText('paddock-shearing-paddock-label', t('shearing.paddockLabel'))
  setText('paddock-shearing-sheep-list-label', t('shearing.sheepListLabel'))
  setText('paddock-shearing-date-label', t('shearing.dateLabel'))
  setIconButton('paddock-shearing-submit', t('shearing.submit'))

  setText('sheep-injection-modal-title', t('injection.sheepTitle'))
  setText('sheep-injection-sheep-label', t('injection.sheepLabel'))
  setText('sheep-injection-date-label', t('injection.dateLabel'))
  setText('sheep-injection-product-label', t('injection.productLabel'))
  setPlaceholder('sheep-injection-product', t('injection.productPlaceholder'))
  setText('sheep-injection-repeat-label', t('injection.repeatLabel'))
  setText('sheep-injection-no-repeat-label', t('injection.noRepeatLabel'))
  setIconButton('sheep-injection-submit', t('injection.submit'))

  setText('sheep-shearing-modal-title', t('shearing.sheepTitle'))
  setText('sheep-shearing-sheep-label', t('shearing.sheepLabel'))
  setText('sheep-shearing-date-label', t('shearing.dateLabel'))
  setIconButton('sheep-shearing-submit', t('shearing.submit'))

  // Zone modals
  setText('zone-modal-title', t('zone.add.title'))
  setPlaceholder('zone-modal-name', t('zone.namePlaceholder'))
  setPlaceholder('zone-modal-area', t('zone.areaPlaceholderWithUnit'))
  setPlaceholder('zone-modal-perimeter', t('zone.add.perimeterPlaceholder'))
  setText('zone-modal-notes-label', t('zone.notes.label'))
  setPlaceholder('zone-modal-notes', t('zone.notes.placeholder'))
  setIconButton('zone-modal-submit', t('ui.add'))

  setText('zone-edit-modal-title', t('zone.edit.title'))
  setPlaceholder('zone-edit-name', t('zone.namePlaceholder'))
  setPlaceholder('zone-edit-area', t('zone.edit.areaPlaceholder'))
  setPlaceholder('zone-edit-perimeter', t('zone.edit.perimeterPlaceholder'))
  setText('zone-edit-notes-label', t('zone.notes.label'))
  setPlaceholder('zone-edit-notes', t('zone.notes.placeholder'))
  setIconButton('zone-edit-submit', t('ui.save'))

  // Move modals
  setText('move-modal-title', t('move.title'))
  setText('zone-bulk-move-modal-title', t('move.bulkTitle'))
  setText('zone-delete-move-modal-title', t('move.deleteZoneTitle'))
  setText('paddock-delete-move-modal-title', t('move.deletePaddockTitle'))
  setIconButton('move-modal-submit', t('move.submit'))

  const langSelect = document.getElementById('language-select')
  if(langSelect) langSelect.value = currentLang
}

function applySeoMetadata(){
  const seo = SEO_BY_LANG[currentLang] || SEO_BY_LANG.nl
  const canonicalUrl = seoUrlForLang(currentLang)
  document.title = seo.title

  const setMeta = (selector, content) => {
    const el = document.querySelector(selector)
    if(el) el.setAttribute('content', content)
  }

  const setLink = (selector, href) => {
    const el = document.querySelector(selector)
    if(el) el.setAttribute('href', href)
  }

  setMeta('meta[name="description"]', seo.description)
  setMeta('meta[property="og:title"]', seo.title)
  setMeta('meta[property="og:description"]', seo.ogDescription)
  setMeta('meta[property="og:locale"]', seo.ogLocale)
  setMeta('meta[property="og:url"]', canonicalUrl)
  setMeta('meta[name="twitter:title"]', seo.title)
  setMeta('meta[name="twitter:description"]', seo.twitterDescription)

  setLink('link[rel="canonical"]', canonicalUrl)
  setLink('link[rel="alternate"][hreflang="nl"]', SEO_HREFLANG_URLS.nl)
  setLink('link[rel="alternate"][hreflang="en"]', SEO_HREFLANG_URLS.en)
  setLink('link[rel="alternate"][hreflang="fr"]', SEO_HREFLANG_URLS.fr)
  setLink('link[rel="alternate"][hreflang="x-default"]', SEO_HREFLANG_URLS['x-default'])

  const structuredDataEl = document.getElementById('seo-structured-data')
  if(structuredDataEl){
    try {
      const data = JSON.parse(structuredDataEl.textContent || '{}')
      data.description = seo.structuredDescription
      data.url = canonicalUrl
      data.inLanguage = currentLang
      structuredDataEl.textContent = JSON.stringify(data)
    } catch (error) {
      console.warn('Unable to update structured SEO data:', error)
    }
  }
}

function initLanguageSelector(){
  const langSelect = document.getElementById('language-select')
  if(!langSelect){
    console.warn('Language selector element not found')
    return
  }
  langSelect.value = currentLang
  langSelect.addEventListener('change', (e) => {
    const newLang = e.target.value
    setLanguage(newLang)
  })
}

function initActionsMenu(){
  const menuRoot = document.getElementById('actions-menu')
  const toggleButton = document.getElementById('actions-menu-toggle-btn')
  const menuPanel = document.getElementById('actions-menu-panel')
  if(!menuRoot || !toggleButton || !menuPanel) return

  const closeMenu = () => {
    menuPanel.classList.remove('is-open')
    menuPanel.setAttribute('aria-hidden', 'true')
    toggleButton.setAttribute('aria-expanded', 'false')
  }

  const openMenu = () => {
    menuPanel.classList.add('is-open')
    menuPanel.setAttribute('aria-hidden', 'false')
    toggleButton.setAttribute('aria-expanded', 'true')
  }

  toggleButton.addEventListener('click', (event) => {
    event.preventDefault()
    if(menuPanel.classList.contains('is-open')){
      closeMenu()
    } else {
      openMenu()
    }
  })

  document.addEventListener('click', (event) => {
    if(menuRoot.contains(event.target)) return
    closeMenu()
  })

  document.addEventListener('keydown', (event) => {
    if(event.key !== 'Escape') return
    closeMenu()
  })

  menuPanel.addEventListener('click', (event) => {
    const clickedButton = event.target.closest('button')
    if(clickedButton) closeMenu()
  })
}

function initAuthProfileMenu(){
  const profileBlock = document.getElementById('auth-profile-block')
  const profileToggleButton = document.getElementById('auth-profile-toggle-btn')
  const dropdown = document.getElementById('auth-profile-dropdown')
  if(!profileBlock || !profileToggleButton || !dropdown) return

  const closeDropdown = () => {
    dropdown.classList.remove('is-open')
    dropdown.setAttribute('aria-hidden', 'true')
    profileToggleButton.setAttribute('aria-expanded', 'false')
  }

  const openDropdown = () => {
    dropdown.classList.add('is-open')
    dropdown.setAttribute('aria-hidden', 'false')
    profileToggleButton.setAttribute('aria-expanded', 'true')
  }

  profileToggleButton.addEventListener('click', (event) => {
    event.preventDefault()
    if(dropdown.classList.contains('is-open')){
      closeDropdown()
    } else {
      openDropdown()
    }
  })

  document.addEventListener('click', (event) => {
    if(profileBlock.contains(event.target)) return
    closeDropdown()
  })

  document.addEventListener('keydown', (event) => {
    if(event.key !== 'Escape') return
    closeDropdown()
  })
}

function initTabs(){
  const tabButtons = Array.from(document.querySelectorAll('.tab-button[data-tab]'))
  const panels = {
    paddocks: document.getElementById('tab-paddocks-panel'),
    sheep: document.getElementById('tab-sheep-panel'),
    history: document.getElementById('tab-history-panel'),
    planning: document.getElementById('tab-planning-panel'),
    pedigree: document.getElementById('tab-pedigree-panel'),
    billing: document.getElementById('tab-billing-panel')
  }
  if(!tabButtons.length || !panels.paddocks || !panels.sheep || !panels.history || !panels.planning || !panels.pedigree || !panels.billing) return

  const setActiveTab = (tab) => {
    const nextTab = panels[tab] ? tab : 'paddocks'

    Object.entries(panels).forEach(([name, panel]) => {
      panel.classList.toggle('hidden', name !== nextTab)
    })

    tabButtons.forEach(btn => {
      const active = btn.dataset.tab === nextTab
      btn.classList.toggle('is-active', active)
      btn.setAttribute('aria-selected', active ? 'true' : 'false')
    })
  }

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => setActiveTab(btn.dataset.tab))
  })

  const appTitle = document.getElementById('app-title')
  if(appTitle){
    appTitle.addEventListener('click', () => setActiveTab('billing'))
    appTitle.addEventListener('keydown', (event) => {
      if(event.key !== 'Enter' && event.key !== ' ') return
      event.preventDefault()
      setActiveTab('billing')
    })
  }

  setActiveTab('paddocks')
}

function detectPostcodeCountry(postcode){
  const normalized = postcode.trim().toUpperCase().replace(/\s+/g, '')
  if(/^\d{4}$/.test(normalized)) return 'BE'
  if(/^\d{5}$/.test(normalized)) return 'FR'
  if(/^\d{4}[A-Z]{2}$/.test(normalized)) return 'NL'
  return null
}

function weatherLabel(code){
  if(code === 0) return t('weather.sunny')
  if(code >= 1 && code <= 2) return t('weather.partlyCloudy')
  if(code === 3) return t('weather.cloudy')
  if(code >= 45 && code <= 48) return t('weather.fog')
  if((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return t('weather.rain')
  if((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return t('weather.snow')
  if(code >= 95) return t('weather.thunderstorm')
  return t('weather.variable')
}

function formatForecastDay(dateString){
  return new Date(`${dateString}T12:00:00`).toLocaleDateString(localeTag(), {
    weekday: 'short', day: '2-digit', month: '2-digit'
  })
}

async function fetchJson(url){
  const response = await fetch(url)
  if(!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
}

async function resolveCoordinatesViaNominatim(postcode, country){
  const normalizedPostcode = postcode.trim().toUpperCase().replace(/\s+/g, '')
  const url = `https://nominatim.openstreetmap.org/search?countrycodes=${country.toLowerCase()}&postalcode=${encodeURIComponent(normalizedPostcode)}&format=jsonv2&limit=1`
  const data = await fetchJson(url)
  if(Array.isArray(data) && data.length){
    const place = data[0]
    const lat = Number(place.lat)
    const lon = Number(place.lon)
    if(Number.isFinite(lat) && Number.isFinite(lon)){
      return { lat, lon, country, place: place.name || place.display_name || normalizedPostcode }
    }
  }
  throw new Error(t('alert.postcodeNotFound'))
}

async function resolveCoordinatesByPostcode(postcode){
  const country = detectPostcodeCountry(postcode)
  if(!country) throw new Error(t('alert.postcodeFormatUnknown'))

  const normalizedPostcode = country === 'NL'
    ? postcode.trim().toUpperCase().replace(/\s+/g, '')
    : postcode.trim()

  try {
    const url = `https://api.zippopotam.us/${country}/${encodeURIComponent(normalizedPostcode)}`
    const data = await fetchJson(url)
    if(Array.isArray(data.places) && data.places.length){
      const place = data.places[0]
      const lat = Number(place.latitude)
      const lon = Number(place.longitude)
      if(Number.isFinite(lat) && Number.isFinite(lon)){
        return { lat, lon, country, place: place['place name'] || normalizedPostcode }
      }
    }
  } catch (err) {
    return resolveCoordinatesViaNominatim(normalizedPostcode, country)
  }

  return resolveCoordinatesViaNominatim(normalizedPostcode, country)
}

async function loadWeatherForPostcode(postcode){
  if(weatherLoading.has(postcode)) return
  weatherLoading.add(postcode)
  try {
    const coords = await resolveCoordinatesByPostcode(postcode)
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=3`
    const forecast = await fetchJson(weatherUrl)
    const daily = forecast.daily || {}
    const times = Array.isArray(daily.time) ? daily.time.slice(0, 3) : []
    const days = times.map((d, i) => ({
      date: d,
      weatherCode: Number(daily.weathercode?.[i]),
      max: Math.round(Number(daily.temperature_2m_max?.[i] ?? 0)),
      min: Math.round(Number(daily.temperature_2m_min?.[i] ?? 0)),
      rain: Math.round(Number(daily.precipitation_probability_max?.[i] ?? 0))
    }))

    if(!days.length) throw new Error(t('alert.forecastDataMissing'))

    weatherCache[postcode] = {
      fetchedAt: Date.now(),
      days,
      place: coords.place,
      country: coords.country
    }
  } catch (err) {
    weatherCache[postcode] = {
      fetchedAt: Date.now(),
      error: true
    }
  } finally {
    weatherLoading.delete(postcode)
    render()
  }
}

function renderPaddockWeather(paddock, isVisible){
  const visibilityClass = isVisible ? ' is-visible' : ''
  const rawPostcode = (paddock.postcode || '').trim()
  if(!rawPostcode){
    return `<div class="paddock-weather paddock-weather-empty${visibilityClass}">${t('weather.noPostcode')}</div>`
  }

  const postcodeKey = rawPostcode.toUpperCase()
  const cached = weatherCache[postcodeKey]
  const isFresh = !!cached && (Date.now() - cached.fetchedAt) < WEATHER_TTL_MS

  if((!cached || !isFresh) && !weatherLoading.has(postcodeKey)){
    loadWeatherForPostcode(postcodeKey)
  }

  if(!cached || !isFresh){
    return `<div class="paddock-weather paddock-weather-loading${visibilityClass}">${t('weather.loading')}</div>`
  }

  if(cached.error){
    return `<div class="paddock-weather paddock-weather-error${visibilityClass}">${t('weather.noForecast', { postcode: postcodeKey })}</div>`
  }

  return `<div class="paddock-weather${visibilityClass}">${cached.days.map(day => {
    const dayText = day.date ? formatForecastDay(day.date) : (day.day || '')
    const labelText = Number.isFinite(day.weatherCode) ? weatherLabel(day.weatherCode) : (day.label || '')
    return `<div class="weather-day"><strong>${dayText}</strong><small>${labelText}</small><small>${day.max}° / ${day.min}°</small><small>${t('weather.rainPercentage', { rain: day.rain })}</small></div>`
  }).join('')}</div>`
}

function ensureDefaultStal(){
  if(state.paddocks.length > 0) return
  const paddockId = uid()
  const zoneId = uid()
  state.paddocks.push({
    id: paddockId,
    name: 'Stal',
    postcode: '',
    zones: [{ id: zoneId, name: 'Stal', area: null, perimeter: null, emptySince: Date.now(), occupiedSince: null }]
  })
}

function hydrateState(saved){
  state.paddocks = Array.isArray(saved?.paddocks) ? saved.paddocks.map(p => ({
    id: p.id,
    name: p.name,
    postcode: typeof p.postcode === 'string' ? p.postcode : '',
    zones: Array.isArray(p.zones) ? p.zones.map(z => ({
      id: z.id,
      name: z.name,
      area: Number.isFinite(Number(z.area)) ? Number(z.area) : null,
      perimeter: Number.isFinite(Number(z.perimeter)) ? Number(z.perimeter) : null,
      notes: typeof z.notes === 'string' ? z.notes.trim() : '',
      emptySince: z.emptySince ?? Date.now(),
      occupiedSince: z.occupiedSince ?? null
    })) : []
  })) : []
  state.sheep = Array.isArray(saved?.sheep) ? saved.sheep.map(s => ({
    id: s.id,
    tag: s.tag,
    earmark: typeof s.earmark === 'string' && s.earmark.trim() ? s.earmark.trim() : null,
    birthDate: typeof s.birthDate === 'string' && s.birthDate.trim() ? s.birthDate.trim() : null,
    injections: Array.isArray(s.injections) ? s.injections.map(i => ({
      id: i.id || uid(),
      date: typeof i.date === 'string' ? i.date : '',
      product: typeof i.product === 'string' ? i.product : '',
      repeatDate: typeof i.repeatDate === 'string' ? i.repeatDate : ''
    })) : [],
    shearings: Array.isArray(s.shearings) ? s.shearings.map(sh => ({
      id: sh.id || uid(),
      date: typeof sh.date === 'string' ? sh.date : ''
    })) : [],
    gender: s.gender === 'male' || s.gender === 'female' ? s.gender : null,
    motherId: s.motherId ?? null,
    fatherId: s.fatherId ?? null,
    paddockId: s.paddockId ?? null,
    zoneId: s.zoneId ?? null,
    flockStatus: s.flockStatus === 'out' ? 'out' : 'active',
    outReason: typeof s.outReason === 'string' ? s.outReason : null,
    outDate: typeof s.outDate === 'string' ? s.outDate : null,
    outNotes: typeof s.outNotes === 'string' ? s.outNotes : null,
    outHidden: !!s.outHidden,
    outFromPaddockId: s.outFromPaddockId ?? null,
    outFromZoneId: s.outFromZoneId ?? null,
    lastUpdated: s.lastUpdated ?? Date.now()
  })) : []
  state.history = Array.isArray(saved?.history) ? saved.history.map(h => ({
    id: h.id || uid(),
    ts: h.ts ?? Date.now(),
    entity: h.entity || 'systeem',
    message: h.message || ''
  })) : []
  state.events = Array.isArray(saved?.events) ? saved.events.map(event => ({
    id: event.id || uid(),
    ts: event.ts ?? Date.now(),
    type: typeof event.type === 'string' ? event.type : 'UNKNOWN',
    payload: event && typeof event.payload === 'object' && event.payload !== null ? event.payload : {}
  })) : []
  state.planningItems = Array.isArray(saved?.planningItems)
    ? saved.planningItems.map(item => sanitizePlanningItem(item)).filter(Boolean)
    : []
  // Migrate legacy history snapshots into event entries when no events exist yet.
  if(state.events.length === 0 && state.history.length){
    const migrated = [...state.history]
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 4000)
      .map(item => ({
        id: uid(),
        ts: item.ts ?? Date.now(),
        type: 'LEGACY_HISTORY_ENTRY',
        payload: {
          entity: item.entity || 'systeem',
          message: item.message || ''
        }
      }))
    state.events = migrated
  }
  migrateCareEventsFromSheepRecordsIfNeeded()
  rebuildSheepCareFromEvents()
  // Keep legacy history empty so events are the single source of truth.
  state.history = []
  syncDerivedPlanningItems()
  ensureDefaultStal()
  collapseAllPaddocks()
  const removedEarmarks = dedupeEarmarks()
  updateZoneEmptyStates()
  return removedEarmarks
}

function isOnboardingEmptyState(){
  if(state.sheep.length || state.paddocks.length !== 1) return false
  const [paddock] = state.paddocks
  if(!isStalPaddock(paddock) || paddock.postcode || paddock.zones.length !== 1) return false
  const [zone] = paddock.zones
  return isStalZone(paddock, zone)
    && !zone.notes
    && (zone.area === null || zone.area === undefined)
    && (zone.perimeter === null || zone.perimeter === undefined)
}

function collapseAllPaddocks(){
  collapsedPaddockIds.clear()
  state.paddocks.forEach(paddock => collapsedPaddockIds.add(paddock.id))
}

function load(){
  const raw = localStorage.getItem(KEY)
  if(raw){
    hydrateState(JSON.parse(raw))
    return
  }
  hydrateState(null)
}

function save(){
  updateZoneEmptyStates()
  syncDerivedPlanningItems()
  const persistedState = cloudStatePayload()
  localStorage.setItem(KEY, JSON.stringify(persistedState))
  queueCloudSave(persistedState)
}

function formatBirthDate(dateString){
  if(!dateString) return ''
  return new Date(`${dateString}T12:00:00`).toLocaleDateString(localeTag(), {
    day: '2-digit', month: '2-digit', year: 'numeric'
  })
}

function formatAge(dateString){
  if(!dateString) return ''
  const birthDate = new Date(`${dateString}T12:00:00`)
  if(Number.isNaN(birthDate.getTime())) return ''
  const now = new Date()
  let years = now.getFullYear() - birthDate.getFullYear()
  let months = now.getMonth() - birthDate.getMonth()

  if(now.getDate() < birthDate.getDate()){
    months -= 1
  }
  if(months < 0){
    years -= 1
    months += 12
  }
  if(years < 0){
    years = 0
    months = 0
  }

  if(years === 0 && months < 6){
    const start = new Date(birthDate.getFullYear(), birthDate.getMonth(), birthDate.getDate())
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const days = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000))
    return t('labels.ageMonthsDays', { months, days })
  }

  return t('labels.ageYearsMonths', { years, months })
}

function todayIso(){
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function oneYearFromTodayIso(){
  const date = new Date()
  date.setFullYear(date.getFullYear() + 1)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function latestShearingRecord(sheep){
  if(!Array.isArray(sheep.shearings)) return null
  const valid = sheep.shearings.filter(sh => typeof sh.date === 'string' && sh.date)
  if(!valid.length) return null
  return valid.reduce((latest, item) => (item.date >= latest.date ? item : latest))
}

function latestInjectionRecord(sheep){
  if(!Array.isArray(sheep.injections)) return null
  const valid = sheep.injections.filter(i => typeof i.date === 'string' && i.date)
  if(!valid.length) return null
  return valid.reduce((latest, item) => (item.date >= latest.date ? item : latest))
}

function nextInjectionRecord(sheep){
  if(!Array.isArray(sheep.injections)) return null
  const today = todayIso()
  const valid = sheep.injections.filter(i => typeof i.repeatDate === 'string' && i.repeatDate && i.repeatDate >= today)
  if(!valid.length) return null
  return valid.reduce((next, item) => (item.repeatDate <= next.repeatDate ? item : next))
}

function groupHistoryEntries(entries){
  const grouped = []

  entries.forEach(entry => {
    const lastGroup = grouped[grouped.length - 1]
    const metaKey = `${formatDateTime(entry.ts)}|${entry.what}|${entry.detail}|${entry.repeatBy || ''}`

    if(lastGroup && lastGroup.metaKey === metaKey){
      lastGroup.sheepNames = Array.from(new Set([...lastGroup.sheepNames, ...entry.sheepNames]))
      return
    }

    grouped.push({
      metaKey,
      ts: entry.ts,
      what: entry.what,
      detail: entry.detail,
      repeatBy: entry.repeatBy || '',
      sheepNames: Array.isArray(entry.sheepNames) ? [...entry.sheepNames] : []
    })
  })

  return grouped
}

function formatDate(timestamp){
  return new Date(timestamp).toLocaleDateString(localeTag(), { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatDateTime(timestamp){
  return new Date(timestamp).toLocaleString(localeTag(), {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

function daysSince(timestamp){
  if(!timestamp) return '-'
  const diff = Date.now() - timestamp
  return Math.floor(diff / 86400000)
}

function occupancyAgeClass(days){
  if(!Number.isFinite(days)) return 'zone-status--age-green'
  if(days < 7) return 'zone-status--age-green'
  if(days <= 10) return 'zone-status--age-yellow'
  if(days <= 14) return 'zone-status--age-orange'
  return 'zone-status--age-red'
}

function updateZoneEmptyStates(){
  state.paddocks.forEach(p => {
    p.zones.forEach(z => {
      const assigned = state.sheep.some(s => s.paddockId === p.id && s.zoneId === z.id)
      if(assigned){
        if(!z.occupiedSince){
          z.occupiedSince = Date.now()
        }
        z.emptySince = null
      } else if(!z.emptySince){
        z.emptySince = Date.now()
        z.occupiedSince = null
      }
    })
  })
}

function dedupeEarmarks(){
  const seen = new Set()
  let removedCount = 0
  state.sheep.forEach(s => {
    const normalized = normalizeEarmark(s.earmark)
    if(!normalized) return
    if(seen.has(normalized)){
      s.earmark = null
      removedCount += 1
      return
    }
    seen.add(normalized)
  })
  return removedCount
}

function addEvent(type, payload, ts = Date.now()){
  state.events.unshift({
    id: uid(),
    ts,
    type,
    payload
  })
  if(state.events.length > 4000){
    state.events = state.events.slice(0, 4000)
  }
}

function generateHistoryFromEvents(){
  const generated = []
  const events = Array.isArray(state.events) ? [...state.events].sort((a, b) => b.ts - a.ts) : []

  events.forEach(evt => {
    const { type, ts, payload } = evt
    if(!type || !payload) return

    let what = 'systeem'
    let detail = ''
    let repeatBy = ''
    let sheepNames = []

    switch(type){
      case 'SHEEP_CREATED':
        what = t('entity.sheep')
        detail = t('history.sheep.added', {
          tag: payload.tag || '?',
          location: payload.zoneId
            ? `${paddockName(payload.paddockId)} / ${zoneName(payload.paddockId, payload.zoneId)}`
            : paddockName(payload.paddockId)
        })
        sheepNames = [payload.tag || '?']
        break
      case 'SHEEP_DELETED':
        what = t('entity.sheep')
        detail = t('history.sheep.deleted', {
          tag: payload.tag || '?',
          location: payload.zoneId
            ? `${paddockName(payload.paddockId)} / ${zoneName(payload.paddockId, payload.zoneId)}`
            : paddockName(payload.paddockId)
        })
        sheepNames = [payload.tag || '?']
        break
      case 'SHEEP_REMOVED_FROM_FLOCK':
        what = t('entity.sheep')
        detail = t('history.sheep.removedFromFlock', {
          tag: payload.tag || '?',
          reason: outReasonLabel(payload.reason),
          date: formatBirthDate(payload.date)
        })
        sheepNames = [payload.tag || '?']
        break
      case 'PADDOCK_CREATED':
        what = 'weide'
        detail = t('history.paddock.added', { name: payload.name || '?' })
        break
      case 'PADDOCK_DELETED':
        what = 'weide'
        detail = t('history.paddock.deleted', { name: payload.name || '?' })
        break
      case 'ZONE_CREATED':
        what = 'zone'
        detail = t('history.zone.added', {
          name: payload.name || '?',
          paddock: paddockName(payload.paddockId)
        })
        break
      case 'ZONE_DELETED':
        what = 'zone'
        detail = t('history.zone.deleted', {
          paddock: paddockName(payload.paddockId),
          name: payload.name || '?'
        })
        break
      case 'SHEEP_MOVED':
        what = t('entity.sheep')
        detail = `${payload.from || t('unknown')} → ${payload.to || t('unknown')}`
        sheepNames = [payload.sheep || '?']
        break
      case 'SHEEP_INJECTION_REGISTERED':
        what = 'injectie'
        if(payload.repeatDate){
          detail = `${payload.product || '?'} (${formatBirthDate(payload.date)})`
          repeatBy = formatBirthDate(payload.repeatDate)
        } else {
          detail = `${payload.product || '?'} (${formatBirthDate(payload.date)})`
        }
        sheepNames = [payload.sheepTag || '?']
        break
      case 'SHEEP_SHEARING_REGISTERED':
        what = 'scheren'
        detail = formatBirthDate(payload.date)
        sheepNames = [payload.sheepTag || '?']
        break
      case 'PADDOCK_UPDATED': {
        what = 'weide'
        const updates = []
        if(payload.previousName !== payload.newName) updates.push(t('history.details.name', { from: payload.previousName, name: payload.newName }))
        if(payload.previousPostcode !== payload.newPostcode) updates.push(t('history.details.postcode', { from: payload.previousPostcode || '-', postcode: payload.newPostcode || '-' }))
        detail = updates.join(', ') || '-'
        break
      }
      case 'ZONE_UPDATED': {
        what = 'zone'
        const updates = []
        if(payload.previousName !== payload.newName) updates.push(t('history.details.name', { from: payload.previousName, name: payload.newName }))
        if(payload.previousArea !== payload.newArea) updates.push(t('history.details.area', { from: payload.previousArea ?? '-', area: payload.newArea ?? '-' }))
        if(payload.previousPerimeter !== payload.newPerimeter) updates.push(t('history.details.perimeter', { from: payload.previousPerimeter ?? '-', perimeter: payload.newPerimeter ?? '-' }))
        if(payload.previousNotes !== payload.newNotes) updates.push(t('history.details.notesUpdated'))
        detail = `${paddockName(payload.paddockId)} / ${payload.newName || '?'}`
        repeatBy = updates.join(', ') || '-'
        break
      }
      case 'SHEEP_UPDATED': {
        what = t('entity.sheep')
        const updates = []
        if(payload.previousTag !== payload.newTag) updates.push(t('history.details.name', { from: payload.previousTag, to: payload.newTag }))
        if(payload.previousEarmark !== payload.newEarmark) updates.push(t('history.details.earmarkAdded', { earmark: payload.newEarmark }))
        detail = updates.join(', ') || '-'
        break
      }
      case 'DATA_IMPORTED':
        what = 'systeem'
        detail = t('history.import.success')
        break
      case 'LEGACY_HISTORY_ENTRY':
        what = payload.entity || 'systeem'
        detail = payload.message || ''
        break
      case 'PLANNING_ITEM_CREATED':
        what = 'planning'
        detail = t('history.planning.created', {
          type: t(`planning.type.${payload.type || 'custom'}`),
          date: formatBirthDate(payload.dueDate)
        })
        sheepNames = payload.sheepTag ? [payload.sheepTag] : []
        break
      case 'PLANNING_ITEM_COMPLETED':
        what = 'planning'
        detail = t('history.planning.completed', {
          type: t(`planning.type.${payload.type || 'custom'}`),
          date: formatBirthDate(payload.dueDate)
        })
        sheepNames = payload.sheepTag ? [payload.sheepTag] : []
        break
      default:
        return
    }

    generated.push({ id: evt.id, ts, what, detail, repeatBy, sheepNames })
  })

  return generated
}

function sheepNamesList(sheepItems){
  return sheepItems.map(s => s.tag).join(', ')
}

function exportData(){
  syncDerivedPlanningItems()
  const sheepForStorage = state.sheep.map(sheep => ({
    ...sheep,
    injections: [],
    shearings: []
  }))
  const exportState = {
    ...state,
    history: [],
    sheep: sheepForStorage,
    planningItems: state.planningItems.filter(item => item && item.source === 'manual')
  }
  const json = JSON.stringify(exportState, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  const now = new Date()
  const date = now.toISOString().slice(0, 10)
  const time = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`
  link.download = `flockops-${date}-${time}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function handleExitDownload(){
  if(!isAutoDownloadOnCloseEnabled()) return
  if(hasTriggeredExitDownload) return
  hasTriggeredExitDownload = true
  try {
    exportData()
  } catch (error) {
    // Ignore unload-time errors; some browsers block downloads without a user gesture.
    console.warn('Exit download skipped:', error)
  }
}

function parseCareDateToTimestamp(dateString, fallbackTs = Date.now()){
  if(typeof dateString !== 'string' || !dateString.trim()) return fallbackTs
  const parsed = new Date(`${dateString.trim()}T12:00:00`).getTime()
  return Number.isFinite(parsed) ? parsed : fallbackTs
}

function hasCareEvents(){
  return state.events.some(evt => evt.type === 'SHEEP_INJECTION_REGISTERED' || evt.type === 'SHEEP_SHEARING_REGISTERED')
}

function migrateCareEventsFromSheepRecordsIfNeeded(){
  const existingKeys = new Set(
    state.events
      .filter(evt => evt.type === 'SHEEP_INJECTION_REGISTERED' || evt.type === 'SHEEP_SHEARING_REGISTERED')
      .map(evt => {
        const payload = evt.payload && typeof evt.payload === 'object' ? evt.payload : {}
        if(evt.type === 'SHEEP_INJECTION_REGISTERED'){
          const repeatDate = typeof payload.repeatDate === 'string' ? payload.repeatDate.trim() : ''
          return `inj|${payload.sheepId || ''}|${payload.date || ''}|${payload.product || ''}|${repeatDate}`
        }
        return `shr|${payload.sheepId || ''}|${payload.date || ''}`
      })
  )

  const migratedEvents = []
  state.sheep.forEach(sheep => {
    const injections = Array.isArray(sheep.injections) ? sheep.injections : []
    injections.forEach(injection => {
      const repeatDate = typeof injection.repeatDate === 'string' && injection.repeatDate.trim() ? injection.repeatDate.trim() : ''
      const dedupeKey = `inj|${sheep.id}|${typeof injection.date === 'string' ? injection.date : ''}|${typeof injection.product === 'string' ? injection.product : ''}|${repeatDate}`
      if(existingKeys.has(dedupeKey)) return
      existingKeys.add(dedupeKey)
      const ts = parseCareDateToTimestamp(injection.date, sheep.lastUpdated ?? Date.now())
      migratedEvents.push({
        id: uid(),
        ts,
        type: 'SHEEP_INJECTION_REGISTERED',
        payload: {
          paddockId: sheep.paddockId,
          zoneId: sheep.zoneId || null,
          sheepId: sheep.id,
          sheepTag: sheep.tag,
          date: typeof injection.date === 'string' ? injection.date : '',
          product: typeof injection.product === 'string' ? injection.product : '',
          repeatDate: repeatDate || null
        }
      })
    })

    const shearings = Array.isArray(sheep.shearings) ? sheep.shearings : []
    shearings.forEach(shearing => {
      const dedupeKey = `shr|${sheep.id}|${typeof shearing.date === 'string' ? shearing.date : ''}`
      if(existingKeys.has(dedupeKey)) return
      existingKeys.add(dedupeKey)
      const ts = parseCareDateToTimestamp(shearing.date, sheep.lastUpdated ?? Date.now())
      migratedEvents.push({
        id: uid(),
        ts,
        type: 'SHEEP_SHEARING_REGISTERED',
        payload: {
          paddockId: sheep.paddockId,
          zoneId: sheep.zoneId || null,
          sheepId: sheep.id,
          sheepTag: sheep.tag,
          date: typeof shearing.date === 'string' ? shearing.date : ''
        }
      })
    })
  })

  if(!migratedEvents.length) return
  state.events = [...state.events, ...migratedEvents]
}

function rebuildSheepCareFromEvents(){
  state.sheep.forEach(sheep => {
    sheep.injections = []
    sheep.shearings = []
  })

  const careEvents = state.events
    .filter(evt => evt.type === 'SHEEP_INJECTION_REGISTERED' || evt.type === 'SHEEP_SHEARING_REGISTERED')
    .slice()
    .sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0))

  careEvents.forEach(evt => {
    const payload = evt.payload && typeof evt.payload === 'object' ? evt.payload : {}
    const sheep = state.sheep.find(item => item.id === payload.sheepId)
    if(!sheep) return

    if(evt.type === 'SHEEP_INJECTION_REGISTERED'){
      sheep.injections.push({
        id: uid(),
        date: typeof payload.date === 'string' ? payload.date : '',
        product: typeof payload.product === 'string' ? payload.product : '',
        repeatDate: typeof payload.repeatDate === 'string' ? payload.repeatDate : ''
      })
      return
    }

    sheep.shearings.push({
      id: uid(),
      date: typeof payload.date === 'string' ? payload.date : ''
    })
  })
}

function importDataFile(file){
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result)
      if(!parsed || typeof parsed !== 'object') throw new Error('Ongeldig bestand')
      const removedEarmarks = hydrateState(parsed)
      addEvent('DATA_IMPORTED', { source: 'file' })
      if(removedEarmarks > 0){
      }
      reopenEmptyStorageModalAfterUpload = false
      save(); render()
      alert(t('alert.importSuccess'))
    } catch (err) {
      const shouldReopenModal = reopenEmptyStorageModalAfterUpload && isOnboardingEmptyState()
      reopenEmptyStorageModalAfterUpload = false
      if(shouldReopenModal) openModal('empty-storage-modal')
      alert(t('alert.importError', { error: err.message }))
    }
  }
  reader.readAsText(file)
}

async function loadDummyData(){
  try {
    const sources = [
      new URL('dummy-data.json', window.location.href).toString(),
      'https://raw.githubusercontent.com/bartgabriels/FlockOps/main/dummy-data.json'
    ]
    let parsed = null
    let lastError = null

    for(const source of sources){
      try {
        const response = await fetch(source, { cache: 'no-store' })
        if(!response.ok) throw new Error(`HTTP ${response.status}`)
        parsed = await response.json()
        break
      } catch (error) {
        lastError = error
      }
    }

    if(!parsed) throw lastError || new Error('Failed to fetch')
    if(!parsed || typeof parsed !== 'object') throw new Error('Ongeldig bestand')
    const removedEarmarks = hydrateState(parsed)
    addEvent('DATA_IMPORTED', { source: 'dummy' })
    if(removedEarmarks > 0){
    }
    save(); render(); closeModal('empty-storage-modal')
    alert(t('alert.importSuccess'))
  } catch (error) {
    alert(t('alert.importError', { error: error.message }))
  }
}

function triggerUploadDataPicker(reopenModalOnCancel = false){
  const input = document.getElementById('upload-data-input')
  if(!input) return
  reopenEmptyStorageModalAfterUpload = reopenModalOnCancel
  input.click()
}

function maybeOpenEmptyStorageModal(){
  if(isOnboardingEmptyState()){
    openModal('empty-storage-modal')
  }
}

function normalizePlanningType(value){
  return value === 'injection' || value === 'shearing' || value === 'custom' ? value : 'custom'
}

function normalizePlanningStatus(value){
  return value === 'planned' || value === 'done' || value === 'cancelled' ? value : 'planned'
}

function sanitizePlanningItem(item){
  if(!item || typeof item !== 'object') return null
  const dueDate = typeof item.dueDate === 'string' ? item.dueDate.trim() : ''
  if(!dueDate) return null
  return {
    id: typeof item.id === 'string' && item.id.trim() ? item.id : uid(),
    type: normalizePlanningType(item.type),
    status: normalizePlanningStatus(item.status),
    dueDate,
    repeatDate: typeof item.repeatDate === 'string' ? item.repeatDate.trim() : '',
    detail: typeof item.detail === 'string' ? item.detail.trim() : '',
    sheepId: typeof item.sheepId === 'string' && item.sheepId.trim() ? item.sheepId : null,
    paddockId: typeof item.paddockId === 'string' && item.paddockId.trim() ? item.paddockId : null,
    zoneId: typeof item.zoneId === 'string' && item.zoneId.trim() ? item.zoneId : null,
    source: item.source === 'derived' ? 'derived' : 'manual',
    sourceKey: typeof item.sourceKey === 'string' && item.sourceKey.trim() ? item.sourceKey : null,
    createdAt: Number.isFinite(Number(item.createdAt)) ? Number(item.createdAt) : Date.now(),
    completedAt: Number.isFinite(Number(item.completedAt)) ? Number(item.completedAt) : null,
    lastDate: typeof item.lastDate === 'string' ? item.lastDate.trim() : '',
    product: typeof item.product === 'string' ? item.product.trim() : ''
  }
}

function collectDerivedPlanningCandidates(){
  const candidates = []
  state.sheep.forEach(sheep => {
    if(!isActiveFlockSheep(sheep)) return
    if(!Array.isArray(sheep.injections)) return
    sheep.injections.forEach(injection => {
      if(typeof injection.repeatDate !== 'string' || !injection.repeatDate.trim()) return
      candidates.push({
        sourceKey: `inj:${sheep.id}:${injection.id || ''}`,
        type: 'injection',
        dueDate: injection.repeatDate.trim(),
        repeatDate: injection.repeatDate.trim(),
        detail: injection.product || '',
        sheepId: sheep.id,
        paddockId: sheep.paddockId,
        zoneId: sheep.zoneId || null,
        product: injection.product || '',
        lastDate: injection.date || ''
      })
    })
  })
  return candidates
}

function syncDerivedPlanningItems(){
  const candidates = collectDerivedPlanningCandidates()
  const candidateByKey = new Map(candidates.map(item => [item.sourceKey, item]))
  const nextItems = []
  let hasChanges = false

  state.planningItems.forEach(item => {
    if(item.source !== 'derived' || !item.sourceKey){
      nextItems.push(item)
      return
    }
    const candidate = candidateByKey.get(item.sourceKey)
    if(!candidate){
      if(item.status === 'planned'){
        hasChanges = true
        return
      }
      nextItems.push(item)
      return
    }

    const updated = {
      ...item,
      type: candidate.type,
      dueDate: candidate.dueDate,
      repeatDate: candidate.repeatDate,
      detail: candidate.detail,
      sheepId: candidate.sheepId,
      paddockId: candidate.paddockId,
      zoneId: candidate.zoneId,
      product: candidate.product,
      lastDate: candidate.lastDate
    }
    if(
      item.type !== updated.type
      || item.dueDate !== updated.dueDate
      || item.repeatDate !== updated.repeatDate
      || item.detail !== updated.detail
      || item.sheepId !== updated.sheepId
      || item.paddockId !== updated.paddockId
      || item.zoneId !== updated.zoneId
      || item.product !== updated.product
      || item.lastDate !== updated.lastDate
    ){
      hasChanges = true
    }

    nextItems.push(updated)
    candidateByKey.delete(item.sourceKey)
  })

  candidateByKey.forEach(candidate => {
    nextItems.push({
      id: uid(),
      type: candidate.type,
      status: 'planned',
      dueDate: candidate.dueDate,
      repeatDate: candidate.repeatDate,
      detail: candidate.detail,
      sheepId: candidate.sheepId,
      paddockId: candidate.paddockId,
      zoneId: candidate.zoneId,
      source: 'derived',
      sourceKey: candidate.sourceKey,
      createdAt: Date.now(),
      completedAt: null,
      product: candidate.product,
      lastDate: candidate.lastDate
    })
    hasChanges = true
  })

  if(hasChanges){
    state.planningItems = nextItems
  }

  return hasChanges
}

function resolvePlanningItem(item){
  const sheep = item.sheepId ? state.sheep.find(s => s.id === item.sheepId) : null
  const paddockId = item.paddockId || (sheep ? sheep.paddockId : null)
  const zoneId = item.zoneId || (!item.paddockId && sheep ? (sheep.zoneId || null) : null)
  const paddock = paddockId ? getPaddock(paddockId) : null
  const zone = paddockId && zoneId ? getZone(paddockId, zoneId) : null
  return {
    ...item,
    sheepTag: sheep ? sheep.tag : '-',
    paddockId,
    zoneId,
    location: paddockId
      ? `${paddock ? paddock.name : t('unknown')}${zoneId ? ' / ' + (zone ? zone.name : t('unknown')) : ''}`
      : '-',
    typeLabel: t(`planning.type.${item.type}`)
  }
}

function collectPlanningEntries(){
  syncDerivedPlanningItems()
  return state.planningItems
    .map(item => resolvePlanningItem(item))
    .sort((a, b) => {
      if(a.dueDate === b.dueDate){
        return (a.sheepTag || '').localeCompare(b.sheepTag || '', localeTag())
      }
      return a.dueDate.localeCompare(b.dueDate)
    })
}

function planningDateField(item){
  return item.dueDate || item.repeatDate || ''
}

function isWithinPeriod(dateValue, periodFilter){
  if(!dateValue) return false
  if(periodFilter === 'all') return true
  const days = Number(periodFilter)
  if(!Number.isFinite(days) || days <= 0) return true
  const today = todayIso()
  if(dateValue < today) return false
  const cutoff = new Date(`${today}T12:00:00`)
  cutoff.setDate(cutoff.getDate() + days)
  const cutoffIso = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`
  return dateValue <= cutoffIso
}

function planningGroupKey(item){
  const dateValue = planningDateField(item)
  return dateValue ? dateValue.slice(0, 7) : 'zonder-datum'
}

function planningStatusLabel(status){
  return t(`planning.status.${status}`)
}

function renderPlanningActions(item){
  if(item.status !== 'planned' || item.source !== 'manual') return ''
  return `<button type="button" class="planning-mark-done-button" data-planning-id="${item.id}">${t('planning.markDone')}</button>`
}

function renderPlanningDetails(item){
  const lines = []
  if(item.detail) lines.push(item.detail)
  if(item.source === 'derived' && item.product) lines.push(t('planning.product', { product: item.product }))
  if(item.source === 'derived' && item.lastDate) lines.push(t('planning.lastDate', { date: formatBirthDate(item.lastDate) }))
  if(item.repeatDate) lines.push(t('history.repeatBy', { date: formatBirthDate(item.repeatDate) }))
  return lines.join(' · ')
}

function markPlanningItemDone(planningId){
  const item = state.planningItems.find(entry => entry.id === planningId)
  if(!item || item.status !== 'planned') return
  item.status = 'done'
  item.completedAt = Date.now()
  addEvent('PLANNING_ITEM_COMPLETED', {
    planningId: item.id,
    type: item.type,
    dueDate: item.dueDate,
    sheepTag: item.sheepId ? (state.sheep.find(s => s.id === item.sheepId)?.tag || null) : null
  })
  save(); render()
}

function openPlanningItemModal(){
  const dueDateInput = document.getElementById('planning-item-date')
  const repeatDateInput = document.getElementById('planning-item-repeat-date')
  const typeInput = document.getElementById('planning-item-type')
  const detailInput = document.getElementById('planning-item-detail')
  const sheepList = document.getElementById('planning-item-sheep-list')
  const paddockList = document.getElementById('planning-item-paddock-list')

  if(typeInput) typeInput.value = 'custom'
  if(dueDateInput) dueDateInput.value = todayIso()
  if(repeatDateInput) repeatDateInput.value = ''
  if(detailInput) detailInput.value = ''
  if(sheepList){
    sheepList.innerHTML = state.sheep
      .slice()
      .filter(isActiveFlockSheep)
      .sort((a, b) => a.tag.localeCompare(b.tag, localeTag()))
      .map(sheep => `
        <label class="modal-sheep-option" for="planning-item-sheep-${sheep.id}">
          <input id="planning-item-sheep-${sheep.id}" type="checkbox" name="planning-item-sheep" value="${sheep.id}">
          <span>${sheep.tag}</span>
        </label>
      `)
      .join('')
  }
  if(paddockList){
    paddockList.innerHTML = state.paddocks
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, localeTag()))
      .map(paddock => `
        <label class="modal-sheep-option" for="planning-item-paddock-${paddock.id}">
          <input id="planning-item-paddock-${paddock.id}" type="checkbox" name="planning-item-paddock" value="${paddock.id}">
          <span>${paddock.name}</span>
        </label>
      `)
      .join('')
  }
  populatePlanningZoneOptions(null)
  syncPlanningTypeVisibility()

  pendingPlanningItemId = null
  openModal('planning-item-modal')
}

function closePlanningItemModal(){
  pendingPlanningItemId = null
  closeModal('planning-item-modal')
}

function toggleAllPlanningSheepSelection(){
  const checkboxes = Array.from(document.querySelectorAll('#planning-item-sheep-list input[name="planning-item-sheep"]'))
  if(!checkboxes.length) return
  const shouldSelectAll = checkboxes.some(checkbox => !checkbox.checked)
  checkboxes.forEach(checkbox => {
    checkbox.checked = shouldSelectAll
  })
}

function toggleAllPlanningCheckboxSelection(name, containerSelector){
  const checkboxes = Array.from(document.querySelectorAll(`${containerSelector} input[name="${name}"]`))
  if(!checkboxes.length) return
  const shouldSelectAll = checkboxes.some(checkbox => !checkbox.checked)
  checkboxes.forEach(checkbox => {
    checkbox.checked = shouldSelectAll
  })
}

function clearPlanningCheckboxSelection(name){
  const checkboxes = Array.from(document.querySelectorAll(`input[name="${name}"]`))
  checkboxes.forEach(checkbox => {
    checkbox.checked = false
  })
}

function syncPlanningTypeVisibility(){
  const typeInput = document.getElementById('planning-item-type')
  const sheepField = document.getElementById('planning-item-sheep-field')
  const paddockField = document.getElementById('planning-item-paddock-field')
  const zoneField = document.getElementById('planning-item-zone-field')
  const type = normalizePlanningType(typeInput ? typeInput.value : 'custom')

  const showSheep = true
  const showPaddock = type === 'custom'
  const showZone = false

  if(sheepField) sheepField.hidden = !showSheep
  if(paddockField) paddockField.hidden = !showPaddock
  if(zoneField) zoneField.hidden = !showZone

  if(!showPaddock){
    clearPlanningCheckboxSelection('planning-item-paddock')
    clearPlanningCheckboxSelection('planning-item-zone')
    populatePlanningZoneOptions(null)
  }
}

function getSelectedPlanningPaddockIds(){
  return Array.from(document.querySelectorAll('#planning-item-paddock-list input[name="planning-item-paddock"]:checked')).map(input => input.value)
}

function getSelectedPlanningZoneTargets(){
  return Array.from(document.querySelectorAll('#planning-item-zone-list input[name="planning-item-zone"]:checked'))
    .map(input => {
      const [paddockId, zoneId] = String(input.value || '').split('::')
      if(!paddockId || !zoneId) return null
      return { paddockId, zoneId }
    })
    .filter(Boolean)
}

function populatePlanningZoneOptions(paddockIds){
  const zoneList = document.getElementById('planning-item-zone-list')
  if(!zoneList) return
  const normalizedPaddockIds = Array.isArray(paddockIds) ? paddockIds.filter(Boolean) : []
  if(!normalizedPaddockIds.length){
    zoneList.innerHTML = `<div class="empty">${t('select.paddock.first')}</div>`
    return
  }

  const zones = normalizedPaddockIds.flatMap(paddockId => {
    const paddock = getPaddock(paddockId)
    if(!paddock || !Array.isArray(paddock.zones)) return []
    return paddock.zones.map(zone => ({
      paddockId,
      paddockName: paddock.name,
      zoneId: zone.id,
      zoneName: zone.name
    }))
  })

  if(!zones.length){
    zoneList.innerHTML = `<div class="empty">${t('select.zone.noneAvailable')}</div>`
    return
  }

  zoneList.innerHTML = zones
    .map(zone => `
      <label class="modal-sheep-option" for="planning-item-zone-${zone.paddockId}-${zone.zoneId}">
        <input id="planning-item-zone-${zone.paddockId}-${zone.zoneId}" type="checkbox" name="planning-item-zone" value="${zone.paddockId}::${zone.zoneId}">
        <span>${zone.paddockName} / ${zone.zoneName}</span>
      </label>
    `)
    .join('')
}

function filterPlanningEntries(entries){
  const periodFilter = document.getElementById('planning-filter-period')?.value || 'all'
  const paddockFilter = document.getElementById('planning-filter-paddock')?.value || 'all'
  const sheepFilter = document.getElementById('planning-filter-sheep')?.value || 'all'

  let filtered = [...entries]

  if(periodFilter !== 'all'){
    filtered = filtered.filter(item => isWithinPeriod(planningDateField(item), periodFilter))
  }

  if(paddockFilter !== 'all'){
    filtered = filtered.filter(item => item.paddockId === paddockFilter)
  }
  if(sheepFilter !== 'all'){
    filtered = filtered.filter(item => item.sheepId === sheepFilter)
  }

  return filtered
}

function syncPlanningFilterOptions(allEntries){
  const paddockFilter = document.getElementById('planning-filter-paddock')
  const sheepFilter = document.getElementById('planning-filter-sheep')
  if(!paddockFilter || !sheepFilter) return

  const selectedPaddock = paddockFilter.value || 'all'
  const selectedSheep = sheepFilter.value || 'all'

  const paddockIds = new Set(allEntries.map(item => item.paddockId).filter(Boolean))
  const sheepIds = new Set(allEntries.map(item => item.sheepId).filter(Boolean))

  const paddockOptions = state.paddocks
    .filter(paddock => paddockIds.has(paddock.id))
    .map(paddock => `<option value="${paddock.id}">${paddock.name}</option>`)
    .join('')
  paddockFilter.innerHTML = `<option value="all">${t('planning.filter.all')}</option>${paddockOptions}`
  paddockFilter.value = paddockIds.has(selectedPaddock) ? selectedPaddock : 'all'

  const sheepOptions = state.sheep
    .filter(sheep => sheepIds.has(sheep.id))
    .map(sheep => `<option value="${sheep.id}">${sheep.tag}</option>`)
    .join('')
  sheepFilter.innerHTML = `<option value="all">${t('planning.filter.all')}</option>${sheepOptions}`
  sheepFilter.value = sheepIds.has(selectedSheep) ? selectedSheep : 'all'
}

function renderPlanning(){
  const planningList = document.getElementById('planning-list')
  if(!planningList) return

  const allEntries = collectPlanningEntries()
  syncPlanningFilterOptions(allEntries)
  const filteredEntries = filterPlanningEntries(allEntries)

  if(!filteredEntries.length){
    planningList.innerHTML = `<div class="empty">${t('planning.empty')}</div>`
    return
  }

  const groups = new Map()
  filteredEntries.forEach(item => {
    const key = planningGroupKey(item)
    if(!groups.has(key)) groups.set(key, [])
    groups.get(key).push(item)
  })

  planningList.innerHTML = Array.from(groups.entries()).map(([monthKey, items]) => {
    const monthTitle = monthKey === 'zonder-datum'
      ? '-'
      : new Date(Number(monthKey.slice(0, 4)), Number(monthKey.slice(5, 7)) - 1, 1).toLocaleDateString(localeTag(), { month: 'long', year: 'numeric' })

    return `
      <div class="planning-month">
        <h3 class="planning-month-title">${monthTitle}</h3>
        <div class="planning-month-list">
          ${items.map(item => {
            const details = renderPlanningDetails(item)
            const dateValue = planningDateField(item)
            return `
              <div class="planning-item" data-planning-id="${item.id}">
                <strong>${dateValue ? formatBirthDate(dateValue) : '-'}</strong>
                <span>${item.sheepTag || '-'}</span>
                <span>${item.location || '-'}</span>
                <span class="planning-item-type">${item.typeLabel}</span>
                <span class="planning-item-status planning-item-status--${item.status}">${planningStatusLabel(item.status)}</span>
                ${renderPlanningActions(item)}
                <small>${details}</small>
              </div>
            `
          }).join('')}
        </div>
      </div>
    `
  }).join('')
}

function initPlanningFilters(){
  if(hasInitializedPlanningFilters) return
  hasInitializedPlanningFilters = true

  const filterIds = ['planning-filter-period', 'planning-filter-paddock', 'planning-filter-sheep']
  filterIds.forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => {
      renderPlanning()
    })
  })
}

function render(){
  updateZoneEmptyStates()
  const paddockList = document.getElementById('paddock-list')
  const sheepList = document.getElementById('sheep-list')
  const sheepOutList = document.getElementById('sheep-out-list')
  const pedigreeList = document.getElementById('pedigree-list')
  const historyList = document.getElementById('history-list')
  const billingSummary = document.getElementById('billing-summary')
  const sheepPaddockModal = document.getElementById('sheep-paddock-modal')
  const sheepZoneModal = document.getElementById('sheep-zone-modal')
  const movePaddockModal = document.getElementById('move-paddock-modal')
  const moveZoneModal = document.getElementById('move-zone-modal')

  const euroLocale = currentLang === 'fr' ? 'fr-BE' : currentLang === 'en' ? 'en-IE' : 'nl-BE'
  const formatEuro = (value) => {
    const numeric = Number.isFinite(Number(value)) ? Number(value) : 0
    const amount = new Intl.NumberFormat(euroLocale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(numeric)
    return `${amount} €`
  }
  const paddockCount = state.paddocks.length
  const zoneCount = state.paddocks.reduce((sum, paddock) => sum + paddock.zones.length, 0)
  const activeSheep = state.sheep.filter(isActiveFlockSheep)
  const outOfFlockSheep = state.sheep.filter(isOutOfFlockSheep)
  const inactiveSheepCount = outOfFlockSheep.length
  // Until authentication is implemented, billing assumes a single user.
  const userCount = 1
  const billableUserCount = Math.max(0, userCount - 2)
  const visibleOutOfFlockSheep = showAllOutOfFlockSheep
    ? outOfFlockSheep
    : outOfFlockSheep.filter(sheep => !sheep.outHidden)
  const sheepCount = activeSheep.length
  const billingLines = [
    { label: t('billing.fields'), countLabel: `${t('billing.unlimited')} ${t('billing.fields').toLowerCase()}`, rate: 0, total: 0, included: true },
    { label: t('billing.zones'), countLabel: `${zoneCount}`, rate: 0.3, total: zoneCount * 0.3, included: false },
    { label: t('billing.users'), countLabel: `${userCount}`, rate: 0.5, total: billableUserCount * 0.5, included: false },
    { label: t('billing.sheep.active'), countLabel: `${sheepCount}`, rate: 0.3, total: sheepCount * 0.3, included: false },
    { label: t('billing.sheep.inactive'), countLabel: `${inactiveSheepCount}`, rate: 0.05, total: inactiveSheepCount * 0.05, included: false }
  ]
  const billingTotal = billingLines.reduce((sum, line) => sum + line.total, 0)

  paddockList.innerHTML = state.paddocks.length === 0 ? `<div class="empty">${t('paddock.empty')}</div>` : state.paddocks.map(p => renderPaddock(p)).join('') + `
    <button type="button" class="add-paddock-block" aria-label="${t('aria.addPaddock')}">+</button>
  `

  const activeCards = activeSheep.map(s => {
    const lastShearing = latestShearingRecord(s)
    const lastInjection = latestInjectionRecord(s)
    const nextInjection = nextInjectionRecord(s)
    const lastShearingValue = lastShearing
      ? formatBirthDate(lastShearing.date)
      : t('labels.notAvailable')
    const lastInjectionValue = lastInjection
      ? `${formatBirthDate(lastInjection.date)} (${lastInjection.product || t('unknown')})`
      : t('labels.notAvailable')
    const nextInjectionValue = nextInjection
      ? `${formatBirthDate(nextInjection.repeatDate)} (${nextInjection.product || t('unknown')})`
      : t('labels.notAvailable')

    return `
      <div class="sheep-card">
        <div class="sheep-card-body">
          <div class="sheep-name-row">
            <button type="button" class="sheep-tag-edit-button" data-id="${s.id}" aria-label="${t('aria.editSheepName', { tag: s.tag })}">✎</button>
            <span class="sheep-name-label">${s.tag}${s.earmark ? ` <span class="sheep-name-earmark">- ${s.earmark}</span>` : ''}${genderIcon(s.gender)}</span>
          </div>
          ${s.birthDate
            ? `<small>${t('labels.age', { age: formatAge(s.birthDate) })}</small>`
            : `<input type="date" class="sheep-birthdate-input" data-id="${s.id}" min="${MIN_SHEEP_BIRTH_DATE}" max="${todayIso()}" aria-label="${t('aria.setSheepBirthDate', { tag: s.tag })}" title="${t('aria.setSheepBirthDate', { tag: s.tag })}">`}
          <small>${paddockName(s.paddockId)}${s.zoneId ? ' / ' + zoneName(s.paddockId, s.zoneId) : ''}</small>
          <small>${scissorsIcon('inline-icon')} ${calendarIcon('inline-icon')} ${lastShearingValue}</small>
          <small>${syringeIcon('inline-icon')} ${calendarIcon('inline-icon')} ${lastInjectionValue}</small>
          <small>${syringeIcon('inline-icon')} ${repeatIcon('inline-icon')} ${nextInjectionValue}</small>
        </div>
        <div class="sheep-actions">
          <button type="button" class="sheep-injection-button" data-id="${s.id}" aria-label="${t('aria.registerSheepInjection', { tag: s.tag })}" title="${t('aria.registerSheepInjection', { tag: s.tag })}">${syringeIcon()}</button>
          <button type="button" class="sheep-shearing-button" data-id="${s.id}" aria-label="${t('aria.registerSheepShearing', { tag: s.tag })}" title="${t('aria.registerSheepShearing', { tag: s.tag })}">${scissorsIcon()}</button>
          <button type="button" class="move-button" data-id="${s.id}" aria-label="${t('actions.move')}" title="${t('actions.move')}">${doubleArrowIcon()}</button>
          <button type="button" class="sheep-delete-button" data-id="${s.id}" aria-label="${t('aria.moveSheepOut', { tag: s.tag })}" title="${t('aria.moveSheepOut', { tag: s.tag })}">${recycleBinIcon()}</button>
        </div>
      </div>
    `
  }).join('')

  const outCards = visibleOutOfFlockSheep.map(s => `
    <div class="sheep-card sheep-card--out">
      <div class="sheep-card-body">
        <div class="sheep-name-row">
          <span class="sheep-name-label">${s.tag}${s.earmark ? ` <span class="sheep-name-earmark">- ${s.earmark}</span>` : ''}${genderIcon(s.gender)}${s.outDate ? ` <span class="sheep-out-status">${outReasonIcon(s.outReason)} ${formatBirthDate(s.outDate)}</span>` : ''}</span>
        </div>
        <small class="sheep-out-reason">${outReasonLabel(s.outReason)}</small>
        ${s.outNotes ? `<small class="sheep-out-notes">${escapeHtml(s.outNotes)}</small>` : ''}
      </div>
      <div class="sheep-actions sheep-actions--single">
        <button type="button" class="sheep-out-visibility-button" data-id="${s.id}" aria-label="${t('aria.toggleOutVisibility', { tag: s.tag })}">${s.outHidden ? t('sheep.out.show') : t('sheep.out.hide')}</button>
      </div>
    </div>
  `).join('')

  if(sheepList){
    sheepList.innerHTML = `
      <div class="sheep-grid">
        <button type="button" class="add-paddock-block add-sheep-block" id="add-sheep-block" aria-label="${t('aria.addSheep')}">
          <span class="add-zone-icon">+</span>
        </button>
        ${activeCards}
      </div>
    `
  }

  if(sheepOutList){
    sheepOutList.innerHTML = `
      <div class="section-header sheep-out-header">
        <h3>${t('sheep.out.title')}</h3>
        <label class="out-of-flock-toggle" for="out-of-flock-show-all-toggle">
          <span>${t('sheep.out.showAll')}</span>
          <input type="checkbox" id="out-of-flock-show-all-toggle" class="out-of-flock-toggle-slider" ${showAllOutOfFlockSheep ? 'checked' : ''}>
        </label>
      </div>
      <div class="sheep-grid sheep-grid--out">
        ${outCards || `<div class="empty sheep-out-empty">${t('sheep.out.empty')}</div>`}
      </div>
    `
  }

  if(pedigreeList){
    const activePedigreeSheep = state.sheep.filter(isActiveFlockSheep)
    const sheepById = new Map(state.sheep.map(s => [s.id, s]))
    const truncateTag = (value) => {
      const text = (value || '-').trim() || '-'
      return text.length > 14 ? `${text.slice(0, 11)}...` : text
    }
    const sexPrefix = (sheep) => {
      if(!sheep) return ''
      if(sheep.gender === 'female') return '♀ '
      if(sheep.gender === 'male') return '♂ '
      return ''
    }
    const nodeLabel = (sheep) => {
      if(!sheep) return '-'
      return `${sexPrefix(sheep)}${truncateTag(sheep.tag || '-')}`
    }

    const pedigreeCards = activePedigreeSheep
      .filter(sheep => sheep.motherId || sheep.fatherId)
      .slice()
      .sort((a, b) => (a.tag || '').localeCompare(b.tag || '', localeTag()))
      .map(sheep => {
        const mother = sheep.motherId ? sheepById.get(sheep.motherId) : null
        const father = sheep.fatherId ? sheepById.get(sheep.fatherId) : null
        const maternalGrandMother = mother && mother.motherId ? sheepById.get(mother.motherId) : null
        const maternalGrandFather = mother && mother.fatherId ? sheepById.get(mother.fatherId) : null
        const paternalGrandMother = father && father.motherId ? sheepById.get(father.motherId) : null
        const paternalGrandFather = father && father.fatherId ? sheepById.get(father.fatherId) : null

        const tag = sheep.tag || '-'
        const motherTag = mother ? `${sexPrefix(mother)}${mother.tag || '-'}` : '-'
        const fatherTag = father ? `${sexPrefix(father)}${father.tag || '-'}` : '-'

        return `
          <article class="pedigree-single">
            <h3 class="pedigree-title">${escapeHtml(`${sexPrefix(sheep)}${tag}`)}</h3>
            <div class="pedigree-tree-wrap">
              <svg class="pedigree-tree-svg" viewBox="0 0 820 220" role="img" aria-label="${escapeHtml(tag)} ${t('section.pedigree')}">
                <line class="pedigree-line" x1="200" y1="42" x2="320" y2="73"></line>
                <line class="pedigree-line" x1="200" y1="92" x2="320" y2="73"></line>
                <line class="pedigree-line" x1="200" y1="132" x2="320" y2="163"></line>
                <line class="pedigree-line" x1="200" y1="182" x2="320" y2="163"></line>
                <line class="pedigree-line" x1="500" y1="73" x2="620" y2="118"></line>
                <line class="pedigree-line" x1="500" y1="163" x2="620" y2="118"></line>

                <rect class="pedigree-node-box" x="20" y="22" width="180" height="40" rx="10"></rect>
                <text class="pedigree-node-text" x="110" y="42" text-anchor="middle">${escapeHtml(nodeLabel(maternalGrandMother))}</text>
                <rect class="pedigree-node-box" x="20" y="72" width="180" height="40" rx="10"></rect>
                <text class="pedigree-node-text" x="110" y="92" text-anchor="middle">${escapeHtml(nodeLabel(maternalGrandFather))}</text>
                <rect class="pedigree-node-box" x="20" y="112" width="180" height="40" rx="10"></rect>
                <text class="pedigree-node-text" x="110" y="132" text-anchor="middle">${escapeHtml(nodeLabel(paternalGrandMother))}</text>
                <rect class="pedigree-node-box" x="20" y="162" width="180" height="40" rx="10"></rect>
                <text class="pedigree-node-text" x="110" y="182" text-anchor="middle">${escapeHtml(nodeLabel(paternalGrandFather))}</text>

                <rect class="pedigree-node-box" x="320" y="53" width="180" height="40" rx="10"></rect>
                <text class="pedigree-node-text" x="410" y="73" text-anchor="middle">${escapeHtml(nodeLabel(mother))}</text>
                <rect class="pedigree-node-box" x="320" y="143" width="180" height="40" rx="10"></rect>
                <text class="pedigree-node-text" x="410" y="163" text-anchor="middle">${escapeHtml(nodeLabel(father))}</text>

                <rect class="pedigree-node-box pedigree-node-box--focus" x="620" y="98" width="180" height="40" rx="10"></rect>
                <text class="pedigree-node-text pedigree-node-text--focus" x="710" y="118" text-anchor="middle">${escapeHtml(nodeLabel(sheep))}</text>
              </svg>
            </div>
            <div class="pedigree-meta">
              <div><strong>${t('pedigree.mother')}:</strong> ${escapeHtml(motherTag)}</div>
              <div><strong>${t('pedigree.father')}:</strong> ${escapeHtml(fatherTag)}</div>
            </div>
          </article>
        `
      })
      .join('')

    if(!pedigreeCards){
      pedigreeList.innerHTML = `<div class="empty">${t('pedigree.empty')}</div>`
    } else {
      pedigreeList.innerHTML = pedigreeCards
    }
  }

  if(historyList){
    const generatedHistory = groupHistoryEntries(generateHistoryFromEvents()).slice(0, 100)
    historyList.classList.toggle('is-scrollable', generatedHistory.length > 5)
    historyList.innerHTML = generatedHistory.length
      ? generatedHistory.map(h => {
          const headerParts = [
            formatDateTime(h.ts),
            h.what,
            h.detail,
            h.repeatBy ? t('history.repeatBy', { date: h.repeatBy }) : null
          ].filter(Boolean)
          const sheepLine = h.sheepNames.length ? `<div class="history-sheep-list">${h.sheepNames.map(name => `<span class="history-sheep-chip">${name}</span>`).join('')}</div>` : ''
          return `<div class="history-item"><div class="history-meta">${headerParts.join(' - ')}</div>${sheepLine}</div>`
        }).join('')
      : `<div class="empty">${t('history.empty')}</div>`
  }

  if(billingSummary){
    billingSummary.innerHTML = `
      <div class="billing-card">
        ${billingLines.map(line => `
          <div class="billing-row">
            <div>
              <strong>${line.label}</strong>
              <small>${line.included ? `${line.countLabel} · ${t('billing.included')}` : `${line.countLabel} x ${t('billing.rateMonthly', { price: formatEuro(line.rate) })}`}</small>
            </div>
            <strong>${formatEuro(line.total)}</strong>
          </div>
        `).join('')}
        <div class="billing-total">
          <span>${t('billing.total')}</span>
          <strong>${formatEuro(billingTotal)}</strong>
        </div>
      </div>
      <div class="billing-card billing-card-paypal">
        <div>
          <h3 class="billing-card-title">${t('billing.paypal.title')}</h3>
          <p class="billing-card-description">${t('billing.paypal.description')}</p>
        </div>
        <div id="billing-paypal-status" class="billing-paypal-status"></div>
        <div id="billing-paypal-button" class="billing-paypal-button"></div>
      </div>
    `
    renderPayPalBillingBlock()
  }

  const sheepModal = document.getElementById('sheep-modal')
  const isSheepModalOpen = !!sheepModal && !sheepModal.classList.contains('hidden')
  if(!isSheepModalOpen){
    if(sheepPaddockModal && sheepZoneModal){
      setSheepModalDefaultSelection()
    }
    populateParentSheepSelects()
  }

  if(movePaddockModal){
    populatePaddockSelect(movePaddockModal)
  }
  if(moveZoneModal){
    moveZoneModal.innerHTML = `<option value="">${t('select.paddock.first')}</option>`
    moveZoneModal.disabled = true
  }

  renderPlanning()
}

function renderPaddock(p){
  const isExpanded = !collapsedPaddockIds.has(p.id)
  const isWeatherExpanded = expandedWeatherPaddocks.has(p.id)
  const paddockPostcode = (p.postcode || '').trim()
  const paddockCountry = paddockPostcode ? detectPostcodeCountry(paddockPostcode) : null
  const paddockFlagCode = paddockCountry ? paddockCountry.toLowerCase() : ''
  const paddockFlagHtml = paddockFlagCode
    ? `<img class="paddock-flag" src="flags/${paddockFlagCode}.png" alt="${paddockCountry} flag">`
    : ''
  const paddockTotalArea = p.zones.reduce((sum, zone) => sum + (Number.isFinite(zone.area) ? zone.area : 0), 0)
  const paddockSheepCount = state.sheep.filter(s => isActiveFlockSheep(s) && s.paddockId === p.id && p.zones.some(z => z.id === s.zoneId)).length
  const areaLabel = `${new Intl.NumberFormat(localeTag(), { maximumFractionDigits: 2 }).format(paddockTotalArea)} m2`
  const sheepLabel = `${paddockSheepCount} ${paddockSheepCount === 1 ? t('paddock.sheep.singular') : t('paddock.sheep.plural')}`
  const injectionButtonHtml = paddockSheepCount > 0
    ? `<button type="button" class="paddock-injection-button" data-paddock-id="${p.id}" aria-label="${t('aria.registerInjection', { paddock: p.name })}" title="${t('aria.registerInjection', { paddock: p.name })}">${syringeIcon()}</button>`
    : ''
  const shearingButtonHtml = paddockSheepCount > 0
    ? `<button type="button" class="paddock-shearing-button" data-paddock-id="${p.id}" aria-label="${t('aria.registerShearing', { paddock: p.name })}" title="${t('aria.registerShearing', { paddock: p.name })}">${scissorsIcon()}</button>`
    : ''
  const canDeletePaddock = !isStalPaddock(p)
  // Build today's temp badge from weather cache
  const _postcodeKey = paddockPostcode.toUpperCase()
  const _cached = paddockPostcode ? weatherCache[_postcodeKey] : null
  const _isFresh = !!_cached && (Date.now() - _cached.fetchedAt) < WEATHER_TTL_MS
  if(paddockPostcode && (!_cached || !_isFresh) && !weatherLoading.has(_postcodeKey)){
    loadWeatherForPostcode(_postcodeKey)
  }
  let tempBadgeContent = ''
  if(paddockPostcode){
    if(_cached && _isFresh && !_cached.error && _cached.days && _cached.days[0]){
      const _today = _cached.days[0]
      tempBadgeContent = `${_today.min}° / ${_today.max}°`
    } else if(weatherLoading.has(_postcodeKey)){
      tempBadgeContent = '…°'
    } else {
      tempBadgeContent = '?°'
    }
  }
  const tempBadgeHtml = paddockPostcode
    ? `<button type="button" class="badge temp-badge weather-toggle-button" data-paddock-id="${p.id}" aria-label="${t('aria.weatherForecast')}" title="${t('aria.weatherForecast')}">${isWeatherExpanded ? '▾' : '▸'} 🌡 ${tempBadgeContent}</button>`
    : ''
  return `<div class="card" data-id="${p.id}" ${isExpanded ? 'data-expanded="true"' : ''}>
    <div class="card-header" data-paddock-id="${p.id}" style="user-select:none">
      <div class="card-header-main">
        <button type="button" class="paddock-edit-button" data-paddock-id="${p.id}" aria-label="${t('aria.editPaddock')}">✎</button>
        <button type="button" class="paddock-collapse-button" data-paddock-id="${p.id}" aria-label="${isExpanded ? t('aria.collapsePaddock') : t('aria.expandPaddock')}">${isExpanded ? '▾' : '▸'}</button>
        <strong>${p.name}</strong>
        ${injectionButtonHtml}
        ${shearingButtonHtml}
        ${paddockPostcode ? `<span class="badge paddock-postcode">${paddockFlagHtml}${paddockPostcode}</span>` : ''}
        <span class="badge">${areaLabel}</span>
        <span class="badge">${sheepLabel}</span>
        ${tempBadgeHtml}
      </div>
      <div class="card-header-actions">
        ${canDeletePaddock ? `<button type="button" class="paddock-delete-button" data-paddock-id="${p.id}" aria-label="${t('aria.deletePaddock')}">${recycleBinIcon()}</button>` : ''}
      </div>
    </div>
    ${renderPaddockWeather(p, isWeatherExpanded)}
    <div class="zone-list" ${isExpanded ? '' : 'style="display:none"'}>
      ${p.zones.map(z => {
        const sheepInZone = state.sheep.filter(s => isActiveFlockSheep(s) && s.paddockId === p.id && s.zoneId === z.id)
        const sheepCount = sheepInZone.length
        const isZoneEmpty = sheepCount === 0
        const occupiedDays = sheepCount ? daysSince(z.occupiedSince) : null
        const zoneStatus = sheepCount
          ? t('zone.status.occupiedSince', { days: occupiedDays })
          : t('zone.status.empty', { days: daysSince(z.emptySince) })
        const zoneStatusClass = isZoneEmpty
          ? 'zone-status zone-status--empty'
          : `zone-status ${occupancyAgeClass(occupiedDays)}`
        const zoneArea = z.area !== null ? `${z.area} m2` : ''
        const zonePerimeter = z.perimeter !== null ? `${z.perimeter} m` : ''
        const bulkMoveButton = sheepCount > 1 ? `<button type="button" class="zone-bulk-move-button" data-paddock-id="${p.id}" data-zone-id="${z.id}" aria-label="${t('zone.bulkMove')}" title="${t('zone.bulkMove')}">${doubleArrowIcon()}</button>` : ''
        const sheepList = sheepCount
          ? `<div class="zone-sheep-list${sheepCount > 4 ? ' is-scrollable' : ''}">${sheepInZone.map(s => `<button type="button" class="zone-sheep-link" data-sheep-id="${s.id}" aria-label="${t('aria.moveSheep', { tag: s.tag })}">${sheepIcon()}${s.tag}</button>`).join('')}</div>${bulkMoveButton}`
          : ''
        const headerZoneStatus = `<div class="${zoneStatusClass}">${zoneStatus}</div>`
        const stallZone = isStalZone(p, z)
        const useStallBackground = isStalPaddock(p)
        const canDeleteZone = !stallZone && p.zones.length > 1
        return `<div class="zone-item${useStallBackground ? ' stall-zone-item' : ''}" data-paddock-id="${p.id}" data-zone-id="${z.id}">${canDeleteZone ? `<button type="button" class="zone-delete-button" data-paddock-id="${p.id}" data-zone-id="${z.id}" aria-label="${t('aria.deleteZone')}">${recycleBinIcon()}</button>` : ''}<div class="zone-header"><div class="zone-title-row"><button type="button" class="zone-edit-button" data-paddock-id="${p.id}" data-zone-id="${z.id}" aria-label="${t('aria.editZone')}">✎</button><strong>${z.name} (${sheepCount})</strong></div><div class="zone-metrics">${zoneArea ? `<span class="zone-metric">${zoneArea}</span>` : ''}${zonePerimeter ? `<span class="zone-metric">${zonePerimeter}</span>` : ''}${headerZoneStatus}</div></div><div class="zone-bottom">${sheepList}</div></div>`
      }).join('')}
      <button type="button" class="zone-item add-zone-button${isStalPaddock(p) ? ' stall-zone-item' : ''}" data-paddock-id="${p.id}" aria-label="${t('aria.addZone')}">
        <span class="add-zone-icon">+</span>
      </button>
    </div>
  </div>`
}

function paddockName(id){
  const p = state.paddocks.find(x=>x.id===id)
  return p ? p.name : t('unknown')
}

function zoneName(paddockId, zoneId){
  const zone = getZone(paddockId, zoneId)
  return zone ? zone.name : t('unknown')
}

function getPaddock(id){ return state.paddocks.find(x => x.id === id) }

function getZone(paddockId, zoneId){
  const paddock = getPaddock(paddockId)
  return paddock ? paddock.zones.find(x => x.id === zoneId) : null
}

function normalizeEarmark(value){
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function isEarmarkInUse(earmark, excludeSheepId = null){
  const normalized = normalizeEarmark(earmark)
  if(!normalized) return false
  return state.sheep.some(s => s.id !== excludeSheepId && normalizeEarmark(s.earmark) === normalized)
}

function setSheepModalDefaultSelection(){
  const sheepPaddockModal = document.getElementById('sheep-paddock-modal')
  const sheepZoneModal = document.getElementById('sheep-zone-modal')
  const birthDateInput = document.getElementById('sheep-modal-birth-date')
  if(!sheepPaddockModal || !sheepZoneModal) return

  if(birthDateInput){
    birthDateInput.setAttribute('min', MIN_SHEEP_BIRTH_DATE)
    birthDateInput.setAttribute('max', todayIso())
  }

  populatePaddockSelect(sheepPaddockModal)

  const stalPaddock = state.paddocks.find(p => isStalPaddock(p))
  const selectedPaddock = stalPaddock || state.paddocks[0]
  if(!selectedPaddock){
    sheepZoneModal.innerHTML = `<option value="">${t('select.paddock.first')}</option>`
    sheepZoneModal.disabled = true
    return
  }

  sheepPaddockModal.value = selectedPaddock.id
  if(selectedPaddock.zones.length){
    sheepZoneModal.innerHTML = `<option value="" selected disabled hidden>${t('select.zone.choose')}</option>` + selectedPaddock.zones.map(z => `<option value="${z.id}">${z.name}</option>`).join('')
    sheepZoneModal.disabled = false

    const stalZone = selectedPaddock.zones.find(z => typeof z.name === 'string' && z.name.toLowerCase() === 'stal')
    if(stalZone){
      sheepZoneModal.value = stalZone.id
    } else if(selectedPaddock.zones.length === 1){
      sheepZoneModal.value = selectedPaddock.zones[0].id
    } else {
      sheepZoneModal.value = ''
    }
  } else {
    sheepZoneModal.innerHTML = `<option value="">${t('select.zone.noneAvailable')}</option>`
    sheepZoneModal.disabled = true
  }
}

function populateParentSheepSelects(){
  const motherSelect = document.getElementById('sheep-mother-modal')
  const fatherSelect = document.getElementById('sheep-father-modal')
  const femaleOptions = state.sheep
    .filter(s => isActiveFlockSheep(s) && s.gender === 'female')
    .map(s => `<option value="${s.id}">${s.tag}</option>`)
    .join('')
  const maleOptions = state.sheep
    .filter(s => isActiveFlockSheep(s) && s.gender === 'male')
    .map(s => `<option value="${s.id}">${s.tag}</option>`)
    .join('')

  if(motherSelect){
    motherSelect.innerHTML = `<option value="">${t('select.parent.mother')}</option>${femaleOptions}`
  }
  if(fatherSelect){
    fatherSelect.innerHTML = `<option value="">${t('select.parent.father')}</option>${maleOptions}`
  }
}

function populatePaddockSelect(select){
  if(!select) return
  select.innerHTML = `<option value="" selected disabled hidden>${t('select.paddock.choose')}</option>` + state.paddocks.map(p => `<option value="${p.id}">${p.name}</option>`).join('')
}

function zoneSheepNames(paddockId, zoneId){
  return state.sheep
    .filter(s => isActiveFlockSheep(s) && s.paddockId === paddockId && s.zoneId === zoneId)
    .map(s => s.tag)
}

function sheepIcon(){
  return `<img src="schaap.png" alt="schaap" class="sheep-icon"/>`
}

function genderIcon(gender){
  if(gender === 'male') return `<span class="gender-symbol male" aria-hidden="true">♂</span>`
  if(gender === 'female') return `<span class="gender-symbol female" aria-hidden="true">♀</span>`
  return ''
}

function uid(){ return Math.random().toString(36).slice(2,9) }

function isStalPaddock(paddock){
  return !!paddock && typeof paddock.name === 'string' && paddock.name.toLowerCase() === 'stal'
}

function isStalZone(paddock, zone){
  return isStalPaddock(paddock) && !!zone && typeof zone.name === 'string' && zone.name.toLowerCase() === 'stal'
}

let activeMoveSheepId = null
let activeEditSheepId = null
let activeEditPaddockId = null
let activeEditZoneRef = null
let pendingZoneDeletion = null
let pendingPaddockDeletion = null
let pendingZoneBulkMove = null

function availableTargetZones(targetPaddockId, sourcePaddockId = pendingZoneDeletion?.sourcePaddockId, sourceZoneId = pendingZoneDeletion?.sourceZoneId){
  const targetPaddock = getPaddock(targetPaddockId)
  if(!targetPaddock) return []
  if(!sourcePaddockId || !sourceZoneId) return targetPaddock.zones
  return targetPaddock.zones.filter(z => !(targetPaddockId === sourcePaddockId && z.id === sourceZoneId))
}

function populateZoneDeleteMoveTargets(selectedPaddockId){
  const paddockSelect = document.getElementById('zone-delete-target-paddock-modal')
  const zoneSelect = document.getElementById('zone-delete-target-zone-modal')
  const submitBtn = document.getElementById('zone-delete-move-submit')
  if(!paddockSelect || !zoneSelect || !pendingZoneDeletion) return

  const sourcePaddock = getPaddock(pendingZoneDeletion.sourcePaddockId)
  if(!sourcePaddock) return

  paddockSelect.innerHTML = `<option value="${sourcePaddock.id}" selected>${sourcePaddock.name}</option>`
  paddockSelect.disabled = true

  const zones = availableTargetZones(sourcePaddock.id, sourcePaddock.id, pendingZoneDeletion.sourceZoneId)
  if(zones.length){
    zoneSelect.innerHTML = `<option value="" selected disabled hidden>${t('select.zone.choose')}</option>` + zones.map(z => `<option value="${z.id}">${z.name}</option>`).join('')
    zoneSelect.disabled = false
    if(zones.length === 1){
      zoneSelect.value = zones[0].id
      if(submitBtn) submitBtn.disabled = false
    } else {
      zoneSelect.value = ''
      if(submitBtn) submitBtn.disabled = true
    }
  } else {
    zoneSelect.innerHTML = `<option value="">${t('select.zone.noneAvailable')}</option>`
    zoneSelect.disabled = true
    if(submitBtn) submitBtn.disabled = true
  }
}

function openZoneDeleteMoveModal(sourcePaddockId, sourceZoneId, sheepCount){
  const sourcePaddock = getPaddock(sourcePaddockId)
  const sourceZone = getZone(sourcePaddockId, sourceZoneId)
  if(!sourcePaddock || !sourceZone) return

  if(isStalZone(sourcePaddock, sourceZone)){
    alert(t('alert.stalZoneDelete'))
    return
  }

  if(sourcePaddock.zones.length <= 1){
    alert(t('alert.zoneMinimum'))
    return
  }

  const hasTarget = availableTargetZones(sourcePaddockId, sourcePaddockId, sourceZoneId).length > 0
  if(!hasTarget){
    alert(t('alert.noTargetZoneInPaddock'))
    return
  }

  const allTargets = availableTargetZones(sourcePaddockId, sourcePaddockId, sourceZoneId)
    .map(z => ({ paddockId: sourcePaddockId, zoneId: z.id }))
  if(allTargets.length === 1){
    const target = allTargets[0]
    const sheepToMove = state.sheep.filter(s => s.paddockId === sourcePaddockId && s.zoneId === sourceZoneId)
    const fromLabel = `${sourcePaddock.name} / ${sourceZone.name}`
    const toLabel = `${paddockName(target.paddockId)} / ${zoneName(target.paddockId, target.zoneId)}`
    sheepToMove.forEach(sheep => {
      addEvent('SHEEP_MOVED', {
        sheep: sheep.tag,
        from: fromLabel,
        to: toLabel
      })
    })
    state.sheep.forEach(s => {
      if(s.paddockId === sourcePaddockId && s.zoneId === sourceZoneId){
        s.paddockId = target.paddockId
        s.zoneId = target.zoneId
        s.lastUpdated = Date.now()
      }
    })
    sourcePaddock.zones = sourcePaddock.zones.filter(z => z.id !== sourceZoneId)
    addEvent('ZONE_DELETED', {
      zoneId: sourceZoneId,
      paddockId: sourcePaddockId,
      name: sourceZone.name,
      sheepMovedCount: sheepToMove.length
    })
    save(); render()
    return
  }

  const sourceLabel = document.getElementById('zone-delete-source-name')
  const sheepLabel = document.getElementById('zone-delete-sheep-count')
  if(sourceLabel){
    sourceLabel.textContent = `${sourcePaddock.name} / ${sourceZone.name}`
  }
  if(sheepLabel){
    sheepLabel.textContent = `${sheepCount} ${sheepCount === 1 ? t('entity.sheep') : t('entity.sheep')}`
  }

  pendingZoneDeletion = { sourcePaddockId, sourceZoneId }

  populateZoneDeleteMoveTargets(sourcePaddockId)
  openModal('zone-delete-move-modal')
}

function closeZoneDeleteMoveModal(){
  pendingZoneDeletion = null
  closeModal('zone-delete-move-modal')
}

function availableTargetPaddocksForDelete(sourcePaddockId){
  return state.paddocks.filter(p => p.id !== sourcePaddockId && p.zones.length > 0)
}

function availableBulkMoveTargetZones(targetPaddockId, sourcePaddockId, sourceZoneId){
  const targetPaddock = getPaddock(targetPaddockId)
  if(!targetPaddock) return []
  return targetPaddock.zones.filter(z => !(targetPaddockId === sourcePaddockId && z.id === sourceZoneId))
}

function availableBulkMoveTargetPaddocks(sourcePaddockId, sourceZoneId){
  return state.paddocks.filter(p => availableBulkMoveTargetZones(p.id, sourcePaddockId, sourceZoneId).length > 0)
}

function populateZoneBulkMoveTargets(selectedPaddockId){
  const paddockSelect = document.getElementById('zone-bulk-move-target-paddock-modal')
  const zoneSelect = document.getElementById('zone-bulk-move-target-zone-modal')
  const submitBtn = document.getElementById('zone-bulk-move-submit')
  if(!paddockSelect || !zoneSelect || !pendingZoneBulkMove) return

  const targetPaddocks = availableBulkMoveTargetPaddocks(pendingZoneBulkMove.sourcePaddockId, pendingZoneBulkMove.sourceZoneId)
  if(!targetPaddocks.length){
    paddockSelect.innerHTML = `<option value="">${t('alert.noTargetPaddock')}</option>`
    paddockSelect.disabled = true
    zoneSelect.innerHTML = `<option value="">${t('select.zone.noneAvailable')}</option>`
    zoneSelect.disabled = true
    if(submitBtn) submitBtn.disabled = true
    return
  }

  const effectivePaddockId = selectedPaddockId || targetPaddocks[0].id
  paddockSelect.disabled = false
  paddockSelect.innerHTML = `<option value="" disabled hidden>${t('select.paddock.choose')}</option>` + targetPaddocks.map(p => `<option value="${p.id}"${p.id === effectivePaddockId ? ' selected' : ''}>${p.name}</option>`).join('')

  const zones = availableBulkMoveTargetZones(effectivePaddockId, pendingZoneBulkMove.sourcePaddockId, pendingZoneBulkMove.sourceZoneId)
  if(zones.length){
    zoneSelect.innerHTML = `<option value="" selected disabled hidden>${t('select.zone.choose')}</option>` + zones.map(z => `<option value="${z.id}">${z.name}</option>`).join('')
    zoneSelect.disabled = false
    if(zones.length === 1){
      zoneSelect.value = zones[0].id
      if(submitBtn) submitBtn.disabled = false
    } else {
      zoneSelect.value = ''
      if(submitBtn) submitBtn.disabled = true
    }
  } else {
    zoneSelect.innerHTML = `<option value="">${t('select.zone.noneAvailable')}</option>`
    zoneSelect.disabled = true
    if(submitBtn) submitBtn.disabled = true
  }
}

function openZoneBulkMoveModal(sourcePaddockId, sourceZoneId){
  const sourcePaddock = getPaddock(sourcePaddockId)
  const sourceZone = getZone(sourcePaddockId, sourceZoneId)
  if(!sourcePaddock || !sourceZone) return

  const sheepInZone = state.sheep.filter(s => s.paddockId === sourcePaddockId && s.zoneId === sourceZoneId)
  if(!sheepInZone.length){
    alert(t('alert.noSheepInZone'))
    return
  }

  const targetPaddocks = availableBulkMoveTargetPaddocks(sourcePaddockId, sourceZoneId)
  if(!targetPaddocks.length){
    alert(t('alert.noTargetZone'))
    return
  }

  pendingZoneBulkMove = { sourcePaddockId, sourceZoneId }

  const sourceLabel = document.getElementById('zone-bulk-move-source-name')
  const sheepLabel = document.getElementById('zone-bulk-move-sheep-count')
  if(sourceLabel){
    sourceLabel.textContent = `${sourcePaddock.name} / ${sourceZone.name}`
  }
  if(sheepLabel){
    sheepLabel.textContent = `${sheepInZone.length} ${sheepInZone.length === 1 ? t('entity.sheep') : t('entity.sheep')}`
  }

  populateZoneBulkMoveTargets(targetPaddocks[0].id)
  openModal('zone-bulk-move-modal')
}

function closeZoneBulkMoveModal(){
  pendingZoneBulkMove = null
  closeModal('zone-bulk-move-modal')
}

function populatePaddockDeleteMoveTargets(selectedPaddockId){
  const paddockSelect = document.getElementById('paddock-delete-target-paddock-modal')
  const zoneSelect = document.getElementById('paddock-delete-target-zone-modal')
  const submitBtn = document.getElementById('paddock-delete-move-submit')
  if(!paddockSelect || !zoneSelect || !pendingPaddockDeletion) return

  const targetPaddocks = availableTargetPaddocksForDelete(pendingPaddockDeletion.sourcePaddockId)
  paddockSelect.innerHTML = `<option value="" selected disabled hidden>${t('select.paddock.choose')}</option>` + targetPaddocks.map(p => `<option value="${p.id}"${p.id === selectedPaddockId ? ' selected' : ''}>${p.name}</option>`).join('')

  const targetPaddockId = selectedPaddockId || paddockSelect.value
  const targetPaddock = getPaddock(targetPaddockId)
  const zones = targetPaddock ? targetPaddock.zones : []
  if(zones.length){
    zoneSelect.innerHTML = `<option value="" selected disabled hidden>${t('select.zone.choose')}</option>` + zones.map(z => `<option value="${z.id}">${z.name}</option>`).join('')
    zoneSelect.disabled = false
    if(zones.length === 1){
      zoneSelect.value = zones[0].id
      if(submitBtn) submitBtn.disabled = false
    } else {
      zoneSelect.value = ''
      if(submitBtn) submitBtn.disabled = true
    }
  } else {
    zoneSelect.innerHTML = `<option value="">${t('select.zone.noneAvailable')}</option>`
    zoneSelect.disabled = true
    if(submitBtn) submitBtn.disabled = true
  }
}

function openPaddockDeleteMoveModal(sourcePaddockId, sheepCount){
  const sourcePaddock = getPaddock(sourcePaddockId)
  if(!sourcePaddock) return

  const targetPaddocks = availableTargetPaddocksForDelete(sourcePaddockId)
  if(!targetPaddocks.length){
    alert(t('alert.noTargetPaddock'))
    return
  }

  const allTargets = targetPaddocks.flatMap(p => p.zones.map(z => ({ paddockId: p.id, zoneId: z.id })))
  if(allTargets.length === 1){
    const target = allTargets[0]
    const sheepToMove = state.sheep.filter(s => s.paddockId === sourcePaddockId)
    const toLabel = `${paddockName(target.paddockId)} / ${zoneName(target.paddockId, target.zoneId)}`
    sheepToMove.forEach(sheep => {
      const fromLabel = `${sourcePaddock.name}${sheep.zoneId ? ' / ' + zoneName(sourcePaddockId, sheep.zoneId) : ''}`
      addEvent('SHEEP_MOVED', {
        sheep: sheep.tag,
        from: fromLabel,
        to: toLabel
      })
    })
    state.sheep.forEach(s => {
      if(s.paddockId === sourcePaddockId){
        s.paddockId = target.paddockId
        s.zoneId = target.zoneId
        s.lastUpdated = Date.now()
      }
    })
    state.paddocks = state.paddocks.filter(p => p.id !== sourcePaddockId)
    collapsedPaddockIds.delete(sourcePaddockId)
    addEvent('PADDOCK_DELETED', {
      paddockId: sourcePaddockId,
      name: sourcePaddock.name,
      sheepMovedCount: sheepToMove.length
    })
    save(); render()
    return
  }

  pendingPaddockDeletion = { sourcePaddockId }

  const sourceLabel = document.getElementById('paddock-delete-source-name')
  const sheepLabel = document.getElementById('paddock-delete-sheep-count')
  if(sourceLabel){
    sourceLabel.textContent = sourcePaddock.name
  }
  if(sheepLabel){
    sheepLabel.textContent = `${sheepCount} ${sheepCount === 1 ? t('entity.sheep') : t('entity.sheep')}`
  }

  populatePaddockDeleteMoveTargets(targetPaddocks[0].id)
  openModal('paddock-delete-move-modal')
}

function closePaddockDeleteMoveModal(){
  pendingPaddockDeletion = null
  closeModal('paddock-delete-move-modal')
}

function populateMoveModalPaddocks(selectedPaddockId){
  const movePaddockModal = document.getElementById('move-paddock-modal')
  const moveZoneModal = document.getElementById('move-zone-modal')
  const submitBtn = document.getElementById('move-modal-submit')
  if(!movePaddockModal || !moveZoneModal) return

  movePaddockModal.innerHTML = `<option value="" selected disabled hidden>${t('select.paddock.choose')}</option>` + state.paddocks.map(p => `<option value="${p.id}"${p.id === selectedPaddockId ? ' selected' : ''}>${p.name}</option>`).join('')

  const selected = getPaddock(selectedPaddockId)
  if(selected && selected.zones.length){
    moveZoneModal.innerHTML = `<option value="" selected disabled hidden>${t('select.zone.choose')}</option>` + selected.zones.map(z => `<option value="${z.id}">${z.name}</option>`).join('')
    moveZoneModal.disabled = false
    if(selected.zones.length === 1){
      moveZoneModal.value = selected.zones[0].id
      if(submitBtn) submitBtn.disabled = false
    } else {
      moveZoneModal.value = ''
      if(submitBtn) submitBtn.disabled = true
    }
  } else {
    moveZoneModal.innerHTML = selected ? `<option value="">${t('select.zone.noneAvailable')}</option>` : `<option value="">${t('select.paddock.first')}</option>`
    moveZoneModal.disabled = !selected || selected.zones.length === 0
    if(submitBtn) submitBtn.disabled = true
  }
}

function openMoveModal(sheepId){
  const sheep = state.sheep.find(s => s.id === sheepId)
  if(!sheep) return
  activeMoveSheepId = sheepId

  const label = document.getElementById('move-modal-sheep-name')
  if(label){
    label.textContent = `${sheep.tag} — ${paddockName(sheep.paddockId)}${sheep.zoneId ? ' / ' + zoneName(sheep.paddockId, sheep.zoneId) : ''}`
  }

  populateMoveModalPaddocks(sheep.paddockId)
  const moveZoneModal = document.getElementById('move-zone-modal')
  if(moveZoneModal && sheep.zoneId){
    moveZoneModal.value = sheep.zoneId
  }

  const modal = document.getElementById('move-modal')
  if(modal){
    modal.classList.remove('hidden')
    modal.setAttribute('aria-hidden', 'false')
  }
}

function openEditSheepTagModal(sheepId){
  const sheep = state.sheep.find(s => s.id === sheepId)
  if(!sheep) return
  activeEditSheepId = sheepId

  const input = document.getElementById('sheep-tag-edit-input')
  if(input){
    input.value = sheep.tag
  }
  const earmarkText = document.getElementById('sheep-edit-earmark-text')
  const earmarkInput = document.getElementById('sheep-edit-earmark-input')
  const birthDateText = document.getElementById('sheep-edit-birth-date-text')
  const birthDateInput = document.getElementById('sheep-edit-birth-date-input')
  if(earmarkText && earmarkInput){
    if(sheep.earmark){
      earmarkText.textContent = sheep.earmark
      earmarkText.hidden = false
      earmarkInput.hidden = true
      earmarkInput.disabled = true
      earmarkInput.value = ''
    } else {
      earmarkText.hidden = true
      earmarkInput.hidden = false
      earmarkInput.disabled = false
      earmarkInput.value = ''
    }
  }
  if(birthDateText && birthDateInput){
    if(sheep.birthDate){
      birthDateText.textContent = formatBirthDate(sheep.birthDate)
      birthDateText.hidden = false
      birthDateInput.hidden = true
      birthDateInput.disabled = true
      birthDateInput.value = ''
    } else {
      birthDateText.hidden = true
      birthDateInput.hidden = false
      birthDateInput.disabled = false
      birthDateInput.value = ''
    }
  }
  const genderDisplay = document.getElementById('sheep-edit-gender-display')
  if(genderDisplay){
    if(sheep.gender === 'female'){
      genderDisplay.innerHTML = `<span class="gender-symbol female" aria-hidden="true">♀</span> ${t('sheep.gender.female')}`
    } else if(sheep.gender === 'male'){
      genderDisplay.innerHTML = `<span class="gender-symbol male" aria-hidden="true">♂</span> ${t('sheep.gender.male')}`
    } else {
      genderDisplay.textContent = '-'
    }
  }

  const pedigreeDisplay = document.getElementById('sheep-edit-pedigree-display')
  if(pedigreeDisplay){
    const father = sheep.fatherId ? state.sheep.find(s => s.id === sheep.fatherId) : null
    const mother = sheep.motherId ? state.sheep.find(s => s.id === sheep.motherId) : null
    const fatherLabel = father ? father.tag : '-'
    const motherLabel = mother ? mother.tag : '-'
    pedigreeDisplay.textContent = `"${fatherLabel}" x "${motherLabel}"`
  }

  const locationDisplay = document.getElementById('sheep-edit-location-display')
  const paddock = getPaddock(sheep.paddockId)
  const zone = sheep.zoneId ? getZone(sheep.paddockId, sheep.zoneId) : null
  if(locationDisplay){
    const paddockLabel = paddock ? paddock.name : t('sheep.location.unknownPaddock')
    const zoneLabel = sheep.zoneId ? (zone ? zone.name : t('sheep.location.unknownZone')) : t('sheep.location.none')
    locationDisplay.textContent = `${paddockLabel} / ${zoneLabel}`
  }

  const modal = document.getElementById('sheep-tag-edit-modal')
  if(modal){
    modal.classList.remove('hidden')
    modal.setAttribute('aria-hidden', 'false')
  }

  if(input){
    input.focus()
    input.select()
  }
}

function closeEditSheepTagModal(){
  activeEditSheepId = null
  closeModal('sheep-tag-edit-modal')
}

function openEditPaddockModal(paddockId){
  const paddock = getPaddock(paddockId)
  if(!paddock) return
  activeEditPaddockId = paddockId

  const nameInput = document.getElementById('paddock-edit-name')
  const postcodeInput = document.getElementById('paddock-edit-postcode')
  if(nameInput){
    nameInput.value = paddock.name || ''
    nameInput.disabled = isStalPaddock(paddock)
  }
  if(postcodeInput){
    postcodeInput.value = paddock.postcode || ''
  }

  openModal('paddock-edit-modal')
}

function closeEditPaddockModal(){
  activeEditPaddockId = null
  closeModal('paddock-edit-modal')
}

function renderPaddockSheepSelection(containerId, inputName, paddockId){
  const container = document.getElementById(containerId)
  if(!container) return

  const sheepInPaddock = state.sheep
    .filter(s => s.paddockId === paddockId)
    .sort((a, b) => a.tag.localeCompare(b.tag, localeTag()))

  if(!sheepInPaddock.length){
    container.innerHTML = `<div class="empty">${t('sheep.empty')}</div>`
    return
  }

  container.innerHTML = sheepInPaddock.map(sheep => `
    <label class="modal-sheep-option" for="${inputName}-${sheep.id}">
      <input id="${inputName}-${sheep.id}" type="checkbox" name="${inputName}" value="${sheep.id}" checked>
      <span>${sheep.tag}</span>
    </label>
  `).join('')
}

function renderZoneSheepSelection(containerId, inputName, paddockId, zoneId){
  const container = document.getElementById(containerId)
  if(!container) return

  const sheepInZone = state.sheep
    .filter(s => s.paddockId === paddockId && s.zoneId === zoneId)
    .sort((a, b) => a.tag.localeCompare(b.tag, localeTag()))

  if(!sheepInZone.length){
    container.innerHTML = `<div class="empty">${t('sheep.empty')}</div>`
    return
  }

  container.innerHTML = sheepInZone.map(sheep => `
    <label class="modal-sheep-option" for="${inputName}-${sheep.id}">
      <input id="${inputName}-${sheep.id}" type="checkbox" name="${inputName}" value="${sheep.id}" checked>
      <span>${sheep.tag}</span>
    </label>
  `).join('')
}

function openPaddockInjectionModal(paddockId, zoneId = null){
  const paddock = getPaddock(paddockId)
  if(!paddock) return
  pendingInjectionPaddockId = paddockId
  pendingInjectionZoneId = zoneId || null

  const paddockNameEl = document.getElementById('paddock-injection-paddock-name')
  const dateInput = document.getElementById('paddock-injection-date')
  const productInput = document.getElementById('paddock-injection-product')
  const repeatDateInput = document.getElementById('paddock-injection-repeat-date')
  const noRepeatInput = document.getElementById('paddock-injection-no-repeat')

  const displayName = zoneId ? zoneName(paddockId, zoneId) : paddock.name
  if(paddockNameEl) paddockNameEl.textContent = displayName
  if(dateInput) dateInput.value = todayIso()
  if(productInput) productInput.value = ''
  if(repeatDateInput) repeatDateInput.value = oneYearFromTodayIso()
  if(noRepeatInput) noRepeatInput.checked = false
  if(repeatDateInput){
    repeatDateInput.min = todayIso()
    repeatDateInput.disabled = false
    repeatDateInput.required = true
  }
  if(zoneId){
    renderZoneSheepSelection('paddock-injection-sheep-list', 'paddock-injection-sheep', paddockId, zoneId)
  } else {
    renderPaddockSheepSelection('paddock-injection-sheep-list', 'paddock-injection-sheep', paddockId)
  }

  openModal('paddock-injection-modal')
}

function closePaddockInjectionModal(){
  pendingInjectionPaddockId = null
  pendingInjectionZoneId = null
  closeModal('paddock-injection-modal')
}

function openPaddockShearingModal(paddockId, zoneId = null){
  const paddock = getPaddock(paddockId)
  if(!paddock) return
  pendingShearingPaddockId = paddockId
  pendingShearingZoneId = zoneId || null

  const paddockNameEl = document.getElementById('paddock-shearing-paddock-name')
  const dateInput = document.getElementById('paddock-shearing-date')

  const displayName = zoneId ? zoneName(paddockId, zoneId) : paddock.name
  if(paddockNameEl) paddockNameEl.textContent = displayName
  if(dateInput) dateInput.value = todayIso()
  if(zoneId){
    renderZoneSheepSelection('paddock-shearing-sheep-list', 'paddock-shearing-sheep', paddockId, zoneId)
  } else {
    renderPaddockSheepSelection('paddock-shearing-sheep-list', 'paddock-shearing-sheep', paddockId)
  }

  openModal('paddock-shearing-modal')
}

function closePaddockShearingModal(){
  pendingShearingPaddockId = null
  pendingShearingZoneId = null
  closeModal('paddock-shearing-modal')
}

function openSheepInjectionModal(sheepId){
  const sheep = state.sheep.find(s => s.id === sheepId)
  if(!sheep) return
  pendingInjectionSheepId = sheepId

  const sheepNameEl = document.getElementById('sheep-injection-sheep-name')
  const dateInput = document.getElementById('sheep-injection-date')
  const productInput = document.getElementById('sheep-injection-product')
  const repeatDateInput = document.getElementById('sheep-injection-repeat-date')
  const noRepeatInput = document.getElementById('sheep-injection-no-repeat')

  if(sheepNameEl) sheepNameEl.textContent = sheep.tag
  if(dateInput) dateInput.value = todayIso()
  if(productInput) productInput.value = ''
  if(repeatDateInput) repeatDateInput.value = oneYearFromTodayIso()
  if(noRepeatInput) noRepeatInput.checked = false
  if(repeatDateInput){
    repeatDateInput.min = todayIso()
    repeatDateInput.disabled = false
    repeatDateInput.required = true
  }

  openModal('sheep-injection-modal')
}

function closeSheepInjectionModal(){
  pendingInjectionSheepId = null
  closeModal('sheep-injection-modal')
}

function openSheepShearingModal(sheepId){
  const sheep = state.sheep.find(s => s.id === sheepId)
  if(!sheep) return
  pendingShearingSheepId = sheepId

  const sheepNameEl = document.getElementById('sheep-shearing-sheep-name')
  const dateInput = document.getElementById('sheep-shearing-date')

  if(sheepNameEl) sheepNameEl.textContent = sheep.tag
  if(dateInput) dateInput.value = todayIso()

  openModal('sheep-shearing-modal')
}

function closeSheepShearingModal(){
  pendingShearingSheepId = null
  closeModal('sheep-shearing-modal')
}

function openEditZoneModal(paddockId, zoneId){
  const paddock = getPaddock(paddockId)
  const zone = getZone(paddockId, zoneId)
  if(!paddock || !zone) return
  activeEditZoneRef = { paddockId, zoneId }

  const paddockNameLabel = document.getElementById('zone-edit-modal-paddock-name')
  const nameInput = document.getElementById('zone-edit-name')
  const areaInput = document.getElementById('zone-edit-area')
  const perimeterInput = document.getElementById('zone-edit-perimeter')
  if(paddockNameLabel){
    paddockNameLabel.textContent = paddock.name
  }
  if(nameInput){
    nameInput.value = zone.name || ''
    nameInput.disabled = isStalZone(paddock, zone)
  }
  if(areaInput){
    areaInput.value = zone.area ?? ''
  }
  if(perimeterInput){
    perimeterInput.value = zone.perimeter ?? ''
  }
  const notesInput = document.getElementById('zone-edit-notes')
  if(notesInput){
    notesInput.value = zone.notes || ''
  }

  openModal('zone-edit-modal')
}

function closeEditZoneModal(){
  activeEditZoneRef = null
  closeModal('zone-edit-modal')
}

function openModal(id){
  const modal = document.getElementById(id)
  if(!modal) return
  modal.classList.remove('hidden')
  modal.setAttribute('aria-hidden', 'false')
}

function closeModal(id){
  const modal = document.getElementById(id)
  if(!modal) return
  modal.classList.add('hidden')
  modal.setAttribute('aria-hidden', 'true')
}

document.getElementById('auth-toggle-btn')?.addEventListener('click', async () => {
  openAuthModal()
})
document.getElementById('auth-modal-close')?.addEventListener('click', () => closeModal('auth-modal'))
document.getElementById('auth-modal-backdrop')?.addEventListener('click', () => closeModal('auth-modal'))
document.getElementById('auth-mode-register-btn')?.addEventListener('click', () => setAuthFormMode('register'))
document.getElementById('auth-mode-login-btn')?.addEventListener('click', () => setAuthFormMode('login'))

document.getElementById('auth-form')?.addEventListener('submit', async (event) => {
  event.preventDefault()
  const email = (document.getElementById('auth-email')?.value || '').trim().toLowerCase()
  const password = (document.getElementById('auth-password')?.value || '').trim()
  const isRegister = authFormMode === 'register'
  try {
    setAuthStatusMessage(isRegister ? t('auth.status.registering') : t('auth.status.loggingIn'))
    const result = await apiFetch(isRegister ? '/auth/register' : '/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    })
    persistAuthSession(result.token, result.username)
    setAuthStatusMessage(isRegister ? t('auth.status.registered') : t('auth.status.loggedIn'))
    await fetchCloudStateAndApply()
    closeModal('auth-modal')
  } catch (error) {
    setAuthStatusMessage(error.message, true)
  }
})

document.getElementById('auth-logout-menu-btn')?.addEventListener('click', async () => {
  try {
    if(authToken){
      await apiFetch('/auth/logout', { method: 'POST' })
    }
  } catch (error) {
    console.warn('Cloud logout failed:', error.message)
  }
  clearAuthSession()
  const profileToggleButton = document.getElementById('auth-profile-toggle-btn')
  const dropdown = document.getElementById('auth-profile-dropdown')
  if(profileToggleButton) profileToggleButton.setAttribute('aria-expanded', 'false')
  if(dropdown){
    dropdown.classList.remove('is-open')
    dropdown.setAttribute('aria-hidden', 'true')
  }
})

document.getElementById('download-data-btn')?.addEventListener('click', exportData)
initAutoDownloadOnCloseToggle()
initPlanningFilters()

window.addEventListener('pagehide', handleExitDownload)
window.addEventListener('beforeunload', handleExitDownload)

document.getElementById('upload-data-btn')?.addEventListener('click', () => {
  triggerUploadDataPicker(false)
})

document.getElementById('clear-data-btn')?.addEventListener('click', () => {
  if(!confirm(t('confirm.clearAll'))) return
  state.paddocks = []
  state.sheep = []
  state.history = []
  state.events = []
  state.planningItems = []
  collapsedPaddockIds.clear()
  expandedWeatherPaddocks.clear()
  ensureDefaultStal()
  collapseAllPaddocks()
  localStorage.removeItem(KEY)
  render()
  maybeOpenEmptyStorageModal()
})

document.getElementById('upload-data-input')?.addEventListener('change', e => {
  const files = e.target.files
  if(files && files.length){
    closeModal('empty-storage-modal')
    importDataFile(files[0])
  } else if(reopenEmptyStorageModalAfterUpload && isOnboardingEmptyState()){
    openModal('empty-storage-modal')
  }
  reopenEmptyStorageModalAfterUpload = false
  e.target.value = ''
})

document.getElementById('empty-storage-start-zero')?.addEventListener('click', () => {
  save()
  render()
  closeModal('empty-storage-modal')
})

document.getElementById('empty-storage-upload-config')?.addEventListener('click', () => {
  closeModal('empty-storage-modal')
  triggerUploadDataPicker(true)
})

document.getElementById('empty-storage-upload-dummy')?.addEventListener('click', () => {
  loadDummyData()
})


document.getElementById('paddock-modal-close')?.addEventListener('click', () => closeModal('paddock-modal'))
document.getElementById('paddock-modal-backdrop')?.addEventListener('click', () => closeModal('paddock-modal'))

document.getElementById('delete-confirm-close')?.addEventListener('click', closeDeleteConfirmModal)
document.getElementById('delete-confirm-cancel')?.addEventListener('click', closeDeleteConfirmModal)
document.getElementById('delete-confirm-submit')?.addEventListener('click', executeDeleteConfirmed)
document.getElementById('delete-confirm-backdrop')?.addEventListener('click', closeDeleteConfirmModal)

document.getElementById('sheep-out-modal-close')?.addEventListener('click', closeSheepOutOfFlockModal)
document.getElementById('sheep-out-modal-backdrop')?.addEventListener('click', closeSheepOutOfFlockModal)
document.getElementById('sheep-out-modal-form')?.addEventListener('submit', e => {
  e.preventDefault()
  const reasonInput = document.getElementById('sheep-out-modal-reason')
  const dateInput = document.getElementById('sheep-out-modal-date')
  const notesInput = document.getElementById('sheep-out-modal-notes')
  const reason = reasonInput ? reasonInput.value : ''
  const date = dateInput ? dateInput.value.trim() : ''
  const notes = notesInput ? notesInput.value : ''
  if(!reason || !date) return
  moveSheepOutOfFlock(reason, date, notes)
})

document.getElementById('paddock-edit-modal-close')?.addEventListener('click', closeEditPaddockModal)
document.getElementById('paddock-edit-modal-backdrop')?.addEventListener('click', closeEditPaddockModal)

document.getElementById('paddock-injection-modal-close')?.addEventListener('click', closePaddockInjectionModal)
document.getElementById('paddock-injection-modal-backdrop')?.addEventListener('click', closePaddockInjectionModal)
document.getElementById('paddock-injection-no-repeat')?.addEventListener('change', e => {
  const repeatDateInput = document.getElementById('paddock-injection-repeat-date')
  if(!repeatDateInput) return
  const noRepeat = !!e.target.checked
  repeatDateInput.disabled = noRepeat
  repeatDateInput.required = !noRepeat
})

document.getElementById('paddock-shearing-modal-close')?.addEventListener('click', closePaddockShearingModal)
document.getElementById('paddock-shearing-modal-backdrop')?.addEventListener('click', closePaddockShearingModal)

document.getElementById('sheep-injection-modal-close')?.addEventListener('click', closeSheepInjectionModal)
document.getElementById('sheep-injection-modal-backdrop')?.addEventListener('click', closeSheepInjectionModal)
document.getElementById('sheep-injection-no-repeat')?.addEventListener('change', e => {
  const repeatDateInput = document.getElementById('sheep-injection-repeat-date')
  if(!repeatDateInput) return
  const noRepeat = !!e.target.checked
  repeatDateInput.disabled = noRepeat
  repeatDateInput.required = !noRepeat
})

document.getElementById('sheep-shearing-modal-close')?.addEventListener('click', closeSheepShearingModal)
document.getElementById('sheep-shearing-modal-backdrop')?.addEventListener('click', closeSheepShearingModal)

document.getElementById('sheep-modal-close')?.addEventListener('click', () => closeModal('sheep-modal'))
document.getElementById('sheep-modal-backdrop')?.addEventListener('click', () => closeModal('sheep-modal'))

document.getElementById('sheep-tag-edit-modal-close')?.addEventListener('click', closeEditSheepTagModal)
document.getElementById('sheep-tag-edit-modal-backdrop')?.addEventListener('click', closeEditSheepTagModal)

document.getElementById('zone-modal-close')?.addEventListener('click', () => closeModal('zone-modal'))
document.getElementById('zone-modal-backdrop')?.addEventListener('click', () => closeModal('zone-modal'))

document.getElementById('zone-edit-modal-close')?.addEventListener('click', closeEditZoneModal)
document.getElementById('zone-edit-modal-backdrop')?.addEventListener('click', closeEditZoneModal)

document.getElementById('zone-delete-move-modal-close')?.addEventListener('click', closeZoneDeleteMoveModal)
document.getElementById('zone-delete-move-modal-backdrop')?.addEventListener('click', closeZoneDeleteMoveModal)

document.getElementById('zone-bulk-move-modal-close')?.addEventListener('click', closeZoneBulkMoveModal)
document.getElementById('zone-bulk-move-modal-backdrop')?.addEventListener('click', closeZoneBulkMoveModal)

document.getElementById('paddock-delete-move-modal-close')?.addEventListener('click', closePaddockDeleteMoveModal)
document.getElementById('paddock-delete-move-modal-backdrop')?.addEventListener('click', closePaddockDeleteMoveModal)

document.getElementById('move-modal-form')?.addEventListener('submit', e => {
  e.preventDefault()
  if(!activeMoveSheepId) return
  const paddockId = document.getElementById('move-paddock-modal').value
  const zoneId = document.getElementById('move-zone-modal').value
  const sheep = state.sheep.find(x => x.id === activeMoveSheepId)
  if(!sheep || !paddockId) return
  const fromLabel = `${paddockName(sheep.paddockId)}${sheep.zoneId ? ' / ' + zoneName(sheep.paddockId, sheep.zoneId) : ''}`
  const toLabel = `${paddockName(paddockId)}${zoneId ? ' / ' + zoneName(paddockId, zoneId) : ''}`
  sheep.paddockId = paddockId
  sheep.zoneId = zoneId || null
  sheep.lastUpdated = Date.now()
  addEvent('SHEEP_MOVED', {
    sheep: sheep.tag,
    from: fromLabel,
    to: toLabel
  })
  save(); render(); closeModal('move-modal')
})

document.getElementById('paddock-modal-form')?.addEventListener('submit', e => {
  e.preventDefault()
  const name = document.getElementById('paddock-modal-name').value.trim()
  const postcode = document.getElementById('paddock-modal-postcode').value.trim()
  if(!name) return
  const paddockId = uid()
  state.paddocks.push({id:paddockId, name, postcode, zones: []})
  addEvent('PADDOCK_CREATED', {
    paddockId,
    name,
    postcode
  })
  collapsedPaddockIds.add(paddockId)
  document.getElementById('paddock-modal-name').value = ''
  document.getElementById('paddock-modal-postcode').value = ''
  save(); render(); closeModal('paddock-modal')
})

document.getElementById('paddock-edit-form')?.addEventListener('submit', e => {
  e.preventDefault()
  if(!activeEditPaddockId) return

  const paddock = getPaddock(activeEditPaddockId)
  if(!paddock) return

  const nameInput = document.getElementById('paddock-edit-name')
  const postcodeInput = document.getElementById('paddock-edit-postcode')
  const nextName = nameInput ? nameInput.value.trim() : ''
  const nextPostcode = postcodeInput ? postcodeInput.value.trim() : ''

  const beforeName = paddock.name
  const beforePostcode = paddock.postcode || ''

  if(!isStalPaddock(paddock) && nextName){
    paddock.name = nextName
  }
  paddock.postcode = nextPostcode

  if(beforeName !== paddock.name || beforePostcode !== paddock.postcode){
    addEvent('PADDOCK_UPDATED', {
      paddockId: paddock.id,
      previousName: beforeName,
      newName: paddock.name,
      previousPostcode: beforePostcode,
      newPostcode: paddock.postcode
    })
    const details = []
    if(beforeName !== paddock.name) details.push(t('history.details.name', { from: beforeName, name: paddock.name }))
    if(beforePostcode !== paddock.postcode) details.push(t('history.details.postcode', { from: beforePostcode || '-', postcode: paddock.postcode || '-' }))
  }

  save(); render(); closeEditPaddockModal()
})

document.getElementById('paddock-injection-form')?.addEventListener('submit', e => {
  e.preventDefault()
  if(!pendingInjectionPaddockId) return

  const paddock = getPaddock(pendingInjectionPaddockId)
  if(!paddock) return

  const dateInput = document.getElementById('paddock-injection-date')
  const productInput = document.getElementById('paddock-injection-product')
  const repeatDateInput = document.getElementById('paddock-injection-repeat-date')
  const noRepeatInput = document.getElementById('paddock-injection-no-repeat')

  const date = dateInput ? dateInput.value.trim() : ''
  const product = productInput ? productInput.value.trim() : ''
  const noRepeat = noRepeatInput ? noRepeatInput.checked : false
  const repeatDate = repeatDateInput ? repeatDateInput.value.trim() : ''
  if(!date || !product || (!noRepeat && !repeatDate)) return
  if(!noRepeat && repeatDate < todayIso()) return

  const selectedSheepIds = Array.from(document.querySelectorAll('#paddock-injection-sheep-list input[name="paddock-injection-sheep"]:checked')).map(input => input.value)
  const sheepInPaddock = state.sheep.filter(s => isActiveFlockSheep(s) && s.paddockId === pendingInjectionPaddockId && selectedSheepIds.includes(s.id))
  if(!sheepInPaddock.length) return
  const injection = { id: uid(), date, product, repeatDate: noRepeat ? '' : repeatDate }

  sheepInPaddock.forEach(sheep => {
    if(!Array.isArray(sheep.injections)) sheep.injections = []
    sheep.injections.push({ ...injection, id: uid() })
    sheep.lastUpdated = Date.now()
    addEvent('SHEEP_INJECTION_REGISTERED', {
      paddockId: sheep.paddockId,
      zoneId: sheep.zoneId,
      sheepId: sheep.id,
      sheepTag: sheep.tag,
      date,
      product,
      repeatDate: noRepeat ? null : repeatDate
    })
  })

  const displayLocation = pendingInjectionZoneId ? zoneName(pendingInjectionPaddockId, pendingInjectionZoneId) : paddock.name
  if(noRepeat){
  } else {
  }

  save(); render(); closePaddockInjectionModal()
})

document.getElementById('paddock-shearing-form')?.addEventListener('submit', e => {
  e.preventDefault()
  if(!pendingShearingPaddockId) return

  const paddock = getPaddock(pendingShearingPaddockId)
  if(!paddock) return

  const dateInput = document.getElementById('paddock-shearing-date')
  const shearingDate = dateInput ? dateInput.value.trim() : ''
  if(!shearingDate) return

  const selectedSheepIds = Array.from(document.querySelectorAll('#paddock-shearing-sheep-list input[name="paddock-shearing-sheep"]:checked')).map(input => input.value)
  const sheepInPaddock = state.sheep.filter(s => isActiveFlockSheep(s) && s.paddockId === pendingShearingPaddockId && selectedSheepIds.includes(s.id))
  if(!sheepInPaddock.length){
    return
  }

  sheepInPaddock.forEach(sheep => {
    if(!Array.isArray(sheep.shearings)) sheep.shearings = []
    sheep.shearings.push({ id: uid(), date: shearingDate })
    sheep.lastUpdated = Date.now()
    addEvent('SHEEP_SHEARING_REGISTERED', {
      paddockId: sheep.paddockId,
      zoneId: sheep.zoneId,
      sheepId: sheep.id,
      sheepTag: sheep.tag,
      date: shearingDate
    })
  })

  const displayLocation = pendingShearingZoneId ? zoneName(pendingShearingPaddockId, pendingShearingZoneId) : paddock.name

  save(); render(); closePaddockShearingModal()
})

document.getElementById('sheep-injection-form')?.addEventListener('submit', e => {
  e.preventDefault()
  if(!pendingInjectionSheepId) return

  const sheep = state.sheep.find(s => s.id === pendingInjectionSheepId)
  if(!sheep) return

  const dateInput = document.getElementById('sheep-injection-date')
  const productInput = document.getElementById('sheep-injection-product')
  const repeatDateInput = document.getElementById('sheep-injection-repeat-date')
  const noRepeatInput = document.getElementById('sheep-injection-no-repeat')

  const date = dateInput ? dateInput.value.trim() : ''
  const product = productInput ? productInput.value.trim() : ''
  const noRepeat = noRepeatInput ? noRepeatInput.checked : false
  const repeatDate = repeatDateInput ? repeatDateInput.value.trim() : ''
  if(!date || !product || (!noRepeat && !repeatDate)) return
  if(!noRepeat && repeatDate < todayIso()) return

  if(!Array.isArray(sheep.injections)) sheep.injections = []
  sheep.injections.push({
    id: uid(),
    date,
    product,
    repeatDate: noRepeat ? '' : repeatDate
  })
  sheep.lastUpdated = Date.now()
  addEvent('SHEEP_INJECTION_REGISTERED', {
    paddockId: sheep.paddockId,
    zoneId: sheep.zoneId,
    sheepId: sheep.id,
    sheepTag: sheep.tag,
    date,
    product,
    repeatDate: noRepeat ? null : repeatDate
  })

  if(noRepeat){
  } else {
  }

  save(); render(); closeSheepInjectionModal()
})

document.getElementById('sheep-shearing-form')?.addEventListener('submit', e => {
  e.preventDefault()
  if(!pendingShearingSheepId) return

  const sheep = state.sheep.find(s => s.id === pendingShearingSheepId)
  if(!sheep) return

  const dateInput = document.getElementById('sheep-shearing-date')
  const shearingDate = dateInput ? dateInput.value.trim() : ''
  if(!shearingDate) return

  if(!Array.isArray(sheep.shearings)) sheep.shearings = []
  sheep.shearings.push({ id: uid(), date: shearingDate })
  sheep.lastUpdated = Date.now()
  addEvent('SHEEP_SHEARING_REGISTERED', {
    paddockId: sheep.paddockId,
    zoneId: sheep.zoneId,
    sheepId: sheep.id,
    sheepTag: sheep.tag,
    date: shearingDate
  })

  save(); render(); closeSheepShearingModal()
})

document.getElementById('zone-edit-form')?.addEventListener('submit', e => {
  e.preventDefault()
  if(!activeEditZoneRef) return

  const paddock = getPaddock(activeEditZoneRef.paddockId)
  const zone = getZone(activeEditZoneRef.paddockId, activeEditZoneRef.zoneId)
  if(!paddock || !zone) return

  const nameInput = document.getElementById('zone-edit-name')
  const areaInput = document.getElementById('zone-edit-area')
  const perimeterInput = document.getElementById('zone-edit-perimeter')
  const notesInput = document.getElementById('zone-edit-notes')
  const nextName = nameInput ? nameInput.value.trim() : ''
  const nextArea = areaInput && areaInput.value.trim() !== '' ? Number(areaInput.value.trim()) : null
  const nextPerimeter = perimeterInput && perimeterInput.value.trim() !== '' ? Number(perimeterInput.value.trim()) : null
  const nextNotes = notesInput ? notesInput.value.trim() : ''

  const beforeName = zone.name
  const beforeArea = zone.area
  const beforePerimeter = zone.perimeter
  const beforeNotes = zone.notes || ''

  if(!isStalZone(paddock, zone) && nextName){
    zone.name = nextName
  }
  zone.area = nextArea
  zone.perimeter = nextPerimeter
  zone.notes = nextNotes

  if(beforeName !== zone.name || beforeArea !== zone.area || beforePerimeter !== zone.perimeter || beforeNotes !== zone.notes){
    addEvent('ZONE_UPDATED', {
      zoneId: zone.id,
      paddockId: paddock.id,
      previousName: beforeName,
      newName: zone.name,
      previousArea: beforeArea ?? null,
      newArea: zone.area ?? null,
      previousPerimeter: beforePerimeter ?? null,
      newPerimeter: zone.perimeter ?? null,
      previousNotes: beforeNotes || null,
      newNotes: zone.notes || null
    })
    const details = []
    if(beforeName !== zone.name) details.push(t('history.details.name', { from: beforeName, name: zone.name }))
    if(beforeArea !== zone.area) details.push(t('history.details.area', { from: beforeArea ?? '-', area: zone.area ?? '-' }))
    if(beforePerimeter !== zone.perimeter) details.push(t('history.details.perimeter', { from: beforePerimeter ?? '-', perimeter: zone.perimeter ?? '-' }))
    if(beforeNotes !== zone.notes) details.push(t('history.details.notesUpdated'))
  }

  save(); render(); closeEditZoneModal()
})

document.getElementById('sheep-modal-form')?.addEventListener('submit', e => {
  e.preventDefault()
  const tag = document.getElementById('sheep-modal-tag').value.trim()
  const earmarkInput = document.getElementById('sheep-modal-earmark')
  const earmark = earmarkInput ? earmarkInput.value.trim() : ''
  const birthDateInput = document.getElementById('sheep-modal-birth-date')
  const birthDate = birthDateInput ? birthDateInput.value.trim() : ''
  const selectedGender = document.querySelector('input[name="sheep-modal-gender"]:checked')
  const gender = selectedGender ? selectedGender.value : null
  const motherId = document.getElementById('sheep-mother-modal').value || null
  const fatherId = document.getElementById('sheep-father-modal').value || null
  const paddockId = document.getElementById('sheep-paddock-modal').value
  const zoneId = document.getElementById('sheep-zone-modal').value
  if(!tag || !paddockId || !gender) return
  if(birthDate){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return
    if(birthDate < MIN_SHEEP_BIRTH_DATE) return
    if(birthDate > todayIso()) return
  }
  if(isEarmarkInUse(earmark)){
    alert(t('errors.earmark.duplicate'))
    return
  }
  if(motherId && !state.sheep.some(s => s.id === motherId && s.gender === 'female')) return
  if(fatherId && !state.sheep.some(s => s.id === fatherId && s.gender === 'male')) return
  const sheepId = uid()
  state.sheep.push({id:sheepId, tag, earmark: earmark || null, birthDate: birthDate || null, injections: [], shearings: [], gender, motherId, fatherId, paddockId, zoneId: zoneId || null, flockStatus: 'active', outReason: null, outDate: null, outNotes: null, outHidden: false, outFromPaddockId: null, outFromZoneId: null, lastUpdated: Date.now()})
  addEvent('SHEEP_CREATED', {
    sheepId,
    tag,
    gender,
    paddockId,
    zoneId: zoneId || null,
    earmark: earmark || null,
    birthDate: birthDate || null
  })
  document.getElementById('sheep-modal-tag').value = ''
  if(earmarkInput){
    earmarkInput.value = ''
  }
  if(birthDateInput){
    birthDateInput.value = ''
  }
  document.querySelectorAll('input[name="sheep-modal-gender"]').forEach(radio => {
    radio.checked = false
  })
  document.getElementById('sheep-mother-modal').value = ''
  document.getElementById('sheep-father-modal').value = ''
  document.getElementById('sheep-zone-modal').value = ''
  save(); render(); closeModal('sheep-modal')
})

document.getElementById('sheep-tag-edit-form')?.addEventListener('submit', e => {
  e.preventDefault()
  if(!activeEditSheepId) return

  const input = document.getElementById('sheep-tag-edit-input')
  const earmarkInput = document.getElementById('sheep-edit-earmark-input')
  const birthDateInput = document.getElementById('sheep-edit-birth-date-input')
  const nextTag = input ? input.value.trim() : ''
  const nextEarmark = earmarkInput ? earmarkInput.value.trim() : ''
  const nextBirthDate = birthDateInput ? birthDateInput.value.trim() : ''
  if(!nextTag) return

  const sheep = state.sheep.find(s => s.id === activeEditSheepId)
  if(!sheep) return

  const previousTag = sheep.tag
  const previousEarmark = sheep.earmark ?? null
  const previousBirthDate = sheep.birthDate ?? null
  sheep.tag = nextTag
  if(!previousEarmark && nextEarmark && isEarmarkInUse(nextEarmark, sheep.id)){
    alert(t('errors.earmark.duplicate'))
    return
  }
  if(!previousEarmark && nextEarmark){
    sheep.earmark = nextEarmark
  }
  if(!previousBirthDate && nextBirthDate){
    sheep.birthDate = nextBirthDate
  }
  sheep.lastUpdated = Date.now()
  if(previousTag !== nextTag || (!previousEarmark && nextEarmark)){
    addEvent('SHEEP_UPDATED', {
      sheepId: sheep.id,
      previousTag: previousTag,
      newTag: nextTag,
      previousEarmark: previousEarmark,
      newEarmark: (!previousEarmark && nextEarmark) ? nextEarmark : previousEarmark,
      previousBirthDate: previousBirthDate,
      newBirthDate: (!previousBirthDate && nextBirthDate) ? nextBirthDate : previousBirthDate
    })
    const namePart = previousTag !== nextTag ? t('history.details.name', { from: previousTag, to: nextTag }) : null
    const earmarkPart = (!previousEarmark && nextEarmark) ? t('history.details.earmarkAdded', { earmark: nextEarmark }) : null
    const details = [namePart, earmarkPart].filter(Boolean).join(', ')
  }
  save(); render(); closeEditSheepTagModal()
})

const sheepPaddockModal = document.getElementById('sheep-paddock-modal')
if(sheepPaddockModal){
  sheepPaddockModal.addEventListener('change', () => {
    const sheepZoneModal = document.getElementById('sheep-zone-modal')
    const selectedPaddock = getPaddock(sheepPaddockModal.value)
    if(selectedPaddock && selectedPaddock.zones.length){
      sheepZoneModal.innerHTML = `<option value="" selected disabled hidden>${t('select.zone.choose')}</option>` + selectedPaddock.zones.map(z => `<option value="${z.id}">${z.name}</option>`).join('')
      sheepZoneModal.disabled = false
      if(selectedPaddock.zones.length === 1){
        sheepZoneModal.value = selectedPaddock.zones[0].id
      }
    } else {
      sheepZoneModal.innerHTML = selectedPaddock ? `<option value="">${t('select.zone.noneAvailable')}</option>` : `<option value="">${t('select.paddock.first')}</option>`
      sheepZoneModal.disabled = !selectedPaddock || selectedPaddock.zones.length === 0
    }
  })
}

const movePaddockModal = document.getElementById('move-paddock-modal')
if(movePaddockModal){
  movePaddockModal.addEventListener('change', () => {
    populateMoveModalPaddocks(movePaddockModal.value)
  })
}

const moveZoneModal = document.getElementById('move-zone-modal')
if(moveZoneModal){
  moveZoneModal.addEventListener('change', () => {
    const submitBtn = document.getElementById('move-modal-submit')
    if(submitBtn){
      submitBtn.disabled = !moveZoneModal.value
    }
  })
}

const zoneDeleteTargetPaddockModal = document.getElementById('zone-delete-target-paddock-modal')
if(zoneDeleteTargetPaddockModal){
  zoneDeleteTargetPaddockModal.addEventListener('change', () => {
    populateZoneDeleteMoveTargets(zoneDeleteTargetPaddockModal.value)
  })
}

const zoneDeleteTargetZoneModal = document.getElementById('zone-delete-target-zone-modal')
if(zoneDeleteTargetZoneModal){
  zoneDeleteTargetZoneModal.addEventListener('change', () => {
    const submitBtn = document.getElementById('zone-delete-move-submit')
    if(submitBtn){
      submitBtn.disabled = !zoneDeleteTargetZoneModal.value
    }
  })
}

const zoneBulkMoveTargetPaddockModal = document.getElementById('zone-bulk-move-target-paddock-modal')
if(zoneBulkMoveTargetPaddockModal){
  zoneBulkMoveTargetPaddockModal.addEventListener('change', () => {
    populateZoneBulkMoveTargets(zoneBulkMoveTargetPaddockModal.value)
  })
}

const zoneBulkMoveTargetZoneModal = document.getElementById('zone-bulk-move-target-zone-modal')
if(zoneBulkMoveTargetZoneModal){
  zoneBulkMoveTargetZoneModal.addEventListener('change', () => {
    const submitBtn = document.getElementById('zone-bulk-move-submit')
    if(submitBtn){
      submitBtn.disabled = !zoneBulkMoveTargetZoneModal.value
    }
  })
}

const paddockDeleteTargetPaddockModal = document.getElementById('paddock-delete-target-paddock-modal')
if(paddockDeleteTargetPaddockModal){
  paddockDeleteTargetPaddockModal.addEventListener('change', () => {
    populatePaddockDeleteMoveTargets(paddockDeleteTargetPaddockModal.value)
  })
}

const paddockDeleteTargetZoneModal = document.getElementById('paddock-delete-target-zone-modal')
if(paddockDeleteTargetZoneModal){
  paddockDeleteTargetZoneModal.addEventListener('change', () => {
    const submitBtn = document.getElementById('paddock-delete-move-submit')
    if(submitBtn){
      submitBtn.disabled = !paddockDeleteTargetZoneModal.value
    }
  })
}

document.getElementById('zone-delete-move-form')?.addEventListener('submit', e => {
  e.preventDefault()
  if(!pendingZoneDeletion) return

  const targetPaddockId = pendingZoneDeletion.sourcePaddockId
  const targetZoneId = document.getElementById('zone-delete-target-zone-modal').value
  if(!targetPaddockId || !targetZoneId) return

  const sourcePaddock = getPaddock(pendingZoneDeletion.sourcePaddockId)
  if(!sourcePaddock) return
  const sourceZone = getZone(pendingZoneDeletion.sourcePaddockId, pendingZoneDeletion.sourceZoneId)
  const sheepToMove = state.sheep.filter(s => s.paddockId === pendingZoneDeletion.sourcePaddockId && s.zoneId === pendingZoneDeletion.sourceZoneId)
  const fromLabel = `${sourcePaddock.name} / ${sourceZone ? sourceZone.name : t('unknown')}`
  const toLabel = `${paddockName(targetPaddockId)} / ${zoneName(targetPaddockId, targetZoneId)}`
  sheepToMove.forEach(sheep => {
    addEvent('SHEEP_MOVED', {
      sheep: sheep.tag,
      from: fromLabel,
      to: toLabel
    })
  })

  state.sheep.forEach(s => {
    if(s.paddockId === pendingZoneDeletion.sourcePaddockId && s.zoneId === pendingZoneDeletion.sourceZoneId){
      s.paddockId = targetPaddockId
      s.zoneId = targetZoneId
      s.lastUpdated = Date.now()
    }
  })

  sourcePaddock.zones = sourcePaddock.zones.filter(z => z.id !== pendingZoneDeletion.sourceZoneId)
  addEvent('ZONE_DELETED', {
    zoneId: pendingZoneDeletion.sourceZoneId,
    paddockId: pendingZoneDeletion.sourcePaddockId,
    name: sourceZone ? sourceZone.name : null,
    sheepMovedCount: sheepToMove.length
  })
  save(); render(); closeZoneDeleteMoveModal()
})

document.getElementById('paddock-delete-move-form')?.addEventListener('submit', e => {
  e.preventDefault()
  if(!pendingPaddockDeletion) return

  const targetPaddockId = document.getElementById('paddock-delete-target-paddock-modal').value
  const targetZoneId = document.getElementById('paddock-delete-target-zone-modal').value
  if(!targetPaddockId || !targetZoneId) return
  const sourcePaddock = getPaddock(pendingPaddockDeletion.sourcePaddockId)
  const sheepToMove = state.sheep.filter(s => s.paddockId === pendingPaddockDeletion.sourcePaddockId)
  const toLabel = `${paddockName(targetPaddockId)} / ${zoneName(targetPaddockId, targetZoneId)}`
  sheepToMove.forEach(sheep => {
    const fromLabel = `${sourcePaddock ? sourcePaddock.name : t('unknown')}${sheep.zoneId ? ' / ' + zoneName(pendingPaddockDeletion.sourcePaddockId, sheep.zoneId) : ''}`
    addEvent('SHEEP_MOVED', {
      sheep: sheep.tag,
      from: fromLabel,
      to: toLabel
    })
  })

  state.sheep.forEach(s => {
    if(s.paddockId === pendingPaddockDeletion.sourcePaddockId){
      s.paddockId = targetPaddockId
      s.zoneId = targetZoneId
      s.lastUpdated = Date.now()
    }
  })

  state.paddocks = state.paddocks.filter(p => p.id !== pendingPaddockDeletion.sourcePaddockId)
  collapsedPaddockIds.delete(pendingPaddockDeletion.sourcePaddockId)
  addEvent('PADDOCK_DELETED', {
    paddockId: pendingPaddockDeletion.sourcePaddockId,
    name: sourcePaddock ? sourcePaddock.name : null,
    sheepMovedCount: sheepToMove.length
  })
  save(); render(); closePaddockDeleteMoveModal()
})

document.getElementById('zone-bulk-move-form')?.addEventListener('submit', e => {
  e.preventDefault()
  if(!pendingZoneBulkMove) return

  const targetPaddockId = document.getElementById('zone-bulk-move-target-paddock-modal').value
  const targetZoneId = document.getElementById('zone-bulk-move-target-zone-modal').value
  if(!targetPaddockId || !targetZoneId) return
  if(targetPaddockId === pendingZoneBulkMove.sourcePaddockId && targetZoneId === pendingZoneBulkMove.sourceZoneId) return
  const sourcePaddock = getPaddock(pendingZoneBulkMove.sourcePaddockId)
  const sourceZone = getZone(pendingZoneBulkMove.sourcePaddockId, pendingZoneBulkMove.sourceZoneId)
  const sheepToMove = state.sheep.filter(s => s.paddockId === pendingZoneBulkMove.sourcePaddockId && s.zoneId === pendingZoneBulkMove.sourceZoneId)
  const fromLabel = `${sourcePaddock ? sourcePaddock.name : t('unknown')} / ${sourceZone ? sourceZone.name : t('unknown')}`
  const toLabel = `${paddockName(targetPaddockId)} / ${zoneName(targetPaddockId, targetZoneId)}`
  sheepToMove.forEach(sheep => {
    addEvent('SHEEP_MOVED', {
      sheep: sheep.tag,
      from: fromLabel,
      to: toLabel
    })
  })

  state.sheep.forEach(s => {
    if(s.paddockId === pendingZoneBulkMove.sourcePaddockId && s.zoneId === pendingZoneBulkMove.sourceZoneId){
      s.paddockId = targetPaddockId
      s.zoneId = targetZoneId
      s.lastUpdated = Date.now()
    }
  })

  save(); render(); closeZoneBulkMoveModal()
})

document.getElementById('move-modal-close')?.addEventListener('click', () => closeModal('move-modal'))

document.getElementById('move-modal-backdrop')?.addEventListener('click', () => closeModal('move-modal'))

document.getElementById('sheep-list')?.addEventListener('click', e => {
  const birthDateInput = e.target.closest('.sheep-birthdate-input')
  if(birthDateInput && typeof birthDateInput.showPicker === 'function'){
    try {
      birthDateInput.showPicker()
    } catch (error) {
      // Ignore browsers that block programmatic picker opening.
    }
    return
  }

  const editButton = e.target.closest('.sheep-tag-edit-button')
  if(editButton){
    openEditSheepTagModal(editButton.dataset.id)
    return
  }

  const button = e.target.closest('.move-button')
  if(button){
    openMoveModal(button.dataset.id)
    return
  }

  const injectionButton = e.target.closest('.sheep-injection-button')
  if(injectionButton){
    const sheepId = injectionButton.dataset.id
    if(!sheepId) return
    openSheepInjectionModal(sheepId)
    return
  }

  const shearingButton = e.target.closest('.sheep-shearing-button')
  if(shearingButton){
    const sheepId = shearingButton.dataset.id
    if(!sheepId) return
    openSheepShearingModal(sheepId)
    return
  }

  const deleteButton = e.target.closest('.sheep-delete-button')
  if(deleteButton){
    const sheepId = deleteButton.dataset.id
    if(!sheepId) return
    openSheepOutOfFlockModal(sheepId)
    return
  }

  const addBlock = e.target.closest('#add-sheep-block')
  if(addBlock){
    setSheepModalDefaultSelection()
    populateParentSheepSelects()
    openModal('sheep-modal')
  }
})

document.getElementById('sheep-list')?.addEventListener('change', e => {
  const birthDateInput = e.target.closest('.sheep-birthdate-input')
  if(!birthDateInput) return
  const sheepId = birthDateInput.dataset.id
  if(!sheepId) return
  const nextBirthDate = birthDateInput.value.trim()
  if(!/^\d{4}-\d{2}-\d{2}$/.test(nextBirthDate)) return
  if(nextBirthDate < MIN_SHEEP_BIRTH_DATE) return
  if(nextBirthDate > todayIso()) return
  const sheep = state.sheep.find(s => s.id === sheepId)
  if(!sheep) return
  sheep.birthDate = nextBirthDate
  sheep.lastUpdated = Date.now()
  save(); render()
})

document.getElementById('sheep-list')?.addEventListener('keydown', e => {
  const birthDateInput = e.target.closest('.sheep-birthdate-input')
  if(!birthDateInput) return
  const allowedKeys = ['Tab', 'Shift', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']
  if(allowedKeys.includes(e.key)) return
  e.preventDefault()
})

document.getElementById('sheep-modal-birth-date')?.addEventListener('click', e => {
  if(typeof e.target.showPicker === 'function'){
    try {
      e.target.showPicker()
    } catch (error) {
      // Ignore browsers that block programmatic picker opening.
    }
  }
})

document.getElementById('sheep-modal-birth-date')?.addEventListener('keydown', e => {
  const allowedKeys = ['Tab', 'Shift', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']
  if(allowedKeys.includes(e.key)) return
  e.preventDefault()
})

document.getElementById('sheep-out-list')?.addEventListener('click', e => {
  const visibilityButton = e.target.closest('.sheep-out-visibility-button')
  if(!visibilityButton) return
  const sheepId = visibilityButton.dataset.id
  if(!sheepId) return
  const sheep = state.sheep.find(s => s.id === sheepId)
  if(!sheep || !isOutOfFlockSheep(sheep)) return
  sheep.outHidden = !sheep.outHidden
  sheep.lastUpdated = Date.now()
  save(); render()
})

document.getElementById('sheep-out-list')?.addEventListener('change', e => {
  const outToggle = e.target.closest('#out-of-flock-show-all-toggle')
  if(!outToggle) return
  showAllOutOfFlockSheep = !!outToggle.checked
  render()
})

document.getElementById('planning-list')?.addEventListener('click', e => {
  const doneButton = e.target.closest('.planning-mark-done-button')
  if(!doneButton) return
  const planningId = doneButton.dataset.planningId
  if(!planningId) return
  markPlanningItemDone(planningId)
})

document.getElementById('planning-add-btn')?.addEventListener('click', () => {
  openPlanningItemModal()
})

document.getElementById('planning-item-select-all-btn')?.addEventListener('click', () => {
  toggleAllPlanningSheepSelection()
})

document.getElementById('planning-item-select-all-paddocks-btn')?.addEventListener('click', () => {
  toggleAllPlanningCheckboxSelection('planning-item-paddock', '#planning-item-paddock-list')
  populatePlanningZoneOptions(getSelectedPlanningPaddockIds())
})

document.getElementById('planning-item-select-all-zones-btn')?.addEventListener('click', () => {
  toggleAllPlanningCheckboxSelection('planning-item-zone', '#planning-item-zone-list')
})

document.getElementById('planning-item-type')?.addEventListener('change', () => {
  syncPlanningTypeVisibility()
})

document.getElementById('planning-item-paddock-list')?.addEventListener('change', e => {
  const checkbox = e.target.closest('input[name="planning-item-paddock"]')
  if(!checkbox) return
  populatePlanningZoneOptions(getSelectedPlanningPaddockIds())
})

document.getElementById('planning-item-zone-list')?.addEventListener('change', e => {
  const checkbox = e.target.closest('input[name="planning-item-zone"]')
  if(!checkbox) return
})

document.getElementById('planning-item-modal-close')?.addEventListener('click', closePlanningItemModal)
document.getElementById('planning-item-modal-backdrop')?.addEventListener('click', closePlanningItemModal)

document.getElementById('planning-item-form')?.addEventListener('submit', e => {
  e.preventDefault()
  const typeInput = document.getElementById('planning-item-type')
  const dueDateInput = document.getElementById('planning-item-date')
  const repeatDateInput = document.getElementById('planning-item-repeat-date')
  const detailInput = document.getElementById('planning-item-detail')

  const type = normalizePlanningType(typeInput ? typeInput.value : 'custom')
  const selectedPaddockIds = getSelectedPlanningPaddockIds()
  const selectedSheepIds = Array.from(document.querySelectorAll('#planning-item-sheep-list input[name="planning-item-sheep"]:checked')).map(input => input.value)
  const dueDate = dueDateInput ? dueDateInput.value.trim() : ''
  const repeatDate = repeatDateInput ? repeatDateInput.value.trim() : ''
  const detail = detailInput ? detailInput.value.trim() : ''

  if(!dueDate) return

  const locationTargets = (type === 'custom' && selectedPaddockIds.length)
    ? selectedPaddockIds.map(paddockId => ({ paddockId, zoneId: null }))
    : [{ paddockId: null, zoneId: null }]

  const targets = selectedSheepIds.length ? selectedSheepIds : [null]
  targets.forEach(sheepId => {
    const sheep = sheepId ? state.sheep.find(s => s.id === sheepId) : null
    locationTargets.forEach(location => {
      const paddockId = location.paddockId || (sheep ? sheep.paddockId : null)
      const zoneId = location.paddockId
        ? (location.zoneId || null)
        : (sheep ? (sheep.zoneId || null) : null)

      const planningItem = sanitizePlanningItem({
        id: uid(),
        type,
        status: 'planned',
        dueDate,
        repeatDate,
        detail,
        sheepId,
        paddockId,
        zoneId,
        source: 'manual',
        sourceKey: null,
        createdAt: Date.now(),
        completedAt: null
      })

      if(!planningItem) return
      state.planningItems.push(planningItem)
      addEvent('PLANNING_ITEM_CREATED', {
        planningId: planningItem.id,
        type,
        dueDate,
        sheepTag: sheep ? sheep.tag : null
      })
    })
  })

  save(); render(); closePlanningItemModal()
})

document.getElementById('paddock-list').addEventListener('click', e => {
  const addPaddockButton = e.target.closest('.add-paddock-block')
  if(addPaddockButton){
    openModal('paddock-modal')
    return
  }

  const zoneSheepLink = e.target.closest('.zone-sheep-link')
  if(zoneSheepLink){
    const sheepId = zoneSheepLink.dataset.sheepId
    if(!sheepId) return
    openMoveModal(sheepId)
    return
  }

  const zoneBulkMoveButton = e.target.closest('.zone-bulk-move-button')
  if(zoneBulkMoveButton){
    const sourcePaddockId = zoneBulkMoveButton.dataset.paddockId
    const sourceZoneId = zoneBulkMoveButton.dataset.zoneId
    if(!sourcePaddockId || !sourceZoneId) return
    openZoneBulkMoveModal(sourcePaddockId, sourceZoneId)
    return
  }

  const weatherToggleButton = e.target.closest('.weather-toggle-button')
  if(weatherToggleButton){
    const paddockId = weatherToggleButton.dataset.paddockId
    if(!paddockId) return
    if(expandedWeatherPaddocks.has(paddockId)){
      expandedWeatherPaddocks.delete(paddockId)
    } else {
      expandedWeatherPaddocks.add(paddockId)
    }
    render()
    return
  }

  const editPaddockButton = e.target.closest('.paddock-edit-button')
  if(editPaddockButton){
    const paddockId = editPaddockButton.dataset.paddockId
    if(!paddockId) return
    openEditPaddockModal(paddockId)
    return
  }

  const paddockInjectionButton = e.target.closest('.paddock-injection-button')
  if(paddockInjectionButton){
    const paddockId = paddockInjectionButton.dataset.paddockId
    if(!paddockId) return
    openPaddockInjectionModal(paddockId)
    return
  }

  const zoneInjectionButton = e.target.closest('.zone-injection-button')
  if(zoneInjectionButton){
    const paddockId = zoneInjectionButton.dataset.paddockId
    const zoneId = zoneInjectionButton.dataset.zoneId
    if(!paddockId || !zoneId) return
    openPaddockInjectionModal(paddockId, zoneId)
    return
  }

  const paddockShearingButton = e.target.closest('.paddock-shearing-button')
  if(paddockShearingButton){
    const paddockId = paddockShearingButton.dataset.paddockId
    if(!paddockId) return
    openPaddockShearingModal(paddockId)
    return
  }

  const zoneShearingButton = e.target.closest('.zone-shearing-button')
  if(zoneShearingButton){
    const paddockId = zoneShearingButton.dataset.paddockId
    const zoneId = zoneShearingButton.dataset.zoneId
    if(!paddockId || !zoneId) return
    openPaddockShearingModal(paddockId, zoneId)
    return
  }

  const editZoneButton = e.target.closest('.zone-edit-button')
  if(editZoneButton){
    const paddockId = editZoneButton.dataset.paddockId
    const zoneId = editZoneButton.dataset.zoneId
    if(!paddockId || !zoneId) return
    openEditZoneModal(paddockId, zoneId)
    return
  }

  const deletePaddockButton = e.target.closest('.paddock-delete-button')
  if(deletePaddockButton){
    const paddockId = deletePaddockButton.dataset.paddockId
    if(!paddockId) return
    const paddock = getPaddock(paddockId)
    if(isStalPaddock(paddock)){
      alert(t('alert.stalPaddockDelete'))
      return
    }
    openDeleteConfirm('paddock', {
      paddockId,
      message: t('confirm.deletePaddock'),
      confirmLabel: t('actions.delete')
    })
    return
  }

  const deleteZoneButton = e.target.closest('.zone-delete-button')
  if(deleteZoneButton){
    const paddockId = deleteZoneButton.dataset.paddockId
    const zoneId = deleteZoneButton.dataset.zoneId
    const paddock = getPaddock(paddockId)
    if(!paddock || !zoneId) return

    const zone = getZone(paddockId, zoneId)
    if(!zone) return

    if(isStalZone(paddock, zone)){
      alert(t('alert.stalZoneDelete'))
      return
    }

    if(paddock.zones.length <= 1){
      alert(t('alert.zoneMinimum'))
      return
    }

    openDeleteConfirm('zone', {
      paddockId,
      zoneId,
      message: t('confirm.deleteZone'),
      confirmLabel: t('actions.delete')
    })
    return
  }

  const zoneButton = e.target.closest('.add-zone-button')
  if(zoneButton){
    const paddockId = zoneButton.dataset.paddockId
    const paddock = getPaddock(paddockId)
    if(!paddock) return
    document.getElementById('zone-modal-paddock-name').textContent = paddock.name
    document.getElementById('zone-modal-form').dataset.paddockId = paddockId
    document.getElementById('zone-modal-name').value = ''
    document.getElementById('zone-modal-area').value = ''
    document.getElementById('zone-modal-perimeter').value = ''
    openModal('zone-modal')
    return
  }

  const collapseButton = e.target.closest('.paddock-collapse-button')
  if(!collapseButton) return
  const paddockId = collapseButton.dataset.paddockId
  if(!paddockId) return
  if(collapsedPaddockIds.has(paddockId)){
    collapsedPaddockIds.delete(paddockId)
  } else {
    collapsedPaddockIds.add(paddockId)
  }
  render()
})

document.getElementById('zone-modal-form')?.addEventListener('submit', e => {
  e.preventDefault()
  const paddockId = e.target.dataset.paddockId
  const zoneName = document.getElementById('zone-modal-name').value.trim()
  const areaValue = document.getElementById('zone-modal-area').value.trim()
  const perimeterValue = document.getElementById('zone-modal-perimeter').value.trim()
  const notes = (document.getElementById('zone-modal-notes')?.value || '').trim()
  const area = areaValue === '' ? null : Number(areaValue)
  const perimeter = perimeterValue === '' ? null : Number(perimeterValue)
  if(!zoneName || !paddockId) return
  const paddock = getPaddock(paddockId)
  if(!paddock) return
  const zoneId = uid()
  paddock.zones.push({id:zoneId,name:zoneName,area,perimeter,notes,emptySince: Date.now(),occupiedSince:null})
  addEvent('ZONE_CREATED', {
    zoneId,
    paddockId,
    name: zoneName,
    area,
    perimeter
  })
  document.getElementById('zone-modal-notes').value = ''
  save(); render(); closeModal('zone-modal')
})

// Ensure initialization happens after DOM is fully loaded
if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', () => {
    initTabs()
    initLanguageSelector()
    initActionsMenu()
    initAuthProfileMenu()
    applyStaticTranslations()
    load()
    render()
    initializeCloudSession()
    maybeOpenEmptyStorageModal()
  })
} else {
  // DOM is already loaded (e.g., when script is deferred or at end of body)
  initTabs()
  initLanguageSelector()
  initActionsMenu()
  initAuthProfileMenu()
  applyStaticTranslations()
  load()
  render()
  initializeCloudSession()
  maybeOpenEmptyStorageModal()
}

