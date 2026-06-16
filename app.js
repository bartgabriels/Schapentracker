const KEY = 'flockops:data'
const LANG_KEY = 'flockops:lang'
const state = { paddocks: [], sheep: [], history: [] }
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
let pendingShearingPaddockId = null
let pendingInjectionSheepId = null
let pendingShearingSheepId = null

const translations = {
  nl: {
    'app.title': 'FlockOps',
      'app.subtitle': 'Een CALM-Hoeve Project',
    'ui.save': 'Opslaan',
    'ui.upload': 'Upload',
    'ui.clear': 'Wissen',
    'ui.language': 'Taal',
    'tab.paddocksZones': 'Weides en zones',
    'tab.sheep': 'Schapen',
    'tab.history': 'Historiek',
    'tab.billing': 'Facturatie',
    'section.paddocks': 'Weides',
    'section.sheep': 'Schapen',
    'section.history': 'Historiek',
    'section.billing': 'Facturatie',
    'billing.fields': 'Velden',
    'billing.zones': 'Zones',
    'billing.sheep': 'Schapen',
    'billing.rateMonthly': '{price} / maand',
    'billing.unlimited': 'Onbeperkt aantal',
    'billing.included': 'Inbegrepen',
    'billing.total': 'Totaal per maand',
    'billing.paypal.title': 'PayPal abonnementen',
    'billing.paypal.description': 'Integreer terugkerende betalingen via PayPal voor maandelijkse facturatie.',
    'billing.paypal.unconfigured': 'Voeg eerst een PayPal client ID en plan ID toe om recurring payments te activeren.',
    'billing.paypal.ready': 'PayPal recurring payments is klaar om gebruikt te worden.',
    'billing.paypal.approved': 'PayPal abonnement goedgekeurd. De terugkerende betaling is gestart.',
    'billing.paypal.error': 'PayPal kon niet geladen worden. Controleer de configuratie en probeer opnieuw.',
    'sheep.add.title': 'Schaap toevoegen',
    'sheep.add.tagPlaceholder': 'Tag',
    'sheep.add.earmarkPlaceholder': 'Oorkenmerk (optioneel)',
    'sheep.birthDateLabel': 'Geboortedatum',
    'sheep.genderLabel': 'Geslacht',
    'sheep.gender.female': 'Ooi',
    'sheep.gender.male': 'Ram',
    'sheep.pedigreeLabel': 'Stamboom',
    'sheep.locationLabel': 'Locatie',
    'sheep.notes.label': 'Notities',
    'sheep.notes.placeholder': 'Algemene notities (optioneel)',
    'sheep.add.submit': 'Toevoegen',
    'sheep.edit.title': 'Schaap bewerken',
    'sheep.edit.tagPlaceholder': 'Nieuwe naam',
    'sheep.edit.earmarkLabel': 'Oorkenmerk',
    'sheep.edit.earmarkPlaceholder': 'Oorkenmerk toevoegen',
    'sheep.edit.submit': 'Opslaan',
    'injection.title': 'Injectie registreren',
    'injection.paddockLabel': 'Weide',
    'injection.dateLabel': 'Datum',
    'injection.productLabel': 'Product',
    'injection.productPlaceholder': 'Productnaam',
    'injection.repeatLabel': 'Herhalen tegen',
    'injection.noRepeatLabel': 'Niet herhalen',
    'injection.sheepListLabel': 'Schapen',
    'injection.submit': 'Opslaan',
    'injection.sheepTitle': 'Injectie registreren',
    'injection.sheepLabel': 'Schaap',
    'shearing.title': 'Scheren registreren',
    'shearing.paddockLabel': 'Weide',
    'shearing.dateLabel': 'Datum',
    'shearing.sheepListLabel': 'Schapen',
    'shearing.submit': 'Bevestigen',
    'shearing.sheepTitle': 'Scheren registreren',
    'shearing.sheepLabel': 'Schaap',
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
    'history.injection.applied': 'Injectie geregistreerd in {paddock}: {product} ({date}, herhalen tegen {repeatDate}) voor {count} schapen',
    'history.injection.appliedNoRepeat': 'Injectie geregistreerd in {paddock}: {product} ({date}, niet herhalen) voor {count} schapen',
    'history.shearing.applied': 'Scheren geregistreerd in {paddock} op {date} voor {count} schapen',
    'history.injection.sheep': 'Injectie geregistreerd voor {sheep}: {product} ({date}, herhalen tegen {repeatDate})',
    'history.injection.sheepNoRepeat': 'Injectie geregistreerd voor {sheep}: {product} ({date}, niet herhalen)',
    'history.shearing.sheep': 'Scheren geregistreerd voor {sheep} op {date}',
    'labels.age': 'Leeftijd: {age}',
    'labels.ageYearsMonths': '{years} jr {months} mnd',
    'labels.birthDate': 'Geboortedatum: {date}',
    'labels.lastShearing': 'Laatste scheerbeurt: {value}',
    'labels.lastInjection': 'Laatste injectie: {value}',
    'labels.nextInjection': 'Eerstvolgende injectie: {value}',
    'labels.notAvailable': 'niet geregistreerd',
    'labels.lastUpdated': 'Laatst gewijzigd: {date} ({days} dagen geleden)',
    'actions.move': 'Verplaats',
    'aria.editSheepName': 'Naam wijzigen voor {tag}',
    'aria.setSheepBirthDate': 'Geboortedatum instellen voor {tag}',
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
    'aria.registerInjection': 'Injectie registreren voor {paddock}',
    'aria.registerShearing': 'Scheren registreren voor {paddock}',
    'aria.registerSheepInjection': 'Injectie registreren voor {tag}',
    'aria.registerSheepShearing': 'Scheren registreren voor {tag}',
    'aria.moveSheep': 'Verplaats {tag}',
    'aria.weatherForecast': 'Weervoorspelling',
    'paddock.add.title': 'Weide toevoegen',
    'paddock.nameLabel': 'Naam weide',
    'paddock.postcodeLabel': 'Postcode (optioneel)',
    'paddock.notes.label': 'Notities',
    'paddock.notes.placeholder': 'Algemene notities (optioneel)',
    'paddock.add.submit': 'Toevoegen',
    'paddock.edit.title': 'Weide bewerken',
    'paddock.edit.submit': 'Opslaan',
    'paddock.empty': 'Geen weides',
    'paddock.sheep.singular': 'schaap',
    'paddock.sheep.plural': 'schapen',
    'paddock.zones.badge': '{count} zone(s)',
    'zone.add.title': 'Zone toevoegen',
    'zone.paddockLabel': 'Weide',
    'zone.nameLabel': 'Zone naam',
    'zone.areaLabel': 'Oppervlakte (m2)',
    'zone.areaPlaceholderWithUnit': 'Oppervlakte (m2)',
    'zone.perimeterLabel': 'Omtrek (m)',
    'zone.add.perimeterPlaceholder': 'Omtrek (m)',
    'zone.notes.label': 'Notities',
    'zone.notes.placeholder': 'Algemene notities (optioneel)',
    'zone.add.submit': 'Toevoegen',
    'zone.edit.title': 'Zone bewerken',
    'zone.edit.areaPlaceholder': 'Oppervlakte',
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
    'actions.delete': 'Verwijderen',
    'confirm.deleteSheep': 'Weet je zeker dat je dit schaap wilt verwijderen?',
    'confirm.deleteZone': 'Weet je zeker dat je deze zone wilt verwijderen?',
    'confirm.deletePaddock': 'Weet je zeker dat je deze weide wilt verwijderen?',
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
    'history.zone.updated': 'Zone {location} bijgewerkt: {details}',
    'history.zone.deleted': 'Zone {paddock} / {name} verwijderd',
    'history.zoneMove.auto': 'Zone {paddock} / {name} verwijderd en schapen automatisch verplaatst naar {target}: {sheep}',
    'history.zoneMove.manual': 'Zone {paddock} / {name} verwijderd en schapen verplaatst naar {target}: {sheep}',
    'history.sheep.moved': '{sheep} verplaatst van {from} naar {to}',
    'history.import.duplicates': '{count} duplicaat oorkenmerk(en) verwijderd bij import',
    'history.import.success': 'Gegevens geïmporteerd uit bestand',
    'history.clear': 'Alle gegevens gewist',
    'history.details.name': 'naam {from} -> {name}',
    'history.details.postcode': 'postcode {from} -> {postcode}',
    'history.details.notesUpdated': 'notities bijgewerkt',
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
    'paddock.namePlaceholder': 'Naam weide',
    'paddock.postcodePlaceholder': 'Postcode (optioneel)',
    'zone.namePlaceholder': 'Zone naam'
  },
  en: {
    'app.title': 'FlockOps',
      'app.subtitle': 'A CALM-Hoeve Project',
    'ui.save': 'Save',
    'ui.upload': 'Upload',
    'ui.clear': 'Clear',
    'ui.language': 'Language',
    'tab.paddocksZones': 'Paddocks and zones',
    'tab.sheep': 'Sheep',
    'tab.history': 'History',
    'tab.billing': 'Billing',
    'section.paddocks': 'Paddocks',
    'section.sheep': 'Sheep',
    'section.history': 'History',
    'section.billing': 'Billing',
    'billing.fields': 'Fields',
    'billing.zones': 'Zones',
    'billing.sheep': 'Sheep',
    'billing.rateMonthly': '{price} / month',
    'billing.unlimited': 'Unlimited',
    'billing.included': 'Included',
    'billing.total': 'Monthly total',
    'billing.paypal.title': 'PayPal subscriptions',
    'billing.paypal.description': 'Integrate recurring payments with PayPal for monthly billing.',
    'billing.paypal.unconfigured': 'Add a PayPal client ID and plan ID first to enable recurring payments.',
    'billing.paypal.ready': 'PayPal recurring payments is ready to use.',
    'billing.paypal.approved': 'PayPal subscription approved. The recurring payment has started.',
    'billing.paypal.error': 'PayPal could not be loaded. Check the configuration and try again.',
    'sheep.add.title': 'Add sheep',
    'sheep.add.tagPlaceholder': 'Tag',
    'sheep.add.earmarkPlaceholder': 'Earmark (optional)',
    'sheep.birthDateLabel': 'Birth date',
    'sheep.genderLabel': 'Sex',
    'sheep.gender.female': 'Ewe',
    'sheep.gender.male': 'Ram',
    'sheep.pedigreeLabel': 'Pedigree',
    'sheep.locationLabel': 'Location',
    'sheep.notes.label': 'Notes',
    'sheep.notes.placeholder': 'General notes (optional)',
    'sheep.add.submit': 'Add',
    'sheep.edit.title': 'Edit sheep',
    'sheep.edit.tagPlaceholder': 'New name',
    'sheep.edit.earmarkLabel': 'Earmark',
    'sheep.edit.earmarkPlaceholder': 'Add earmark',
    'sheep.edit.submit': 'Save',
    'injection.title': 'Register injection',
    'injection.paddockLabel': 'Paddock',
    'injection.dateLabel': 'Date',
    'injection.productLabel': 'Product',
    'injection.productPlaceholder': 'Product name',
    'injection.repeatLabel': 'Repeat by',
    'injection.noRepeatLabel': 'Do not repeat',
    'injection.sheepListLabel': 'Sheep',
    'injection.submit': 'Save',
    'injection.sheepTitle': 'Register injection',
    'injection.sheepLabel': 'Sheep',
    'shearing.title': 'Register shearing',
    'shearing.paddockLabel': 'Paddock',
    'shearing.dateLabel': 'Date',
    'shearing.sheepListLabel': 'Sheep',
    'shearing.submit': 'Confirm',
    'shearing.sheepTitle': 'Register shearing',
    'shearing.sheepLabel': 'Sheep',
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
    'history.injection.applied': 'Injection registered in {paddock}: {product} ({date}, repeat by {repeatDate}) for {count} sheep',
    'history.injection.appliedNoRepeat': 'Injection registered in {paddock}: {product} ({date}, do not repeat) for {count} sheep',
    'history.shearing.applied': 'Shearing registered in {paddock} on {date} for {count} sheep',
    'history.injection.sheep': 'Injection registered for {sheep}: {product} ({date}, repeat by {repeatDate})',
    'history.injection.sheepNoRepeat': 'Injection registered for {sheep}: {product} ({date}, do not repeat)',
    'history.shearing.sheep': 'Shearing registered for {sheep} on {date}',
    'labels.age': 'Age: {age}',
    'labels.ageYearsMonths': '{years} y {months} m',
    'labels.birthDate': 'Birth date: {date}',
    'labels.lastShearing': 'Last shearing: {value}',
    'labels.lastInjection': 'Last injection: {value}',
    'labels.nextInjection': 'Next injection: {value}',
    'labels.notAvailable': 'not recorded',
    'labels.lastUpdated': 'Last updated: {date} ({days} days ago)',
    'actions.move': 'Move',
    'aria.editSheepName': 'Edit name for {tag}',
    'aria.setSheepBirthDate': 'Set birth date for {tag}',
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
    'aria.registerInjection': 'Register injection for {paddock}',
    'aria.registerShearing': 'Register shearing for {paddock}',
    'aria.registerSheepInjection': 'Register injection for {tag}',
    'aria.registerSheepShearing': 'Register shearing for {tag}',
    'aria.moveSheep': 'Move {tag}',
    'aria.weatherForecast': 'Weather forecast',
    'paddock.add.title': 'Add paddock',
    'paddock.nameLabel': 'Paddock name',
    'paddock.postcodeLabel': 'Postcode (optional)',
    'paddock.notes.label': 'Notes',
    'paddock.notes.placeholder': 'General notes (optional)',
    'paddock.add.submit': 'Add',
    'paddock.edit.title': 'Edit paddock',
    'paddock.edit.submit': 'Save',
    'paddock.empty': 'No paddocks',
    'paddock.sheep.singular': 'sheep',
    'paddock.sheep.plural': 'sheep',
    'paddock.zones.badge': '{count} zone(s)',
    'zone.add.title': 'Add zone',
    'zone.paddockLabel': 'Paddock',
    'zone.nameLabel': 'Zone name',
    'zone.areaLabel': 'Area (m2)',
    'zone.areaPlaceholderWithUnit': 'Area (m2)',
    'zone.perimeterLabel': 'Perimeter (m)',
    'zone.add.perimeterPlaceholder': 'Perimeter (m)',
    'zone.notes.label': 'Notes',
    'zone.notes.placeholder': 'General notes (optional)',
    'zone.add.submit': 'Add',
    'zone.edit.title': 'Edit zone',
    'zone.edit.areaPlaceholder': 'Area',
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
    'actions.delete': 'Delete',
    'confirm.deleteSheep': 'Are you sure you want to delete this sheep?',
    'confirm.deleteZone': 'Are you sure you want to delete this zone?',
    'confirm.deletePaddock': 'Are you sure you want to delete this paddock?',
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
    'history.zone.updated': 'Zone {location} updated: {details}',
    'history.zone.deleted': 'Zone {paddock} / {name} deleted',
    'history.zoneMove.auto': 'Zone {paddock} / {name} deleted and sheep auto-moved to {target}: {sheep}',
    'history.zoneMove.manual': 'Zone {paddock} / {name} deleted and sheep moved to {target}: {sheep}',
    'history.sheep.moved': '{sheep} moved from {from} to {to}',
    'history.import.duplicates': '{count} duplicate earmark(s) removed during import',
    'history.import.success': 'Data imported from file',
    'history.clear': 'All data deleted',
    'history.details.name': 'name {from} -> {name}',
    'history.details.postcode': 'postcode {from} -> {postcode}',
    'history.details.notesUpdated': 'notes updated',
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
    'paddock.namePlaceholder': 'Paddock name',
    'paddock.postcodePlaceholder': 'Postcode (optional)',
    'zone.namePlaceholder': 'Zone name'
  }
}

