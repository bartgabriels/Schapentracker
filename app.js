const KEY = 'schapentracker:data'
const LANG_KEY = 'schapentracker:lang'
const state = { paddocks: [], sheep: [], history: [] }
const collapsedPaddockIds = new Set()
const expandedWeatherPaddocks = new Set()
const weatherCache = {}
const weatherLoading = new Set()
const WEATHER_TTL_MS = 60 * 60 * 1000

const translations = {
  nl: {
    'app.title': 'Schapentracker',
    'ui.save': 'Opslaan',
    'ui.upload': 'Upload',
    'ui.clear': 'Wissen',
    'ui.language': 'Taal',
    'tab.paddocksZones': 'Weides en zones',
    'tab.sheep': 'Schapen',
    'tab.history': 'Historiek',
    'section.paddocks': 'Weides',
    'section.sheep': 'Schapen',
    'section.history': 'Historiek',
    'sheep.add.title': 'Schaap toevoegen',
    'sheep.add.tagPlaceholder': 'Tag',
    'sheep.add.earmarkPlaceholder': 'Oorkenmerk (optioneel)',
    'sheep.add.genderLabel': 'Geslacht',
    'sheep.gender.female': 'Ooi',
    'sheep.gender.male': 'Ram',
    'sheep.add.pedigreeLabel': 'Stamboom',
    'sheep.add.locationLabel': 'Locatie',
    'sheep.add.submit': 'Toevoegen',
    'sheep.edit.title': 'Schaap bewerken',
    'sheep.edit.tagPlaceholder': 'Nieuwe naam',
    'sheep.edit.earmarkLabel': 'Oorkenmerk',
    'sheep.edit.earmarkPlaceholder': 'Oorkenmerk toevoegen',
    'sheep.edit.genderLabel': 'Geslacht',
    'sheep.edit.pedigreeLabel': 'Stamboom',
    'sheep.edit.locationLabel': 'Locatie',
    'sheep.edit.submit': 'Opslaan',
    'sheep.location.unknownPaddock': 'Onbekend veld',
    'sheep.location.unknownZone': 'Onbekende zone',
    'sheep.location.none': 'Geen zone',
    'sheep.empty': 'Geen schapen',
    'select.paddock.first': 'Kies eerst een weide',
    'select.paddock.choose': 'Kies weide',
    'select.zone.choose': 'Kies zone',
    'select.zone.noneAvailable': 'Geen zones beschikbaar',
    'select.parent.mother': 'Moederdier (optioneel, enkel ooien)',
    'select.parent.father': 'Vaderdier (optioneel, enkel rammen)',
    'history.sheep.added': '{tag} toegevoegd in {location}',
    'history.sheep.updated': 'Schaap bijgewerkt: {details}',
    'history.sheep.deleted': '{tag} verwijderd uit {location}',
    'history.details.name': 'naam {from} -> {to}',
    'history.details.earmarkAdded': 'oorkenmerk toegevoegd: {earmark}',
    'entity.sheep': 'schaap',
    'errors.earmark.duplicate': 'Dit oorkenmerk is al toegewezen aan een ander schaap.',
    'labels.lastUpdated': 'Laatst gewijzigd: {date} ({days} dagen geleden)',
    'actions.move': 'Verplaats',
    'aria.editSheepName': 'Naam wijzigen voor {tag}',
    'aria.deleteSheep': 'Schaap verwijderen',
    'aria.addSheep': 'Schaap toevoegen',
    'aria.addPaddock': 'Weide toevoegen',
    'aria.editPaddock': 'Weide bewerken',
    'aria.deletePaddock': 'Weide verwijderen',
    'aria.collapsePaddock': 'Weide inklappen',
    'aria.expandPaddock': 'Weide uitklappen',
    'aria.addZone': 'Zone toevoegen',
    'aria.editZone': 'Zone bewerken',
    'aria.deleteZone': 'Zone verwijderen',
    'aria.moveSheep': 'Verplaats {tag}',
    'aria.weatherForecast': 'Weervoorspelling',
    'paddock.add.title': 'Weide toevoegen',
    'paddock.add.nameLabel': 'Naam weide',
    'paddock.add.postcodeLabel': 'Postcode (optioneel)',
    'paddock.add.submit': 'Toevoegen',
    'paddock.edit.title': 'Weide bewerken',
    'paddock.edit.nameLabel': 'Naam weide',
    'paddock.edit.postcodeLabel': 'Postcode (optioneel)',
    'paddock.edit.submit': 'Opslaan',
    'paddock.empty': 'Geen weides',
    'paddock.sheep.singular': 'schaap',
    'paddock.sheep.plural': 'schapen',
    'paddock.zones.badge': '{count} zone(s)',
    'zone.add.title': 'Zone toevoegen',
    'zone.add.paddockLabel': 'Weide',
    'zone.add.nameLabel': 'Zone naam',
    'zone.add.areaLabel': 'Oppervlakte (m2)',
    'zone.add.areaPlaceholder': 'Oppervlakte (m2)',
    'zone.add.perimeterLabel': 'Omtrek (m)',
    'zone.add.perimeterPlaceholder': 'Omtrek (m)',
    'zone.add.submit': 'Toevoegen',
    'zone.edit.title': 'Zone bewerken',
    'zone.edit.paddockLabel': 'Weide',
    'zone.edit.nameLabel': 'Zone naam',
    'zone.edit.areaLabel': 'Oppervlakte (m2)',
    'zone.edit.areaPlaceholder': 'Oppervlakte',
    'zone.edit.perimeterLabel': 'Omtrek (m)',
    'zone.edit.perimeterPlaceholder': 'Omtrek',
    'zone.edit.submit': 'Opslaan',
    'zone.status.occupied': 'Bezet',
    'zone.status.empty': 'Leeg sinds {days} dagen',
    'zone.sheep.empty': 'Geen schaap',
    'zone.bulkMove': 'Verplaats alle dieren',
    'move.title': 'Verplaats schaap',
    'move.paddockLabel': 'Weide',
    'move.zoneLabel': 'Zone',
    'move.submit': 'Verplaats',
    'move.bulkTitle': 'Verplaats alle dieren',
    'move.bulkSourceLabel': 'Bronzone',
    'move.bulkCountLabel': 'Aantal schapen',
    'move.bulkTargetPaddockLabel': 'Doelweide',
    'move.bulkTargetZoneLabel': 'Doelzone',
    'move.bulkSubmit': 'Verplaats alle dieren',
    'move.deleteZoneTitle': 'Zone verwijderen en schapen verplaatsen',
    'move.deleteZoneSourceLabel': 'Te verwijderen zone',
    'move.deleteZoneTargetLabel': 'Doelzone',
    'move.deleteZoneSubmit': 'Verplaats en verwijder',
    'move.deletePaddockTitle': 'Weide verwijderen en schapen verplaatsen',
    'move.deletePaddockSourceLabel': 'Te verwijderen weide',
    'move.deletePaddockTargetLabel': 'Doelzone',
    'move.deletePaddockSubmit': 'Verplaats en verwijder',
    'weather.sunny': 'Zonnig',
    'weather.partlyCloudy': 'Halfbewolkt',
    'weather.cloudy': 'Bewolkt',
    'weather.fog': 'Mist',
    'weather.rain': 'Regen',
    'weather.snow': 'Sneeuw',
    'weather.thunderstorm': 'Onweer',
    'weather.variable': 'Wisselend',
    'weather.loading': '3-daagse forecast laden...',
    'weather.noPostcode': 'Geen postcode voor forecast',
    'weather.noForecast': 'Geen forecast beschikbaar voor postcode {postcode}',
    'weather.rainPercentage': '{rain}% regen',
    'history.empty': 'Nog geen wijzigingen geregistreerd.',
    'history.paddock.added': 'Weide {name} toegevoegd',
    'history.paddock.updated': 'Weide bijgewerkt: {details}',
    'history.paddock.deleted': 'Weide {name} verwijderd',
    'history.paddockMove.auto': 'Weide {name} verwijderd en schapen automatisch verplaatst naar {target}: {sheep}',
    'history.paddockMove.manual': 'Weide {name} verwijderd en schapen verplaatst naar {target}: {sheep}',
    'history.zone.added': 'Zone {name} toegevoegd in weide {paddock}',
    'history.zone.updated': 'Zone bijgewerkt: {details}',
    'history.zone.deleted': 'Zone {paddock} / {name} verwijderd',
    'history.zoneMove.auto': 'Zone {paddock} / {name} verwijderd en schapen automatisch verplaatst naar {target}: {sheep}',
    'history.zoneMove.manual': 'Zone {paddock} / {name} verwijderd en schapen verplaatst naar {target}: {sheep}',
    'history.sheep.moved': '{sheep} verplaatst van {from} naar {to}',
    'history.import.duplicates': '{count} duplicaat oorkenmerk(en) verwijderd bij import',
    'history.import.success': 'Gegevens geïmporteerd uit bestand',
    'history.clear': 'Alle gegevens gewist',
    'history.details.name': 'naam {from} -> {name}',
    'history.details.postcode': 'postcode {from} -> {postcode}',
    'history.details.area': 'oppervlakte {from} -> {area}',
    'history.details.perimeter': 'omtrek {from} -> {perimeter}',
    'alert.earmarkDuplicate': 'Dit oorkenmerk is al toegewezen aan een ander schaap.',
    'alert.stalPaddockDelete': 'De weide Stal kan niet worden verwijderd.',
    'alert.stalZoneDelete': 'De Stal-zone kan niet worden verwijderd.',
    'alert.zoneMinimum': 'Een weide moet minstens 1 zone behouden.',
    'alert.noTargetZoneInPaddock': 'Geen doelzone beschikbaar binnen deze weide.',
    'alert.noTargetZone': 'Geen doelzone beschikbaar. Voeg eerst een extra zone of weide met zone toe.',
    'alert.noSheepInZone': 'Geen schapen in deze zone om te verplaatsen.',
    'alert.noTargetPaddock': 'Deze weide bevat schapen. Er moet eerst een andere weide met minstens 1 zone zijn om de schapen te verplaatsen.',
    'alert.postcodeNotFound': 'Postcode niet gevonden',
    'alert.postcodeFormatUnknown': 'Onbekend postcodeformaat',
    'alert.forecastDataMissing': 'Geen forecast data',
    'alert.importError': 'Kon bestand niet laden: {error}',
    'alert.importSuccess': 'Gegevens succesvol geladen.',
    'confirm.clearAll': 'Weet je zeker dat je alle gegevens wilt wissen? Dit kan niet ongedaan worden gemaakt.',
    'unknown': 'Onbekend',
    'fieldZone': 'Veld / Zone',
    'ui.add': 'Toevoegen',
    'paddock.add.namePlaceholder': 'Naam weide',
    'paddock.add.postcodePlaceholder': 'Postcode (optioneel)',
    'paddock.edit.namePlaceholder': 'Naam weide',
    'paddock.edit.postcodePlaceholder': 'Postcode (optioneel)',
    'zone.add.namePlaceholder': 'Zone naam',
    'zone.edit.namePlaceholder': 'Zone naam'
  },
  en: {
    'app.title': 'Sheep Tracker',
    'ui.save': 'Save',
    'ui.upload': 'Upload',
    'ui.clear': 'Clear',
    'ui.language': 'Language',
    'tab.paddocksZones': 'Paddocks and zones',
    'tab.sheep': 'Sheep',
    'tab.history': 'History',
    'section.paddocks': 'Paddocks',
    'section.sheep': 'Sheep',
    'section.history': 'History',
    'sheep.add.title': 'Add sheep',
    'sheep.add.tagPlaceholder': 'Tag',
    'sheep.add.earmarkPlaceholder': 'Earmark (optional)',
    'sheep.add.genderLabel': 'Sex',
    'sheep.gender.female': 'Ewe',
    'sheep.gender.male': 'Ram',
    'sheep.add.pedigreeLabel': 'Pedigree',
    'sheep.add.locationLabel': 'Location',
    'sheep.add.submit': 'Add',
    'sheep.edit.title': 'Edit sheep',
    'sheep.edit.tagPlaceholder': 'New name',
    'sheep.edit.earmarkLabel': 'Earmark',
    'sheep.edit.earmarkPlaceholder': 'Add earmark',
    'sheep.edit.genderLabel': 'Sex',
    'sheep.edit.pedigreeLabel': 'Pedigree',
    'sheep.edit.locationLabel': 'Location',
    'sheep.edit.submit': 'Save',
    'sheep.location.unknownPaddock': 'Unknown paddock',
    'sheep.location.unknownZone': 'Unknown zone',
    'sheep.location.none': 'No zone',
    'sheep.empty': 'No sheep',
    'select.paddock.first': 'Choose a paddock first',
    'select.paddock.choose': 'Choose paddock',
    'select.zone.choose': 'Choose zone',
    'select.zone.noneAvailable': 'No zones available',
    'select.parent.mother': 'Mother (optional, ewes only)',
    'select.parent.father': 'Father (optional, rams only)',
    'history.sheep.added': '{tag} added in {location}',
    'history.sheep.updated': 'Sheep updated: {details}',
    'history.sheep.deleted': '{tag} removed from {location}',
    'history.details.name': 'name {from} -> {to}',
    'history.details.earmarkAdded': 'earmark added: {earmark}',
    'entity.sheep': 'sheep',
    'errors.earmark.duplicate': 'This earmark is already assigned to another sheep.',
    'labels.lastUpdated': 'Last updated: {date} ({days} days ago)',
    'actions.move': 'Move',
    'aria.editSheepName': 'Edit name for {tag}',
    'aria.deleteSheep': 'Delete sheep',
    'aria.addSheep': 'Add sheep',
    'aria.addPaddock': 'Add paddock',
    'aria.editPaddock': 'Edit paddock',
    'aria.deletePaddock': 'Delete paddock',
    'aria.collapsePaddock': 'Collapse paddock',
    'aria.expandPaddock': 'Expand paddock',
    'aria.addZone': 'Add zone',
    'aria.editZone': 'Edit zone',
    'aria.deleteZone': 'Delete zone',
    'aria.moveSheep': 'Move {tag}',
    'aria.weatherForecast': 'Weather forecast',
    'paddock.add.title': 'Add paddock',
    'paddock.add.nameLabel': 'Paddock name',
    'paddock.add.postcodeLabel': 'Postcode (optional)',
    'paddock.add.submit': 'Add',
    'paddock.edit.title': 'Edit paddock',
    'paddock.edit.nameLabel': 'Paddock name',
    'paddock.edit.postcodeLabel': 'Postcode (optional)',
    'paddock.edit.submit': 'Save',
    'paddock.empty': 'No paddocks',
    'paddock.sheep.singular': 'sheep',
    'paddock.sheep.plural': 'sheep',
    'paddock.zones.badge': '{count} zone(s)',
    'zone.add.title': 'Add zone',
    'zone.add.paddockLabel': 'Paddock',
    'zone.add.nameLabel': 'Zone name',
    'zone.add.areaLabel': 'Area (m2)',
    'zone.add.areaPlaceholder': 'Area (m2)',
    'zone.add.perimeterLabel': 'Perimeter (m)',
    'zone.add.perimeterPlaceholder': 'Perimeter (m)',
    'zone.add.submit': 'Add',
    'zone.edit.title': 'Edit zone',
    'zone.edit.paddockLabel': 'Paddock',
    'zone.edit.nameLabel': 'Zone name',
    'zone.edit.areaLabel': 'Area (m2)',
    'zone.edit.areaPlaceholder': 'Area',
    'zone.edit.perimeterLabel': 'Perimeter (m)',
    'zone.edit.perimeterPlaceholder': 'Perimeter',
    'zone.edit.submit': 'Save',
    'zone.status.occupied': 'Occupied',
    'zone.status.empty': 'Empty for {days} days',
    'zone.sheep.empty': 'No sheep',
    'zone.bulkMove': 'Move all animals',
    'move.title': 'Move sheep',
    'move.paddockLabel': 'Paddock',
    'move.zoneLabel': 'Zone',
    'move.submit': 'Move',
    'move.bulkTitle': 'Move all animals',
    'move.bulkSourceLabel': 'Source zone',
    'move.bulkCountLabel': 'Number of sheep',
    'move.bulkTargetPaddockLabel': 'Target paddock',
    'move.bulkTargetZoneLabel': 'Target zone',
    'move.bulkSubmit': 'Move all animals',
    'move.deleteZoneTitle': 'Delete zone and move sheep',
    'move.deleteZoneSourceLabel': 'Zone to delete',
    'move.deleteZoneTargetLabel': 'Target zone',
    'move.deleteZoneSubmit': 'Move and delete',
    'move.deletePaddockTitle': 'Delete paddock and move sheep',
    'move.deletePaddockSourceLabel': 'Paddock to delete',
    'move.deletePaddockTargetLabel': 'Target zone',
    'move.deletePaddockSubmit': 'Move and delete',
    'weather.sunny': 'Sunny',
    'weather.partlyCloudy': 'Partly cloudy',
    'weather.cloudy': 'Cloudy',
    'weather.fog': 'Fog',
    'weather.rain': 'Rain',
    'weather.snow': 'Snow',
    'weather.thunderstorm': 'Thunderstorm',
    'weather.variable': 'Variable',
    'weather.loading': '3-day forecast loading...',
    'weather.noPostcode': 'No postcode for forecast',
    'weather.noForecast': 'No forecast available for postcode {postcode}',
    'weather.rainPercentage': '{rain}% rain',
    'history.empty': 'No changes recorded yet.',
    'history.paddock.added': 'Paddock {name} added',
    'history.paddock.updated': 'Paddock updated: {details}',
    'history.paddock.deleted': 'Paddock {name} deleted',
    'history.paddockMove.auto': 'Paddock {name} deleted and sheep auto-moved to {target}: {sheep}',
    'history.paddockMove.manual': 'Paddock {name} deleted and sheep moved to {target}: {sheep}',
    'history.zone.added': 'Zone {name} added in paddock {paddock}',
    'history.zone.updated': 'Zone updated: {details}',
    'history.zone.deleted': 'Zone {paddock} / {name} deleted',
    'history.zoneMove.auto': 'Zone {paddock} / {name} deleted and sheep auto-moved to {target}: {sheep}',
    'history.zoneMove.manual': 'Zone {paddock} / {name} deleted and sheep moved to {target}: {sheep}',
    'history.sheep.moved': '{sheep} moved from {from} to {to}',
    'history.import.duplicates': '{count} duplicate earmark(s) removed during import',
    'history.import.success': 'Data imported from file',
    'history.clear': 'All data deleted',
    'history.details.name': 'name {from} -> {name}',
    'history.details.postcode': 'postcode {from} -> {postcode}',
    'history.details.area': 'area {from} -> {area}',
    'history.details.perimeter': 'perimeter {from} -> {perimeter}',
    'alert.earmarkDuplicate': 'This earmark is already assigned to another sheep.',
    'alert.stalPaddockDelete': 'The Stal paddock cannot be deleted.',
    'alert.stalZoneDelete': 'The Stal zone cannot be deleted.',
    'alert.zoneMinimum': 'A paddock must keep at least 1 zone.',
    'alert.noTargetZoneInPaddock': 'No target zone available within this paddock.',
    'alert.noTargetZone': 'No target zone available. First add an extra zone or paddock with zone.',
    'alert.noSheepInZone': 'No sheep in this zone to move.',
    'alert.noTargetPaddock': 'This paddock contains sheep. There must first be another paddock with at least 1 zone to move the sheep.',
    'alert.postcodeNotFound': 'Postcode not found',
    'alert.postcodeFormatUnknown': 'Unknown postcode format',
    'alert.forecastDataMissing': 'No forecast data',
    'alert.importError': 'Could not load file: {error}',
    'alert.importSuccess': 'Data successfully loaded.',
    'confirm.clearAll': 'Are you sure you want to delete all data? This cannot be undone.',
    'unknown': 'Unknown',
    'fieldZone': 'Field / Zone',
    'ui.add': 'Add',
    'paddock.add.namePlaceholder': 'Paddock name',
    'paddock.add.postcodePlaceholder': 'Postcode (optional)',
    'paddock.edit.namePlaceholder': 'Paddock name',
    'paddock.edit.postcodePlaceholder': 'Postcode (optional)',
    'zone.add.namePlaceholder': 'Zone name',
    'zone.edit.namePlaceholder': 'Zone name'
  }
}

