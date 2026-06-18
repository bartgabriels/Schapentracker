const fs = require('fs')
const vm = require('vm')

const path = 'c:/Users/bartgabriels/OneDrive/Schapentracker/locales/translations.js'
const source = fs.readFileSync(path, 'utf8')

const sandbox = { window: {} }
vm.createContext(sandbox)
vm.runInContext(source, sandbox)
const existing = sandbox.window.FLOCKOPS_TRANSLATIONS
if (!existing || !existing.en || !existing.nl || !existing.fr) {
  throw new Error('Could not read existing window.FLOCKOPS_TRANSLATIONS')
}

const esc = (value) => String(value)
  .replace(/\\/g, '\\\\')
  .replace(/'/g, "\\'")
  .replace(/[\u007f-\uffff]/g, (ch) => {
    const code = ch.charCodeAt(0).toString(16).padStart(4, '0')
    return `\\u${code}`
  })

const keys = Object.keys(existing.en)
for (const lang of ['nl', 'fr']) {
  const other = Object.keys(existing[lang])
  if (other.length !== keys.length || other.some((k) => !Object.prototype.hasOwnProperty.call(existing.en, k))) {
    throw new Error(`Key mismatch detected for ${lang}`)
  }
}

const rows = keys.map((key) => {
  const en = existing.en[key]
  const nl = existing.nl[key]
  const fr = existing.fr[key]
  return `  '${esc(key)}': ['${esc(en)}', '${esc(nl)}', '${esc(fr)}'],`
}).join('\n')

const output = `// Language bundle extracted from app.js
const TERMS = {
  nl: {
    sheep: 'schaap',
    sheepPl: 'schapen',
    paddock: 'weide',
    paddocks: 'weides',
    zone: 'zone',
    zones: 'zones',
    flock: 'kudde',
    pedigree: 'stamboom',
    history: 'historiek',
    planning: 'planning',
    billing: 'facturatie',
    injection: 'injectie',
    shearing: 'scheren',
    earmark: 'oorkenmerk',
    postcode: 'postcode',
    area: 'oppervlakte',
    perimeter: 'omtrek',
    notes: 'notities',
    add: 'toevoegen',
    edit: 'bewerken',
    save: 'opslaan',
    delete: 'verwijderen',
    move: 'verplaatsen',
    register: 'registreren',
    optional: 'optioneel',
    occupied: 'bezet',
    empty: 'leeg',
    unknown: 'onbekend',
    available: 'beschikbaar',
  },
  en: {
    sheep: 'sheep',
    sheepPl: 'sheep',
    paddock: 'paddock',
    paddocks: 'paddocks',
    zone: 'zone',
    zones: 'zones',
    flock: 'flock',
    pedigree: 'pedigree',
    history: 'history',
    planning: 'planning',
    billing: 'billing',
    injection: 'injection',
    shearing: 'shearing',
    earmark: 'earmark',
    postcode: 'postcode',
    area: 'area',
    perimeter: 'perimeter',
    notes: 'notes',
    add: 'add',
    edit: 'edit',
    save: 'save',
    delete: 'delete',
    move: 'move',
    register: 'register',
    optional: 'optional',
    occupied: 'occupied',
    empty: 'empty',
    unknown: 'unknown',
    available: 'available',
  },
  fr: {
    sheep: 'mouton',
    sheepPl: 'moutons',
    paddock: 'paturage',
    paddocks: 'paturages',
    zone: 'zone',
    zones: 'zones',
    flock: 'troupeau',
    pedigree: 'pedigree',
    history: 'historique',
    planning: 'planning',
    billing: 'facturation',
    injection: 'injection',
    shearing: 'tonte',
    earmark: 'marque auriculaire',
    postcode: 'code postal',
    area: 'surface',
    perimeter: 'perimetre',
    notes: 'notes',
    add: 'ajouter',
    edit: 'modifier',
    save: 'enregistrer',
    delete: 'supprimer',
    move: 'deplacer',
    register: 'enregistrer',
    optional: 'optionnel',
    occupied: 'occupee',
    empty: 'vide',
    unknown: 'inconnu',
    available: 'disponible',
  },
}

const GRAMMAR = {
  en: {
    addNoun: (verb, noun) => \`${'${verb} ${noun}'}\`,
    editNoun: (verb, noun) => \`${'${verb} ${noun}'}\`,
    deleteNoun: (verb, noun) => \`${'${verb} ${noun}'}\`,
    actionNoun: (_key, noun) => noun,
    definiteNoun: (_key, noun) => noun,
    demonstrative: (_key) => 'this',
    confirmDelete: (v, dem, n) => \`Are you sure you want to ${'${v} ${dem} ${n}'}?\`,
    notesPlaceholder: (t) => \`General ${'${t.notes}'} (${'${t.optional}'})\`,
    selectFirst: (noun) => \`Choose a ${'${noun}'} first\`,
    selectChoose: (noun) => \`Choose ${'${noun}'}\`,
    selectChooseZone: (noun) => \`Choose ${'${noun}'}\`,
    noneAvailable: (noun) => \`No ${'${noun}'} available\`,
  },
  nl: {
    addNoun: (verb, noun) => \`${'${noun} ${verb}'}\`,
    editNoun: (verb, noun) => \`${'${noun} ${verb}'}\`,
    deleteNoun: (verb, noun) => \`${'${noun} ${verb}'}\`,
    actionNoun: (_key, noun) => noun,
    definiteNoun: (_key, noun) => noun,
    demonstrative: (key) => ({ sheep: 'dit', paddock: 'deze', zone: 'deze' }[key]),
    confirmDelete: (v, dem, n) => \`Weet je zeker dat je ${'${dem} ${n}'} wilt ${'${v}'}?\`,
    notesPlaceholder: (t) => \`Algemene ${'${t.notes}'} (${'${t.optional}'})\`,
    selectFirst: (noun) => \`Kies eerst een ${'${noun}'}\`,
    selectChoose: (noun) => \`Kies ${'${noun}'}\`,
    selectChooseZone: (noun) => \`Kies ${'${noun}'}\`,
    noneAvailable: (noun) => \`Geen ${'${noun}'} beschikbaar\`,
  },
  fr: {
    addNoun: (verb, noun) => \`${'${verb} ${noun}'}\`,
    editNoun: (verb, noun) => \`${'${verb} ${noun}'}\`,
    deleteNoun: (verb, noun) => \`${'${verb} ${noun}'}\`,
    actionNoun: (key, noun) => \`${'${{ sheep: \'un\', paddock: \'un\', zone: \'une\' }[key]} ${noun}'}\`,
    definiteNoun: (key, noun) => \`${'${{ sheep: \'le\', paddock: \'le\', zone: \'la\' }[key]} ${noun}'}\`,
    demonstrative: (key) => ({ sheep: 'ce', paddock: 'ce', zone: 'cette' }[key]),
    confirmDelete: (v, dem, n) => \`Voulez-vous vraiment ${'${v} ${dem} ${n}'} ?\`,
    notesPlaceholder: (t) => \`Notes g\u00e9n\u00e9rales (${'${t.optional}'})\`,
    selectFirst: (noun) => \`Choisissez d'abord un ${'${noun}'}\`,
    selectChoose: (noun) => \`Choisir un ${'${noun}'}\`,
    selectChooseZone: (noun) => \`Choisir une ${'${noun}'}\`,
    noneAvailable: (_noun) => \`Aucune zone disponible\`,
  },
}

function capitalize(value) {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}

const LANG_INDEX = { en: 0, nl: 1, fr: 2 }

const TRANSLATION_ROWS = {
${rows}
}

const DYNAMIC = {
  'ui.save': (t) => capitalize(t.save),
  'tab.sheep': (t) => capitalize(t.flock),
  'tab.history': (t) => capitalize(t.history),
  'tab.pedigree': (t) => capitalize(t.pedigree),
  'tab.billing': (t) => capitalize(t.billing),
  'sheep.notes.label': (t) => capitalize(t.notes),
  'sheep.notes.placeholder': (t, g) => g.notesPlaceholder(t),
  'select.paddock.first': (t, g) => g.selectFirst(t.paddock),
  'select.paddock.choose': (t, g) => g.selectChoose(t.paddock),
  'select.zone.choose': (t, g) => g.selectChooseZone(t.zone),
  'select.zone.noneAvailable': (t, g) => g.noneAvailable(t.zones),
  'entity.sheep': (t) => t.sheep,
  'actions.move': (t) => capitalize(t.move),
  'aria.deleteSheep': (t, g) => g.deleteNoun(capitalize(t.delete), g.definiteNoun('sheep', t.sheep)),
  'aria.addSheep': (t, g) => g.addNoun(capitalize(t.add), g.actionNoun('sheep', t.sheep)),
  'aria.addPaddock': (t, g) => g.addNoun(capitalize(t.add), g.actionNoun('paddock', t.paddock)),
  'aria.editPaddock': (t, g) => g.editNoun(capitalize(t.edit), g.definiteNoun('paddock', t.paddock)),
  'aria.deletePaddock': (t, g) => g.deleteNoun(capitalize(t.delete), g.definiteNoun('paddock', t.paddock)),
  'aria.addZone': (t, g) => g.addNoun(capitalize(t.add), g.actionNoun('zone', t.zone)),
  'aria.editZone': (t, g) => g.editNoun(capitalize(t.edit), g.definiteNoun('zone', t.zone)),
  'aria.deleteZone': (t, g) => g.deleteNoun(capitalize(t.delete), g.definiteNoun('zone', t.zone)),
  'paddock.notes.label': (t) => capitalize(t.notes),
  'paddock.notes.placeholder': (t, g) => g.notesPlaceholder(t),
  'paddock.sheep.singular': (t) => t.sheep,
  'paddock.sheep.plural': (t) => t.sheepPl,
  'zone.notes.label': (t) => capitalize(t.notes),
  'zone.notes.placeholder': (t, g) => g.notesPlaceholder(t),
  'actions.delete': (t) => capitalize(t.delete),
  'confirm.deleteSheep': (t, g) => g.confirmDelete(t.delete, g.demonstrative('sheep'), t.sheep),
  'confirm.deleteZone': (t, g) => g.confirmDelete(t.delete, g.demonstrative('zone'), t.zone),
  'confirm.deletePaddock': (t, g) => g.confirmDelete(t.delete, g.demonstrative('paddock'), t.paddock),
  'ui.add': (t) => capitalize(t.add),
}

function buildTranslations(lang, t) {
  const g = GRAMMAR[lang]
  const index = LANG_INDEX[lang]
  const result = {}

  for (const [key, row] of Object.entries(TRANSLATION_ROWS)) {
    result[key] = row[index]
  }

  for (const [key, compute] of Object.entries(DYNAMIC)) {
    result[key] = compute(t, g)
  }

  return result
}

window.FLOCKOPS_TRANSLATIONS = {
  en: buildTranslations('en', TERMS.en),
  nl: buildTranslations('nl', TERMS.nl),
  fr: buildTranslations('fr', TERMS.fr),
}
`

fs.writeFileSync(path, output, 'utf8')
console.log(JSON.stringify({ keys: keys.length, lines: output.split(/\r?\n/).length }))