const translationsFr = {
  ...translations.en,
  'app.title': 'FlockOps',
  'app.subtitle': 'Un projet CALM-Hoeve',
  'ui.save': 'Enregistrer',
  'ui.upload': 'Importer',
  'ui.clear': 'Effacer',
  'ui.language': 'Langue',
  'ui.add': 'Ajouter',
  'tab.paddocksZones': 'Pâturages et zones',
  'tab.sheep': 'Moutons',
  'tab.history': 'Historique',
  'tab.billing': 'Facturation',
  'section.billing': 'Facturation',
  'billing.fields': 'Pâturages',
  'billing.zones': 'Zones',
  'billing.sheep': 'Moutons',
  'billing.rateMonthly': '{price} / mois',
  'billing.unlimited': 'Illimité',
  'billing.included': 'Inclus',
  'billing.total': 'Total mensuel',
  'billing.paypal.title': 'Abonnements PayPal',
  'billing.paypal.description': 'Intégrez des paiements récurrents via PayPal pour la facturation mensuelle.',
  'billing.paypal.unconfigured': 'Ajoutez d\'abord un client ID PayPal et un plan ID pour activer les paiements récurrents.',
  'billing.paypal.ready': 'Les paiements récurrents PayPal sont prêts à être utilisés.',
  'billing.paypal.approved': 'Abonnement PayPal approuvé. Le paiement récurrent a démarré.',
  'billing.paypal.error': 'PayPal n\'a pas pu être chargé. Vérifiez la configuration et réessayez.',
  'section.paddocks': 'Pâturages',
  'section.sheep': 'Moutons',
  'section.history': 'Historique',
  'sheep.add.title': 'Ajouter un mouton',
  'sheep.add.earmarkPlaceholder': 'Marque auriculaire (optionnel)',
  'sheep.birthDateLabel': 'Date de naissance',
  'sheep.genderLabel': 'Sexe',
  'sheep.gender.female': 'Brebis',
  'sheep.gender.male': 'Bélier',
  'sheep.pedigreeLabel': 'Pedigree',
  'sheep.locationLabel': 'Emplacement',
  'sheep.notes.label': 'Notes',
  'sheep.notes.placeholder': 'Notes generales (optionnel)',
  'sheep.add.submit': 'Ajouter',
  'sheep.edit.title': 'Modifier le mouton',
  'sheep.edit.tagPlaceholder': 'Nouveau nom',
  'sheep.edit.earmarkLabel': 'Marque auriculaire',
  'sheep.edit.earmarkPlaceholder': 'Ajouter une marque auriculaire',
  'sheep.edit.submit': 'Enregistrer',
  'injection.title': 'Enregistrer une injection',
  'injection.paddockLabel': 'Pâturage',
  'injection.dateLabel': 'Date',
  'injection.productLabel': 'Produit',
  'injection.productPlaceholder': 'Nom du produit',
  'injection.repeatLabel': 'Répéter avant',
  'injection.noRepeatLabel': 'Ne pas répéter',
  'injection.sheepListLabel': 'Moutons',
  'injection.submit': 'Enregistrer',
  'injection.sheepTitle': 'Enregistrer une injection',
  'injection.sheepLabel': 'Mouton',
  'shearing.title': 'Enregistrer la tonte',
  'shearing.paddockLabel': 'Pâturage',
  'shearing.dateLabel': 'Date',
  'shearing.sheepListLabel': 'Moutons',
  'shearing.submit': 'Confirmer',
  'shearing.sheepTitle': 'Enregistrer la tonte',
  'shearing.sheepLabel': 'Mouton',
  'sheep.location.unknownPaddock': 'Pâturage inconnu',
  'sheep.location.unknownZone': 'Zone inconnue',
  'sheep.location.none': 'Aucune zone',
  'sheep.empty': 'Aucun mouton',
  'select.paddock.first': 'Choisissez d\'abord un pâturage',
  'select.paddock.choose': 'Choisir un pâturage',
  'select.zone.choose': 'Choisir une zone',
  'select.zone.noneAvailable': 'Aucune zone disponible',
  'select.parent.mother': 'Mère (optionnel, brebis uniquement)',
  'select.parent.father': 'Père (optionnel, béliers uniquement)',
  'history.sheep.added': '{tag} ajouté à {location}',
  'history.sheep.updated': 'Mouton modifié : {details}',
  'history.sheep.deleted': '{tag} retiré de {location}',
  'history.details.name': 'nom {from} -> {to}',
  'history.details.earmarkAdded': 'marque auriculaire ajoutée : {earmark}',
  'entity.sheep': 'mouton',
  'errors.earmark.duplicate': 'Cette marque auriculaire est déjà attribuée à un autre mouton.',
  'history.injection.applied': 'Injection enregistrée dans {paddock} : {product} ({date}, répéter avant {repeatDate}) pour {count} moutons',
  'history.injection.appliedNoRepeat': 'Injection enregistrée dans {paddock} : {product} ({date}, ne pas répéter) pour {count} moutons',
  'history.shearing.applied': 'Tonte enregistrée dans {paddock} le {date} pour {count} moutons',
  'history.injection.sheep': 'Injection enregistrée pour {sheep} : {product} ({date}, répéter avant {repeatDate})',
  'history.injection.sheepNoRepeat': 'Injection enregistrée pour {sheep} : {product} ({date}, ne pas répéter)',
  'history.shearing.sheep': 'Tonte enregistrée pour {sheep} le {date}',
  'labels.age': 'Âge : {age}',
  'labels.ageYearsMonths': '{years} a {months} m',
  'labels.birthDate': 'Date de naissance : {date}',
  'labels.lastShearing': 'Dernière tonte : {value}',
  'labels.lastInjection': 'Dernière injection : {value}',
  'labels.nextInjection': 'Prochaine injection : {value}',
  'labels.notAvailable': 'non enregistre',
  'labels.lastUpdated': 'Dernière mise à jour : {date} (il y a {days} jours)',
  'actions.move': 'Déplacer',
  'aria.editSheepName': 'Modifier le nom de {tag}',
  'aria.setSheepBirthDate': 'Définir la date de naissance pour {tag}',
  'aria.deleteSheep': 'Supprimer le mouton',
  'aria.addSheep': 'Ajouter un mouton',
  'aria.addPaddock': 'Ajouter un pâturage',
  'aria.editPaddock': 'Modifier le pâturage',
  'aria.deletePaddock': 'Supprimer le pâturage',
  'aria.collapsePaddock': 'Réduire le pâturage',
  'aria.expandPaddock': 'Développer le pâturage',
  'aria.addZone': 'Ajouter une zone',
  'aria.editZone': 'Modifier la zone',
  'aria.deleteZone': 'Supprimer la zone',
  'aria.registerInjection': 'Enregistrer une injection pour {paddock}',
  'aria.registerShearing': 'Enregistrer la tonte pour {paddock}',
  'aria.registerSheepInjection': 'Enregistrer une injection pour {tag}',
  'aria.registerSheepShearing': 'Enregistrer la tonte pour {tag}',
  'aria.moveSheep': 'Déplacer {tag}',
  'aria.weatherForecast': 'Prévisions météo',
  'paddock.add.title': 'Ajouter un pâturage',
  'paddock.nameLabel': 'Nom du pâturage',
  'paddock.postcodeLabel': 'Code postal (optionnel)',
  'paddock.add.submit': 'Ajouter',
  'paddock.edit.title': 'Modifier le pâturage',
  'paddock.edit.submit': 'Enregistrer',
  'paddock.empty': 'Aucun pâturage',
  'paddock.sheep.singular': 'mouton',
  'paddock.sheep.plural': 'moutons',
  'paddock.zones.badge': '{count} zone(s)',
  'zone.add.title': 'Ajouter une zone',
  'zone.paddockLabel': 'Pâturage',
  'zone.nameLabel': 'Nom de la zone',
  'zone.areaLabel': 'Surface (m2)',
  'zone.areaPlaceholderWithUnit': 'Surface (m2)',
  'zone.perimeterLabel': 'Périmètre (m)',
  'zone.add.perimeterPlaceholder': 'Périmètre (m)',
  'zone.add.submit': 'Ajouter',
  'zone.edit.title': 'Modifier la zone',
  'zone.edit.areaPlaceholder': 'Surface',
  'zone.edit.perimeterPlaceholder': 'Périmètre',
  'zone.edit.submit': 'Enregistrer',
  'zone.status.occupied': 'Occupée',
  'zone.status.empty': 'Vide depuis {days} jours',
  'zone.sheep.empty': 'Aucun mouton',
  'zone.bulkMove': 'Déplacer tous les animaux',
  'move.title': 'Déplacer un mouton',
  'move.paddockLabel': 'Pâturage',
  'move.zoneLabel': 'Zone',
  'move.submit': 'Déplacer',
  'move.bulkTitle': 'Déplacer tous les animaux',
  'move.bulkSourceLabel': 'Zone source',
  'move.bulkCountLabel': 'Nombre de moutons',
  'move.bulkTargetPaddockLabel': 'Pâturage cible',
  'move.bulkTargetZoneLabel': 'Zone cible',
  'move.bulkSubmit': 'Déplacer tous les animaux',
  'move.deleteZoneTitle': 'Supprimer la zone et déplacer les moutons',
  'move.deleteZoneSourceLabel': 'Zone à supprimer',
  'move.deleteZoneTargetLabel': 'Zone cible',
  'move.deleteZoneSubmit': 'Déplacer et supprimer',
  'move.deletePaddockTitle': 'Supprimer le pâturage et déplacer les moutons',
  'move.deletePaddockSourceLabel': 'Pâturage à supprimer',
  'move.deletePaddockTargetLabel': 'Zone cible',
  'move.deletePaddockSubmit': 'Déplacer et supprimer',
  'actions.delete': 'Supprimer',
  'confirm.deleteSheep': 'Voulez-vous vraiment supprimer ce mouton ?',
  'confirm.deleteZone': 'Voulez-vous vraiment supprimer cette zone ?',
  'confirm.deletePaddock': 'Voulez-vous vraiment supprimer ce pâturage ?',
  'weather.sunny': 'Ensoleillé',
  'weather.partlyCloudy': 'Partiellement nuageux',
  'weather.cloudy': 'Nuageux',
  'weather.fog': 'Brouillard',
  'weather.rain': 'Pluie',
  'weather.snow': 'Neige',
  'weather.thunderstorm': 'Orage',
  'weather.variable': 'Variable',
  'weather.loading': 'Chargement des prévisions sur 3 jours...',
  'weather.noPostcode': 'Aucun code postal pour les prévisions',
  'weather.noForecast': 'Aucune prévision disponible pour le code postal {postcode}',
  'weather.rainPercentage': '{rain}% pluie',
  'history.empty': 'Aucune modification enregistrée pour le moment.',
  'history.paddock.added': 'Pâturage {name} ajouté',
  'history.paddock.updated': 'Pâturage modifié : {details}',
  'history.paddock.deleted': 'Pâturage {name} supprimé',
  'history.paddockMove.auto': 'Pâturage {name} supprimé et moutons déplacés automatiquement vers {target} : {sheep}',
  'history.paddockMove.manual': 'Pâturage {name} supprimé et moutons déplacés vers {target} : {sheep}',
  'history.zone.added': 'Zone {name} ajoutée dans le pâturage {paddock}',
  'history.zone.updated': 'Zone {location} modifiée : {details}',
  'history.zone.deleted': 'Zone {paddock} / {name} supprimée',
  'history.zoneMove.auto': 'Zone {paddock} / {name} supprimée et moutons déplacés automatiquement vers {target} : {sheep}',
  'history.zoneMove.manual': 'Zone {paddock} / {name} supprimée et moutons déplacés vers {target} : {sheep}',
  'history.sheep.moved': '{sheep} déplacé de {from} vers {to}',
  'history.import.duplicates': '{count} marque(s) auriculaire(s) en doublon supprimée(s) pendant l\'import',
  'history.import.success': 'Données importées depuis le fichier',
  'history.clear': 'Toutes les données ont été supprimées',
  'history.details.postcode': 'code postal {from} -> {postcode}',
  'history.details.notesUpdated': 'notes mises a jour',
  'history.details.area': 'surface {from} -> {area}',
  'history.details.perimeter': 'périmètre {from} -> {perimeter}',
  'alert.earmarkDuplicate': 'Cette marque auriculaire est déjà attribuée à un autre mouton.',
  'alert.stalPaddockDelete': 'Le pâturage Stal ne peut pas être supprimé.',
  'alert.stalZoneDelete': 'La zone Stal ne peut pas être supprimée.',
  'alert.zoneMinimum': 'Un pâturage doit conserver au moins 1 zone.',
  'alert.noTargetZoneInPaddock': 'Aucune zone cible disponible dans ce pâturage.',
  'alert.noTargetZone': 'Aucune zone cible disponible. Ajoutez d\'abord une zone supplémentaire ou un pâturage avec zone.',
  'alert.noSheepInZone': 'Aucun mouton dans cette zone à déplacer.',
  'alert.noTargetPaddock': 'Ce pâturage contient des moutons. Il faut d\'abord un autre pâturage avec au moins 1 zone pour déplacer les moutons.',
  'alert.postcodeNotFound': 'Code postal introuvable',
  'alert.postcodeFormatUnknown': 'Format de code postal inconnu',
  'alert.forecastDataMissing': 'Aucune donnée de prévision',
  'alert.importError': 'Impossible de charger le fichier : {error}',
  'alert.importSuccess': 'Données chargées avec succès.',
  'confirm.clearAll': 'Voulez-vous vraiment supprimer toutes les données ? Cette action est irréversible.',
  'unknown': 'Inconnu',
  'fieldZone': 'Pâturage / Zone',
  'paddock.namePlaceholder': 'Nom du pâturage',
  'paddock.postcodePlaceholder': 'Code postal (optionnel)',
  'paddock.notes.label': 'Notes',
  'paddock.notes.placeholder': 'Notes generales (optionnel)',
  'zone.namePlaceholder': 'Nom de la zone',
  'zone.notes.label': 'Notes',
  'zone.notes.placeholder': 'Notes generales (optionnel)'
}