let currentLang = (() => {
  try {
    const saved = localStorage.getItem(LANG_KEY)
    return (saved && translations[saved]) ? saved : 'nl'
  } catch (e) {
    console.warn('localStorage not available, using default language')
    return 'nl'
  }
})()

function localeTag(){
  return currentLang === 'en' ? 'en-GB' : 'nl-NL'
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
  applyStaticTranslations()
  render()
}

function applyStaticTranslations(){
  document.documentElement.lang = currentLang
  const setText = (id, value) => {
    const el = document.getElementById(id)
    if(el) el.textContent = value
  }
  const setPlaceholder = (id, value) => {
    const el = document.getElementById(id)
    if(el) el.setAttribute('placeholder', value)
  }

  setText('app-title', t('app.title'))
  setText('download-data-btn', t('ui.save'))
  setText('upload-data-btn', t('ui.upload'))
  setText('clear-data-btn', t('ui.clear'))
  setText('tab-paddocks-btn', t('tab.paddocksZones'))
  setText('tab-sheep-btn', t('tab.sheep'))
  setText('tab-history-btn', t('tab.history'))
  setText('section-paddocks-title', t('section.paddocks'))
  setText('section-sheep-title', t('section.sheep'))
  setText('section-history-title', t('section.history'))

  setText('sheep-modal-title', t('sheep.add.title'))
  setPlaceholder('sheep-modal-tag', t('sheep.add.tagPlaceholder'))
  setPlaceholder('sheep-modal-earmark', t('sheep.add.earmarkPlaceholder'))
  setText('sheep-modal-gender-label', t('sheep.add.genderLabel'))
  setText('sheep-modal-gender-female-label', t('sheep.gender.female'))
  setText('sheep-modal-gender-male-label', t('sheep.gender.male'))
  setText('sheep-modal-pedigree-label', t('sheep.add.pedigreeLabel'))
  setText('sheep-modal-location-label', t('sheep.add.locationLabel'))
  setText('sheep-modal-submit', t('sheep.add.submit'))

  setText('sheep-edit-modal-title', t('sheep.edit.title'))
  setPlaceholder('sheep-tag-edit-input', t('sheep.edit.tagPlaceholder'))
  setText('sheep-edit-earmark-label', t('sheep.edit.earmarkLabel'))
  setPlaceholder('sheep-edit-earmark-input', t('sheep.edit.earmarkPlaceholder'))
  setText('sheep-edit-gender-label', t('sheep.edit.genderLabel'))
  setText('sheep-edit-pedigree-label', t('sheep.edit.pedigreeLabel'))
  setText('sheep-edit-location-label', t('sheep.edit.locationLabel'))
  setText('sheep-edit-modal-submit', t('sheep.edit.submit'))

  // Paddock modals
  setText('paddock-modal-title', t('paddock.add.title'))
  setPlaceholder('paddock-modal-name', t('paddock.add.namePlaceholder'))
  setPlaceholder('paddock-modal-postcode', t('paddock.add.postcodePlaceholder'))
  setText('paddock-modal-submit', t('ui.add'))
  
  setText('paddock-edit-modal-title', t('paddock.edit.title'))
  setPlaceholder('paddock-edit-name', t('paddock.edit.namePlaceholder'))
  setPlaceholder('paddock-edit-postcode', t('paddock.edit.postcodePlaceholder'))
  setText('paddock-edit-submit', t('ui.save'))

  // Zone modals
  setText('zone-modal-title', t('zone.add.title'))
  setPlaceholder('zone-modal-name', t('zone.add.namePlaceholder'))
  setPlaceholder('zone-modal-area', t('zone.add.areaPlaceholder'))
  setPlaceholder('zone-modal-perimeter', t('zone.add.perimeterPlaceholder'))
  setText('zone-modal-submit', t('ui.add'))

  setText('zone-edit-modal-title', t('zone.edit.title'))
  setPlaceholder('zone-edit-name', t('zone.edit.namePlaceholder'))
  setPlaceholder('zone-edit-area', t('zone.edit.areaPlaceholder'))
  setPlaceholder('zone-edit-perimeter', t('zone.edit.perimeterPlaceholder'))
  setText('zone-edit-submit', t('ui.save'))

  // Move modals
  setText('move-modal-title', t('move.title'))
  setText('zone-bulk-move-modal-title', t('move.bulkTitle'))
  setText('zone-delete-move-modal-title', t('move.deleteZoneTitle'))
  setText('paddock-delete-move-modal-title', t('move.deletePaddockTitle'))

  const langSelect = document.getElementById('language-select')
  if(langSelect) langSelect.value = currentLang
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

function initTabs(){
  const tabButtons = Array.from(document.querySelectorAll('.tab-button[data-tab]'))
  const panels = {
    paddocks: document.getElementById('tab-paddocks-panel'),
    sheep: document.getElementById('tab-sheep-panel'),
    history: document.getElementById('tab-history-panel')
  }
  if(!tabButtons.length || !panels.paddocks || !panels.sheep || !panels.history) return

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

  setActiveTab('paddocks')
}

function detectPostcodeCountry(postcode){
  const normalized = postcode.trim().toUpperCase().replace(/\s+/g, '')
  if(/^\d{4}$/.test(normalized)) return 'BE'
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
      day: formatForecastDay(d),
      label: weatherLabel(daily.weathercode?.[i]),
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

  return `<div class="paddock-weather${visibilityClass}">${cached.days.map(day => `<div class="weather-day"><strong>${day.day}</strong><small>${day.label}</small><small>${day.max}° / ${day.min}°</small><small>${t('weather.rainPercentage', { rain: day.rain })}</small></div>`).join('')}</div>`
}

function ensureDefaultStal(){
  if(state.paddocks.length > 0) return
  const paddockId = uid()
  const zoneId = uid()
  state.paddocks.push({
    id: paddockId,
    name: 'Stal',
    postcode: '',
    zones: [{ id: zoneId, name: 'Stal', area: null, perimeter: null, emptySince: Date.now() }]
  })
}

function load(){
  const raw = localStorage.getItem(KEY)
  if(raw){
    const saved = JSON.parse(raw)
    state.paddocks = Array.isArray(saved.paddocks) ? saved.paddocks.map(p => ({
      id: p.id,
      name: p.name,
      postcode: typeof p.postcode === 'string' ? p.postcode : '',
      zones: Array.isArray(p.zones) ? p.zones.map(z => ({
        id: z.id,
        name: z.name,
        area: Number.isFinite(Number(z.area)) ? Number(z.area) : null,
        perimeter: Number.isFinite(Number(z.perimeter)) ? Number(z.perimeter) : null,
        emptySince: z.emptySince ?? Date.now()
      })) : []
    })) : []
    state.sheep = Array.isArray(saved.sheep) ? saved.sheep.map(s => ({
      id: s.id,
      tag: s.tag,
      earmark: typeof s.earmark === 'string' && s.earmark.trim() ? s.earmark.trim() : null,
      gender: s.gender === 'male' || s.gender === 'female' ? s.gender : null,
      motherId: s.motherId ?? null,
      fatherId: s.fatherId ?? null,
      paddockId: s.paddockId,
      zoneId: s.zoneId ?? null,
      lastUpdated: s.lastUpdated ?? Date.now()
    })) : []
    state.history = Array.isArray(saved.history) ? saved.history.map(h => ({
      id: h.id || uid(),
      ts: h.ts ?? Date.now(),
      entity: h.entity || 'systeem',
      message: h.message || ''
    })) : []
  }
  ensureDefaultStal()
  dedupeEarmarks()
  updateZoneEmptyStates()
}

function save(){
  updateZoneEmptyStates()
  localStorage.setItem(KEY, JSON.stringify(state))
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

function updateZoneEmptyStates(){
  state.paddocks.forEach(p => {
    p.zones.forEach(z => {
      const assigned = state.sheep.some(s => s.paddockId === p.id && s.zoneId === z.id)
      if(assigned){
        z.emptySince = null
      } else if(!z.emptySince){
        z.emptySince = Date.now()
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

function addHistory(entity, message){
  state.history.unshift({
    id: uid(),
    ts: Date.now(),
    entity,
    message
  })
  if(state.history.length > 400){
    state.history = state.history.slice(0, 400)
  }
}

function sheepNamesList(sheepItems){
  return sheepItems.map(s => s.tag).join(', ')
}

function exportData(){
  const exportState = {
    ...state,
    history: Array.isArray(state.history) ? state.history.slice(0, 100) : []
  }
  const json = JSON.stringify(exportState, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `schapentracker-${new Date().toISOString().slice(0,10)}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function importDataFile(file){
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result)
      if(!parsed || typeof parsed !== 'object') throw new Error('Ongeldig bestand')
      state.paddocks = Array.isArray(parsed.paddocks) ? parsed.paddocks.map(p => ({
        id: p.id,
        name: p.name,
        postcode: typeof p.postcode === 'string' ? p.postcode : '',
        zones: Array.isArray(p.zones) ? p.zones.map(z => ({
          id: z.id,
          name: z.name,
          area: Number.isFinite(Number(z.area)) ? Number(z.area) : null,
          perimeter: Number.isFinite(Number(z.perimeter)) ? Number(z.perimeter) : null,
          emptySince: z.emptySince ?? Date.now()
        })) : []
      })) : []
      state.sheep = Array.isArray(parsed.sheep) ? parsed.sheep.map(s => ({
        id: s.id,
        tag: s.tag,
        earmark: typeof s.earmark === 'string' && s.earmark.trim() ? s.earmark.trim() : null,
        gender: s.gender === 'male' || s.gender === 'female' ? s.gender : null,
        motherId: s.motherId ?? null,
        fatherId: s.fatherId ?? null,
        paddockId: s.paddockId,
        zoneId: s.zoneId ?? null,
        lastUpdated: s.lastUpdated ?? Date.now()
      })) : []
      state.history = Array.isArray(parsed.history) ? parsed.history.map(h => ({
        id: h.id || uid(),
        ts: h.ts ?? Date.now(),
        entity: h.entity || 'systeem',
        message: h.message || ''
      })) : []
      ensureDefaultStal()
      const removedEarmarks = dedupeEarmarks()
      updateZoneEmptyStates()
      if(removedEarmarks > 0){
        addHistory('systeem', t('history.import.duplicates', { count: removedEarmarks }))
      }
      addHistory('systeem', t('history.import.success'))
      save(); render()
      alert(t('alert.importSuccess'))
    } catch (err) {
      alert(t('alert.importError', { error: err.message }))
    }
  }
  reader.readAsText(file)
}

function render(){
  updateZoneEmptyStates()
  const paddockList = document.getElementById('paddock-list')
  const sheepList = document.getElementById('sheep-list')
  const historyList = document.getElementById('history-list')
  const sheepPaddockModal = document.getElementById('sheep-paddock-modal')
  const sheepZoneModal = document.getElementById('sheep-zone-modal')
  const movePaddockModal = document.getElementById('move-paddock-modal')
  const moveZoneModal = document.getElementById('move-zone-modal')

  paddockList.innerHTML = state.paddocks.length === 0 ? `<div class="empty">${t('paddock.empty')}</div>` : state.paddocks.map(p => renderPaddock(p)).join('') + `
    <button type="button" class="add-paddock-block" aria-label="${t('aria.addPaddock')}">+</button>
  `

  sheepList.innerHTML = state.sheep.map(s => `
      <div class="sheep-card">
        <div class="sheep-card-body">
          <button type="button" class="sheep-tag-edit-button" data-id="${s.id}" aria-label="${t('aria.editSheepName', { tag: s.tag })}">${genderIcon(s.gender)}${s.tag}</button>
          <small>${paddockName(s.paddockId)}${s.zoneId ? ' / ' + zoneName(s.paddockId, s.zoneId) : ''}</small>
          <small>${t('labels.lastUpdated', { date: formatDate(s.lastUpdated), days: daysSince(s.lastUpdated) })}</small>
        </div>
        <div class="sheep-actions">
          <button type="button" class="move-button" data-id="${s.id}">${t('actions.move')}</button>
          <button type="button" class="sheep-delete-button" data-id="${s.id}" aria-label="${t('aria.deleteSheep')}">−</button>
        </div>
      </div>
    `).join('') + `
      <button type="button" class="sheep-card add-sheep-card" id="add-sheep-block" aria-label="${t('aria.addSheep')}">
        <span class="add-zone-icon">+</span>
      </button>
    `

  if(historyList){
    historyList.classList.toggle('is-scrollable', state.history.length > 5)
    historyList.innerHTML = state.history.length
      ? state.history.map(h => `<div class="history-item"><span class="history-meta">${formatDateTime(h.ts)} - ${h.entity}</span><span class="history-message">${h.message}</span></div>`).join('')
      : `<div class="empty">${t('history.empty')}</div>`
  }

  if(sheepPaddockModal && sheepZoneModal){
    setSheepModalDefaultSelection()
  }
  populateParentSheepSelects()

  if(movePaddockModal){
    populatePaddockSelect(movePaddockModal)
  }
  if(moveZoneModal){
    moveZoneModal.innerHTML = `<option value="">${t('select.paddock.first')}</option>`
    moveZoneModal.disabled = true
  }
}

function renderPaddock(p){
  const isExpanded = !collapsedPaddockIds.has(p.id)
  const isWeatherExpanded = expandedWeatherPaddocks.has(p.id)
  const sheepCount = state.sheep.filter(s => s.paddockId === p.id).length
  const sheepLabel = sheepCount === 1 ? t('paddock.sheep.singular') : t('paddock.sheep.plural')
  const paddockPostcode = (p.postcode || '').trim()
  const hasZoneArea = p.zones.some(z => z.area !== null)
  const totalZoneArea = p.zones.reduce((sum, z) => sum + (Number.isFinite(Number(z.area)) ? Number(z.area) : 0), 0)
  const paddockArea = hasZoneArea ? `${totalZoneArea} m2` : ''
  const weatherHtml = renderPaddockWeather(p, isWeatherExpanded)
  const canDeletePaddock = !isStalPaddock(p)
  return `<div class="card" data-id="${p.id}" ${isExpanded ? 'data-expanded="true"' : ''}>
    <div class="card-header" data-paddock-id="${p.id}" style="user-select:none">
      <div class="card-header-main">
        <button type="button" class="paddock-edit-button" data-paddock-id="${p.id}" aria-label="${t('aria.editPaddock')}">✎</button>
        <button type="button" class="paddock-collapse-button" data-paddock-id="${p.id}" aria-label="${isExpanded ? t('aria.collapsePaddock') : t('aria.expandPaddock')}">${isExpanded ? '▾' : '▸'}</button>
        <strong>${p.name}</strong>
        ${paddockPostcode ? `<span class="paddock-postcode">${paddockPostcode}</span>` : ''}
        ${paddockArea ? `<span class="paddock-metric">${paddockArea}</span>` : ''}
        <span class="paddock-sheep-count">${sheepCount} ${sheepLabel}</span>
      </div>
      <div class="card-header-actions">
        <span class="badge">${t('paddock.zones.badge', { count: p.zones.length })}</span>
        <button type="button" class="weather-toggle-button" data-paddock-id="${p.id}">${t('aria.weatherForecast')}</button>
        ${canDeletePaddock ? `<button type="button" class="paddock-delete-button" data-paddock-id="${p.id}" aria-label="${t('aria.deletePaddock')}">−</button>` : ''}
      </div>
    </div>
    ${weatherHtml}
    <div class="zone-list" ${isExpanded ? '' : 'style="display:none"'}>
      ${p.zones.map(z => {
        const sheepInZone = state.sheep.filter(s => s.paddockId === p.id && s.zoneId === z.id)
        const sheepCount = sheepInZone.length
        const emptyDays = z.emptySince ? daysSince(z.emptySince) : 0
        const status = z.emptySince ? t('zone.status.empty', { days: emptyDays }) : `${t('zone.status.occupied')}${sheepCount ? ` (${sheepCount})` : ''}`
        const zoneArea = z.area !== null ? `${z.area} m2` : ''
        const zonePerimeter = z.perimeter !== null ? `${z.perimeter} m` : ''
        const bulkMoveButton = sheepCount > 1 ? `<button type="button" class="zone-bulk-move-button" data-paddock-id="${p.id}" data-zone-id="${z.id}">${t('zone.bulkMove')}</button>` : ''
        const sheepLabel = sheepCount
          ? `<div class="zone-sheep-list${sheepCount > 3 ? ' is-scrollable' : ''}">${sheepInZone.map(s => `<button type="button" class="zone-sheep-link" data-sheep-id="${s.id}" aria-label="${t('aria.moveSheep', { tag: s.tag })}">${sheepIcon()}${s.tag}</button>`).join('')}</div>${bulkMoveButton}`
          : t('zone.sheep.empty')
        const stallZone = isStalZone(p, z)
        const useStallBackground = isStalPaddock(p)
        const canDeleteZone = !stallZone && p.zones.length > 1
        return `<div class="zone-item${useStallBackground ? ' stall-zone-item' : ''}" data-paddock-id="${p.id}" data-zone-id="${z.id}">${canDeleteZone ? `<button type="button" class="zone-delete-button" data-paddock-id="${p.id}" data-zone-id="${z.id}" aria-label="${t('aria.deleteZone')}">−</button>` : ''}<div class="zone-header"><div class="zone-title-row"><button type="button" class="zone-edit-button" data-paddock-id="${p.id}" data-zone-id="${z.id}" aria-label="${t('aria.editZone')}">✎</button><strong>${z.name}</strong></div><div class="zone-metrics">${zoneArea ? `<span class="zone-metric">${zoneArea}</span>` : ''}${zonePerimeter ? `<span class="zone-metric">${zonePerimeter}</span>` : ''}</div><small>${status}</small></div><div class="zone-bottom">${sheepLabel}</div></div>`
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
  if(!sheepPaddockModal || !sheepZoneModal) return

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
    .filter(s => s.gender === 'female')
    .map(s => `<option value="${s.id}">${s.tag}</option>`)
    .join('')
  const maleOptions = state.sheep
    .filter(s => s.gender === 'male')
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
    .filter(s => s.paddockId === paddockId && s.zoneId === zoneId)
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
    const movedNames = sheepNamesList(sheepToMove)
    state.sheep.forEach(s => {
      if(s.paddockId === sourcePaddockId && s.zoneId === sourceZoneId){
        s.paddockId = target.paddockId
        s.zoneId = target.zoneId
        s.lastUpdated = Date.now()
      }
    })
    sourcePaddock.zones = sourcePaddock.zones.filter(z => z.id !== sourceZoneId)
    addHistory('zone', t('history.zoneMove.auto', { paddock: sourcePaddock.name, name: sourceZone.name, target: `${paddockName(target.paddockId)} / ${zoneName(target.paddockId, target.zoneId)}`, sheep: movedNames }))
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
    const movedNames = sheepNamesList(sheepToMove)
    state.sheep.forEach(s => {
      if(s.paddockId === sourcePaddockId){
        s.paddockId = target.paddockId
        s.zoneId = target.zoneId
        s.lastUpdated = Date.now()
      }
    })
    state.paddocks = state.paddocks.filter(p => p.id !== sourcePaddockId)
    collapsedPaddockIds.delete(sourcePaddockId)
    addHistory('weide', t('history.paddockMove.auto', { name: sourcePaddock.name, target: `${paddockName(target.paddockId)} / ${zoneName(target.paddockId, target.zoneId)}`, sheep: movedNames }))
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

document.getElementById('download-data-btn')?.addEventListener('click', exportData)

document.getElementById('upload-data-btn')?.addEventListener('click', () => {
  document.getElementById('upload-data-input')?.click()
})

document.getElementById('clear-data-btn')?.addEventListener('click', () => {
  if(!confirm(t('confirm.clearAll'))) return
  state.paddocks = []
  state.sheep = []
  state.history = []
  collapsedPaddockIds.clear()
  expandedWeatherPaddocks.clear()
  ensureDefaultStal()
  addHistory('systeem', t('history.clear'))
  localStorage.removeItem(KEY)
  save()
  render()
})

document.getElementById('upload-data-input')?.addEventListener('change', e => {
  const files = e.target.files
  if(files && files.length){
    importDataFile(files[0])
  }
  e.target.value = ''
})


document.getElementById('paddock-modal-close')?.addEventListener('click', () => closeModal('paddock-modal'))
document.getElementById('paddock-modal-backdrop')?.addEventListener('click', () => closeModal('paddock-modal'))

document.getElementById('paddock-edit-modal-close')?.addEventListener('click', closeEditPaddockModal)
document.getElementById('paddock-edit-modal-backdrop')?.addEventListener('click', closeEditPaddockModal)

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
  addHistory('schaap', t('history.sheep.moved', { sheep: sheep.tag, from: fromLabel, to: toLabel }))
  save(); render(); closeModal('move-modal')
})

document.getElementById('paddock-modal-form')?.addEventListener('submit', e => {
  e.preventDefault()
  const name = document.getElementById('paddock-modal-name').value.trim()
  const postcode = document.getElementById('paddock-modal-postcode').value.trim()
  if(!name) return
  state.paddocks.push({id:uid(), name, postcode, zones: []})
  addHistory('weide', t('history.paddock.added', { name }))
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
    const details = []
    if(beforeName !== paddock.name) details.push(t('history.details.name', { from: beforeName, name: paddock.name }))
    if(beforePostcode !== paddock.postcode) details.push(t('history.details.postcode', { from: beforePostcode || '-', postcode: paddock.postcode || '-' }))
    addHistory('weide', t('history.paddock.updated', { details: details.join(', ') }))
  }

  save(); render(); closeEditPaddockModal()
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
  const nextName = nameInput ? nameInput.value.trim() : ''
  const nextArea = areaInput && areaInput.value.trim() !== '' ? Number(areaInput.value.trim()) : null
  const nextPerimeter = perimeterInput && perimeterInput.value.trim() !== '' ? Number(perimeterInput.value.trim()) : null

  const beforeName = zone.name
  const beforeArea = zone.area
  const beforePerimeter = zone.perimeter

  if(!isStalZone(paddock, zone) && nextName){
    zone.name = nextName
  }
  zone.area = nextArea
  zone.perimeter = nextPerimeter

  if(beforeName !== zone.name || beforeArea !== zone.area || beforePerimeter !== zone.perimeter){
    const details = []
    if(beforeName !== zone.name) details.push(t('history.details.name', { from: beforeName, name: zone.name }))
    if(beforeArea !== zone.area) details.push(t('history.details.area', { from: beforeArea ?? '-', area: zone.area ?? '-' }))
    if(beforePerimeter !== zone.perimeter) details.push(t('history.details.perimeter', { from: beforePerimeter ?? '-', perimeter: zone.perimeter ?? '-' }))
    addHistory('zone', t('history.zone.updated', { details: details.join(', ') }))
  }

  save(); render(); closeEditZoneModal()
})

document.getElementById('sheep-modal-form')?.addEventListener('submit', e => {
  e.preventDefault()
  const tag = document.getElementById('sheep-modal-tag').value.trim()
  const earmarkInput = document.getElementById('sheep-modal-earmark')
  const earmark = earmarkInput ? earmarkInput.value.trim() : ''
  const selectedGender = document.querySelector('input[name="sheep-modal-gender"]:checked')
  const gender = selectedGender ? selectedGender.value : null
  const motherId = document.getElementById('sheep-mother-modal').value || null
  const fatherId = document.getElementById('sheep-father-modal').value || null
  const paddockId = document.getElementById('sheep-paddock-modal').value
  const zoneId = document.getElementById('sheep-zone-modal').value
  if(!tag || !paddockId || !gender) return
  if(isEarmarkInUse(earmark)){
    alert(t('errors.earmark.duplicate'))
    return
  }
  if(motherId && !state.sheep.some(s => s.id === motherId && s.gender === 'female')) return
  if(fatherId && !state.sheep.some(s => s.id === fatherId && s.gender === 'male')) return
  state.sheep.push({id:uid(), tag, earmark: earmark || null, gender, motherId, fatherId, paddockId, zoneId: zoneId || null, lastUpdated: Date.now()})
  addHistory(t('entity.sheep'), t('history.sheep.added', { tag, location: `${paddockName(paddockId)}${zoneId ? ' / ' + zoneName(paddockId, zoneId) : ''}` }))
  document.getElementById('sheep-modal-tag').value = ''
  if(earmarkInput){
    earmarkInput.value = ''
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
  const nextTag = input ? input.value.trim() : ''
  const nextEarmark = earmarkInput ? earmarkInput.value.trim() : ''
  if(!nextTag) return

  const sheep = state.sheep.find(s => s.id === activeEditSheepId)
  if(!sheep) return

  const previousTag = sheep.tag
  const previousEarmark = sheep.earmark ?? null
  sheep.tag = nextTag
  if(!previousEarmark && nextEarmark && isEarmarkInUse(nextEarmark, sheep.id)){
    alert(t('errors.earmark.duplicate'))
    return
  }
  if(!previousEarmark && nextEarmark){
    sheep.earmark = nextEarmark
  }
  sheep.lastUpdated = Date.now()
  if(previousTag !== nextTag || (!previousEarmark && nextEarmark)){
    const namePart = previousTag !== nextTag ? t('history.details.name', { from: previousTag, to: nextTag }) : null
    const earmarkPart = (!previousEarmark && nextEarmark) ? t('history.details.earmarkAdded', { earmark: nextEarmark }) : null
    const details = [namePart, earmarkPart].filter(Boolean).join(', ')
    addHistory(t('entity.sheep'), t('history.sheep.updated', { details }))
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
  const movedNames = sheepNamesList(sheepToMove)

  state.sheep.forEach(s => {
    if(s.paddockId === pendingZoneDeletion.sourcePaddockId && s.zoneId === pendingZoneDeletion.sourceZoneId){
      s.paddockId = targetPaddockId
      s.zoneId = targetZoneId
      s.lastUpdated = Date.now()
    }
  })

  sourcePaddock.zones = sourcePaddock.zones.filter(z => z.id !== pendingZoneDeletion.sourceZoneId)
  addHistory('zone', t('history.zoneMove.manual', { paddock: sourcePaddock.name, name: sourceZone ? sourceZone.name : t('unknown'), target: `${paddockName(targetPaddockId)} / ${zoneName(targetPaddockId, targetZoneId)}`, sheep: movedNames }))
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
  const movedNames = sheepNamesList(sheepToMove)

  state.sheep.forEach(s => {
    if(s.paddockId === pendingPaddockDeletion.sourcePaddockId){
      s.paddockId = targetPaddockId
      s.zoneId = targetZoneId
      s.lastUpdated = Date.now()
    }
  })

  state.paddocks = state.paddocks.filter(p => p.id !== pendingPaddockDeletion.sourcePaddockId)
  collapsedPaddockIds.delete(pendingPaddockDeletion.sourcePaddockId)
  addHistory('weide', t('history.paddockMove.manual', { name: sourcePaddock ? sourcePaddock.name : t('unknown'), target: `${paddockName(targetPaddockId)} / ${zoneName(targetPaddockId, targetZoneId)}`, sheep: movedNames }))
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
  const movedNames = sheepNamesList(sheepToMove)

  state.sheep.forEach(s => {
    if(s.paddockId === pendingZoneBulkMove.sourcePaddockId && s.zoneId === pendingZoneBulkMove.sourceZoneId){
      s.paddockId = targetPaddockId
      s.zoneId = targetZoneId
      s.lastUpdated = Date.now()
    }
  })

  addHistory('schaap', t('history.sheep.moved', { sheep: movedNames, from: `${sourcePaddock ? sourcePaddock.name : t('unknown')} / ${sourceZone ? sourceZone.name : t('unknown')}`, to: `${paddockName(targetPaddockId)} / ${zoneName(targetPaddockId, targetZoneId)}` }))
  save(); render(); closeZoneBulkMoveModal()
})

document.getElementById('move-modal-close')?.addEventListener('click', () => closeModal('move-modal'))

document.getElementById('move-modal-backdrop')?.addEventListener('click', () => closeModal('move-modal'))

document.getElementById('sheep-list')?.addEventListener('click', e => {
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

  const deleteButton = e.target.closest('.sheep-delete-button')
  if(deleteButton){
    const sheepId = deleteButton.dataset.id
    if(!sheepId) return
    const sheep = state.sheep.find(s => s.id === sheepId)
    state.sheep = state.sheep.filter(s => s.id !== sheepId)
    state.sheep.forEach(s => {
      if(s.motherId === sheepId){
        s.motherId = null
      }
      if(s.fatherId === sheepId){
        s.fatherId = null
      }
    })
    if(sheep){
      addHistory(t('entity.sheep'), t('history.sheep.deleted', { tag: sheep.tag, location: `${paddockName(sheep.paddockId)}${sheep.zoneId ? ' / ' + zoneName(sheep.paddockId, sheep.zoneId) : ''}` }))
    }
    save(); render()
    return
  }

  const addBlock = e.target.closest('#add-sheep-block')
  if(addBlock){
    openModal('sheep-modal')
  }
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
    const sheepInPaddock = state.sheep.filter(s => s.paddockId === paddockId)
    if(sheepInPaddock.length){
      openPaddockDeleteMoveModal(paddockId, sheepInPaddock.length)
      return
    }
    state.paddocks = state.paddocks.filter(p => p.id !== paddockId)
    collapsedPaddockIds.delete(paddockId)
    expandedWeatherPaddocks.delete(paddockId)
    addHistory('weide', t('history.paddock.deleted', { name: paddock.name }))
    save(); render()
    return
  }

  const deleteZoneButton = e.target.closest('.zone-delete-button')
  if(deleteZoneButton){
    const paddockId = deleteZoneButton.dataset.paddockId || deleteZoneButton.dataset.paddockId
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

    const sheepInZone = state.sheep.filter(s => s.paddockId === paddockId && s.zoneId === zoneId)
    if(sheepInZone.length){
      openZoneDeleteMoveModal(paddockId, zoneId, sheepInZone.length)
      return
    }

    paddock.zones = paddock.zones.filter(z => z.id !== zoneId)
    addHistory('zone', t('history.zone.deleted', { paddock: paddock.name, name: zone.name }))
    save(); render()
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
  const area = areaValue === '' ? null : Number(areaValue)
  const perimeter = perimeterValue === '' ? null : Number(perimeterValue)
  if(!zoneName || !paddockId) return
  const paddock = getPaddock(paddockId)
  if(!paddock) return
  paddock.zones.push({id:uid(),name:zoneName,area,perimeter,emptySince: Date.now()})
  addHistory('zone', t('history.zone.added', { name: zoneName, paddock: paddock.name }))
  save(); render(); closeModal('zone-modal')
})

// Ensure initialization happens after DOM is fully loaded
if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', () => {
    initTabs()
    initLanguageSelector()
    applyStaticTranslations()
    load()
    render()
  })
} else {
  // DOM is already loaded (e.g., when script is deferred or at end of body)
  initTabs()
  initLanguageSelector()
  applyStaticTranslations()
  load()
  render()
}