translations.fr = translationsFr

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
  applyStaticTranslations()
  render()
}

function recycleBinIcon(){
  return '<svg class="button-icon button-icon--delete" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M9 3a1 1 0 0 0-1 1v1H4.75a.75.75 0 0 0 0 1.5h.84l.82 10.31A2.25 2.25 0 0 0 8.64 19.5h6.72a2.25 2.25 0 0 0 2.23-1.69l.82-10.31h.84a.75.75 0 0 0 0-1.5H16V4a1 1 0 0 0-1-1H9zm1 2h4v0.5h-4V5zm-1.83 3.5a.75.75 0 0 1 .75.75v6.5a.75.75 0 0 1-1.5 0v-6.5a.75.75 0 0 1 .75-.75zm3.33 0a.75.75 0 0 1 .75.75v6.5a.75.75 0 0 1-1.5 0v-6.5a.75.75 0 0 1 .75-.75zm3.33 0a.75.75 0 0 1 .75.75v6.5a.75.75 0 0 1-1.5 0v-6.5a.75.75 0 0 1 .75-.75z"/></svg>'
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
    const sheep = state.sheep.find(s => s.id === sheepId)
    state.sheep = state.sheep.filter(s => s.id !== sheepId)
    state.sheep.forEach(s => {
      if(s.motherId === sheepId) s.motherId = null
      if(s.fatherId === sheepId) s.fatherId = null
    })
    if(sheep){
      addHistory(t('entity.sheep'), t('history.sheep.deleted', { tag: sheep.tag, location: `${paddockName(sheep.paddockId)}${sheep.zoneId ? ' / ' + zoneName(sheep.paddockId, sheep.zoneId) : ''}` }))
    }
    save(); render()
    return
  }

  if(kind === 'zone'){
    const paddockId = details.paddockId
    const zoneId = details.zoneId
    const paddock = getPaddock(paddockId)
    const zone = getZone(paddockId, zoneId)
    if(!paddock || !zone) return
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

  if(kind === 'paddock'){
    const paddockId = details.paddockId
    const paddock = getPaddock(paddockId)
    if(!paddock) return
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
  }
}

function applyStaticTranslations(){
  document.documentElement.lang = currentLang
  const setText = (id, value) => {
    const el = document.getElementById(id)
    if(el) el.textContent = value
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
  setText('tab-paddocks-btn', t('tab.paddocksZones'))
  setText('tab-sheep-btn', t('tab.sheep'))
  setText('tab-history-btn', t('tab.history'))
  setText('tab-billing-btn', t('tab.billing'))
  setText('section-paddocks-title', t('section.paddocks'))
  setText('section-sheep-title', t('section.sheep'))
  setText('section-history-title', t('section.history'))
  setText('section-billing-title', t('section.billing'))

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
    zones: [{ id: zoneId, name: 'Stal', area: null, perimeter: null, emptySince: Date.now() }]
  })
}

function collapseAllPaddocks(){
  collapsedPaddockIds.clear()
  state.paddocks.forEach(paddock => collapsedPaddockIds.add(paddock.id))
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
        notes: typeof z.notes === 'string' ? z.notes.trim() : '',
        emptySince: z.emptySince ?? Date.now()
      })) : []
    })) : []
    state.sheep = Array.isArray(saved.sheep) ? saved.sheep.map(s => ({
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
  collapseAllPaddocks()
  dedupeEarmarks()
  updateZoneEmptyStates()
}

function save(){
  updateZoneEmptyStates()
  localStorage.setItem(KEY, JSON.stringify(state))
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
  return valid.reduce((latest, item) => (item.date > latest.date ? item : latest))
}

function latestInjectionRecord(sheep){
  if(!Array.isArray(sheep.injections)) return null
  const valid = sheep.injections.filter(i => typeof i.date === 'string' && i.date)
  if(!valid.length) return null
  return valid.reduce((latest, item) => (item.date > latest.date ? item : latest))
}

function nextInjectionRecord(sheep){
  if(!Array.isArray(sheep.injections)) return null
  const today = todayIso()
  const valid = sheep.injections.filter(i => typeof i.repeatDate === 'string' && i.repeatDate && i.repeatDate >= today)
  if(!valid.length) return null
  return valid.reduce((next, item) => (item.repeatDate < next.repeatDate ? item : next))
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
  link.download = `flockops-${new Date().toISOString().slice(0,10)}.json`
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
          notes: typeof z.notes === 'string' ? z.notes.trim() : '',
          emptySince: z.emptySince ?? Date.now()
        })) : []
      })) : []
      state.sheep = Array.isArray(parsed.sheep) ? parsed.sheep.map(s => ({
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
      collapseAllPaddocks()
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
  const billingSummary = document.getElementById('billing-summary')
  const sheepPaddockModal = document.getElementById('sheep-paddock-modal')
  const sheepZoneModal = document.getElementById('sheep-zone-modal')
  const movePaddockModal = document.getElementById('move-paddock-modal')
  const moveZoneModal = document.getElementById('move-zone-modal')

  const euroLocale = currentLang === 'fr' ? 'fr-BE' : currentLang === 'en' ? 'en-IE' : 'nl-BE'
  const formatEuro = (value) => new Intl.NumberFormat(euroLocale, { style: 'currency', currency: 'EUR', minimumFractionDigits: value % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 }).format(value)
  const paddockCount = state.paddocks.length
  const zoneCount = state.paddocks.reduce((sum, paddock) => sum + paddock.zones.length, 0)
  const sheepCount = state.sheep.length
  const billingLines = [
    { label: t('billing.fields'), countLabel: `${t('billing.unlimited')} ${t('billing.fields').toLowerCase()}`, rate: 0, total: 0, included: true },
    { label: t('billing.zones'), countLabel: `${zoneCount}`, rate: 0.3, total: zoneCount * 0.3, included: false },
    { label: t('billing.sheep'), countLabel: `${sheepCount}`, rate: 0.5, total: sheepCount * 0.5, included: false }
  ]
  const billingTotal = billingLines.reduce((sum, line) => sum + line.total, 0)

  paddockList.innerHTML = state.paddocks.length === 0 ? `<div class="empty">${t('paddock.empty')}</div>` : state.paddocks.map(p => renderPaddock(p)).join('') + `
    <button type="button" class="add-paddock-block" aria-label="${t('aria.addPaddock')}">+</button>
  `

  sheepList.innerHTML = state.sheep.map(s => {
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
      ? `${formatBirthDate(nextInjection.repeatDate)} ♻ (${nextInjection.product || t('unknown')})`
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
            : `<input type="date" class="sheep-birthdate-input" data-id="${s.id}" aria-label="${t('aria.setSheepBirthDate', { tag: s.tag })}">`}
          <small>${paddockName(s.paddockId)}${s.zoneId ? ' / ' + zoneName(s.paddockId, s.zoneId) : ''}</small>
          <small>✂️ ${lastShearingValue}</small>
          <small>💉 ${lastInjectionValue}</small>
          <small>💉 ${nextInjectionValue}</small>
        </div>
        <div class="sheep-actions">
          <button type="button" class="sheep-injection-button" data-id="${s.id}" aria-label="${t('aria.registerSheepInjection', { tag: s.tag })}" title="${t('aria.registerSheepInjection', { tag: s.tag })}">💉</button>
          <button type="button" class="sheep-shearing-button" data-id="${s.id}" aria-label="${t('aria.registerSheepShearing', { tag: s.tag })}" title="${t('aria.registerSheepShearing', { tag: s.tag })}">✂️</button>
          <button type="button" class="move-button" data-id="${s.id}" aria-label="${t('actions.move')}" title="${t('actions.move')}">${doubleArrowIcon()}</button>
          <button type="button" class="sheep-delete-button" data-id="${s.id}" aria-label="${t('aria.deleteSheep')}">${recycleBinIcon()}</button>
        </div>
      </div>
    `
  }).join('') + `
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
  const paddockPostcode = (p.postcode || '').trim()
  const paddockCountry = paddockPostcode ? detectPostcodeCountry(paddockPostcode) : null
  const paddockFlagCode = paddockCountry ? paddockCountry.toLowerCase() : ''
  const paddockFlagHtml = paddockFlagCode
    ? `<img class="paddock-flag" src="flags/${paddockFlagCode}.png" alt="${paddockCountry} flag">`
    : ''
  const paddockTotalArea = p.zones.reduce((sum, zone) => sum + (Number.isFinite(zone.area) ? zone.area : 0), 0)
  const paddockSheepCount = state.sheep.filter(s => s.paddockId === p.id && p.zones.some(z => z.id === s.zoneId)).length
  const areaLabel = `${new Intl.NumberFormat(localeTag(), { maximumFractionDigits: 2 }).format(paddockTotalArea)} m2`
  const sheepLabel = `${paddockSheepCount} ${paddockSheepCount === 1 ? t('paddock.sheep.singular') : t('paddock.sheep.plural')}`
  const injectionButtonHtml = paddockSheepCount > 0
    ? `<button type="button" class="paddock-injection-button" data-paddock-id="${p.id}" aria-label="${t('aria.registerInjection', { paddock: p.name })}" title="${t('aria.registerInjection', { paddock: p.name })}">💉</button>`
    : ''
  const shearingButtonHtml = paddockSheepCount > 0
    ? `<button type="button" class="paddock-shearing-button" data-paddock-id="${p.id}" aria-label="${t('aria.registerShearing', { paddock: p.name })}" title="${t('aria.registerShearing', { paddock: p.name })}">✂️</button>`
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
        const sheepInZone = state.sheep.filter(s => s.paddockId === p.id && s.zoneId === z.id)
        const sheepCount = sheepInZone.length
        const zoneArea = z.area !== null ? `${z.area} m2` : ''
        const zonePerimeter = z.perimeter !== null ? `${z.perimeter} m` : ''
        const bulkMoveButton = sheepCount > 1 ? `<button type="button" class="zone-bulk-move-button" data-paddock-id="${p.id}" data-zone-id="${z.id}" aria-label="${t('zone.bulkMove')}" title="${t('zone.bulkMove')}">${doubleArrowIcon()}</button>` : ''
        const sheepList = sheepCount
          ? `<div class="zone-sheep-list${sheepCount > 4 ? ' is-scrollable' : ''}">${sheepInZone.map(s => `<button type="button" class="zone-sheep-link" data-sheep-id="${s.id}" aria-label="${t('aria.moveSheep', { tag: s.tag })}">${sheepIcon()}${s.tag}</button>`).join('')}</div>${bulkMoveButton}`
          : t('zone.sheep.empty')
        const stallZone = isStalZone(p, z)
        const useStallBackground = isStalPaddock(p)
        const canDeleteZone = !stallZone && p.zones.length > 1
        return `<div class="zone-item${useStallBackground ? ' stall-zone-item' : ''}" data-paddock-id="${p.id}" data-zone-id="${z.id}">${canDeleteZone ? `<button type="button" class="zone-delete-button" data-paddock-id="${p.id}" data-zone-id="${z.id}" aria-label="${t('aria.deleteZone')}">${recycleBinIcon()}</button>` : ''}<div class="zone-header"><div class="zone-title-row"><button type="button" class="zone-edit-button" data-paddock-id="${p.id}" data-zone-id="${z.id}" aria-label="${t('aria.editZone')}">✎</button><strong>${z.name}</strong></div><div class="zone-metrics">${zoneArea ? `<span class="zone-metric">${zoneArea}</span>` : ''}${zonePerimeter ? `<span class="zone-metric">${zonePerimeter}</span>` : ''}<span class="zone-metric">${sheepCount}</span></div></div><div class="zone-bottom">${sheepList}</div></div>`
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

function openPaddockInjectionModal(paddockId){
  const paddock = getPaddock(paddockId)
  if(!paddock) return
  pendingInjectionPaddockId = paddockId

  const paddockNameEl = document.getElementById('paddock-injection-paddock-name')
  const dateInput = document.getElementById('paddock-injection-date')
  const productInput = document.getElementById('paddock-injection-product')
  const repeatDateInput = document.getElementById('paddock-injection-repeat-date')
  const noRepeatInput = document.getElementById('paddock-injection-no-repeat')

  if(paddockNameEl) paddockNameEl.textContent = paddock.name
  if(dateInput) dateInput.value = todayIso()
  if(productInput) productInput.value = ''
  if(repeatDateInput) repeatDateInput.value = oneYearFromTodayIso()
  if(noRepeatInput) noRepeatInput.checked = false
  if(repeatDateInput){
    repeatDateInput.disabled = false
    repeatDateInput.required = true
  }
  renderPaddockSheepSelection('paddock-injection-sheep-list', 'paddock-injection-sheep', paddockId)

  openModal('paddock-injection-modal')
}

function closePaddockInjectionModal(){
  pendingInjectionPaddockId = null
  closeModal('paddock-injection-modal')
}

function openPaddockShearingModal(paddockId){
  const paddock = getPaddock(paddockId)
  if(!paddock) return
  pendingShearingPaddockId = paddockId

  const paddockNameEl = document.getElementById('paddock-shearing-paddock-name')
  const dateInput = document.getElementById('paddock-shearing-date')

  if(paddockNameEl) paddockNameEl.textContent = paddock.name
  if(dateInput) dateInput.value = todayIso()
  renderPaddockSheepSelection('paddock-shearing-sheep-list', 'paddock-shearing-sheep', paddockId)

  openModal('paddock-shearing-modal')
}

function closePaddockShearingModal(){
  pendingShearingPaddockId = null
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
  collapseAllPaddocks()
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

document.getElementById('delete-confirm-close')?.addEventListener('click', closeDeleteConfirmModal)
document.getElementById('delete-confirm-cancel')?.addEventListener('click', closeDeleteConfirmModal)
document.getElementById('delete-confirm-submit')?.addEventListener('click', executeDeleteConfirmed)
document.getElementById('delete-confirm-backdrop')?.addEventListener('click', closeDeleteConfirmModal)

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
  addHistory('schaap', t('history.sheep.moved', { sheep: sheep.tag, from: fromLabel, to: toLabel }))
  save(); render(); closeModal('move-modal')
})

document.getElementById('paddock-modal-form')?.addEventListener('submit', e => {
  e.preventDefault()
  const name = document.getElementById('paddock-modal-name').value.trim()
  const postcode = document.getElementById('paddock-modal-postcode').value.trim()
  if(!name) return
  const paddockId = uid()
  state.paddocks.push({id:paddockId, name, postcode, zones: []})
  collapsedPaddockIds.add(paddockId)
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

  const selectedSheepIds = Array.from(document.querySelectorAll('#paddock-injection-sheep-list input[name="paddock-injection-sheep"]:checked')).map(input => input.value)
  const sheepInPaddock = state.sheep.filter(s => s.paddockId === pendingInjectionPaddockId && selectedSheepIds.includes(s.id))
  if(!sheepInPaddock.length) return
  const injection = { id: uid(), date, product, repeatDate: noRepeat ? '' : repeatDate }

  sheepInPaddock.forEach(sheep => {
    if(!Array.isArray(sheep.injections)) sheep.injections = []
    sheep.injections.push({ ...injection, id: uid() })
    sheep.lastUpdated = Date.now()
  })

  if(noRepeat){
    addHistory('injectie', t('history.injection.appliedNoRepeat', {
      paddock: paddock.name,
      product,
      date: formatBirthDate(date),
      count: sheepInPaddock.length
    }))
  } else {
    addHistory('injectie', t('history.injection.applied', {
      paddock: paddock.name,
      product,
      date: formatBirthDate(date),
      repeatDate: formatBirthDate(repeatDate),
      count: sheepInPaddock.length
    }))
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
  const sheepInPaddock = state.sheep.filter(s => s.paddockId === pendingShearingPaddockId && selectedSheepIds.includes(s.id))
  if(!sheepInPaddock.length){
    return
  }

  sheepInPaddock.forEach(sheep => {
    if(!Array.isArray(sheep.shearings)) sheep.shearings = []
    sheep.shearings.push({ id: uid(), date: shearingDate })
    sheep.lastUpdated = Date.now()
  })

  addHistory('scheren', t('history.shearing.applied', {
    paddock: paddock.name,
    date: formatBirthDate(shearingDate),
    count: sheepInPaddock.length
  }))

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

  if(!Array.isArray(sheep.injections)) sheep.injections = []
  sheep.injections.push({
    id: uid(),
    date,
    product,
    repeatDate: noRepeat ? '' : repeatDate
  })
  sheep.lastUpdated = Date.now()

  if(noRepeat){
    addHistory('injectie', t('history.injection.sheepNoRepeat', {
      sheep: sheep.tag,
      product,
      date: formatBirthDate(date)
    }))
  } else {
    addHistory('injectie', t('history.injection.sheep', {
      sheep: sheep.tag,
      product,
      date: formatBirthDate(date),
      repeatDate: formatBirthDate(repeatDate)
    }))
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

  addHistory('scheren', t('history.shearing.sheep', {
    sheep: sheep.tag,
    date: formatBirthDate(shearingDate)
  }))

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
    const details = []
    if(beforeName !== zone.name) details.push(t('history.details.name', { from: beforeName, name: zone.name }))
    if(beforeArea !== zone.area) details.push(t('history.details.area', { from: beforeArea ?? '-', area: zone.area ?? '-' }))
    if(beforePerimeter !== zone.perimeter) details.push(t('history.details.perimeter', { from: beforePerimeter ?? '-', perimeter: zone.perimeter ?? '-' }))
    if(beforeNotes !== zone.notes) details.push(t('history.details.notesUpdated'))
    addHistory('zone', t('history.zone.updated', { location: `${paddock.name} / ${zone.name}`, details: details.join(', ') }))
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
  if(isEarmarkInUse(earmark)){
    alert(t('errors.earmark.duplicate'))
    return
  }
  if(motherId && !state.sheep.some(s => s.id === motherId && s.gender === 'female')) return
  if(fatherId && !state.sheep.some(s => s.id === fatherId && s.gender === 'male')) return
  state.sheep.push({id:uid(), tag, earmark: earmark || null, birthDate: birthDate || null, injections: [], shearings: [], gender, motherId, fatherId, paddockId, zoneId: zoneId || null, lastUpdated: Date.now()})
  addHistory(t('entity.sheep'), t('history.sheep.added', { tag, location: `${paddockName(paddockId)}${zoneId ? ' / ' + zoneName(paddockId, zoneId) : ''}` }))
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
    const sheep = state.sheep.find(s => s.id === sheepId)
    if(!sheep) return
    openDeleteConfirm('sheep', {
      sheepId,
      message: t('confirm.deleteSheep'),
      confirmLabel: t('actions.delete')
    })
    return
  }

  const addBlock = e.target.closest('#add-sheep-block')
  if(addBlock){
    openModal('sheep-modal')
  }
})

document.getElementById('sheep-list')?.addEventListener('change', e => {
  const birthDateInput = e.target.closest('.sheep-birthdate-input')
  if(!birthDateInput) return
  const sheepId = birthDateInput.dataset.id
  if(!sheepId) return
  const sheep = state.sheep.find(s => s.id === sheepId)
  if(!sheep) return
  sheep.birthDate = birthDateInput.value.trim() || null
  sheep.lastUpdated = Date.now()
  save(); render()
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

  const paddockShearingButton = e.target.closest('.paddock-shearing-button')
  if(paddockShearingButton){
    const paddockId = paddockShearingButton.dataset.paddockId
    if(!paddockId) return
    openPaddockShearingModal(paddockId)
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
  paddock.zones.push({id:uid(),name:zoneName,area,perimeter,notes,emptySince: Date.now()})
  addHistory('zone', t('history.zone.added', { name: zoneName, paddock: paddock.name }))
  document.getElementById('zone-modal-notes').value = ''
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
