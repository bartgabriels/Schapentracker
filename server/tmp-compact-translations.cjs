const fs = require('fs')
const vm = require('vm')

const targetPath = process.argv[2]
if (!targetPath) {
  throw new Error('Usage: node tmp-compact-translations.cjs <path-to-translations.js>')
}

const source = fs.readFileSync(targetPath, 'utf8')
const withoutWindowExport = source.replace(/\nwindow\.FLOCKOPS_TRANSLATIONS\s*=\s*\{[\s\S]*$/m, '')
const wrapped = `(function(){${withoutWindowExport};return { TERMS, GRAMMAR };})()`
const { TERMS, GRAMMAR } = vm.runInNewContext(wrapped, {})

const literalKeys = Object.keys(GRAMMAR.en.literals)
const staticTable = {}
for (const key of literalKeys) {
  staticTable[key] = [GRAMMAR.en.literals[key], GRAMMAR.nl.literals[key], GRAMMAR.fr.literals[key]]
}

function q(value) {
  return `'${String(value)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')}'`
}

function renderTerms(terms) {
  const langs = ['nl', 'en', 'fr']
  const blocks = langs.map((lang) => {
    const entries = Object.entries(terms[lang]).map(([k, v]) => `    ${k}: ${q(v)},`)
    return `  ${lang}: {\n${entries.join('\n')}\n  },`
  })
  return `const TERMS = {\n${blocks.join('\n')}\n}`
}

function renderStatic(table) {
  const lines = Object.entries(table).map(([k, vals]) => `  ${q(k)}: [${q(vals[0])}, ${q(vals[1])}, ${q(vals[2])}],`)
  return `const STATIC = {\n${lines.join('\n')}\n}`
}

const output = `// Language bundle extracted from app.js
${renderTerms(TERMS)}

const GRAMMAR = {
  en: {
    addNoun: (verb, noun) => \`${'${verb} ${noun}'}\`,
    editNoun: (verb, noun) => \`${'${verb} ${noun}'}\`,
    deleteNoun: (verb, noun) => \`${'${verb} ${noun}'}\`,
    actionNoun: (_key, noun) => noun,
    definiteNoun: (_key, noun) => noun,
    demonstrative: (_key) => 'this',
    confirmDelete: (v, dem, n) => \`Are you sure you want to ${'${v}'} ${'${dem}'} ${'${n}'}?\`,
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
    confirmDelete: (v, dem, n) => \`Weet je zeker dat je ${'${dem}'} ${'${n}'} wilt ${'${v}'}?\`,
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
    actionNoun: (key, noun) => \`${"${{ sheep: 'un', paddock: 'un', zone: 'une' }[key]} ${noun}"}\`,
    definiteNoun: (key, noun) => \`${"${{ sheep: 'le', paddock: 'le', zone: 'la' }[key]} ${noun}"}\`,
    demonstrative: (key) => ({ sheep: 'ce', paddock: 'ce', zone: 'cette' }[key]),
    confirmDelete: (v, dem, n) => \`Voulez-vous vraiment ${'${v}'} ${'${dem}'} ${'${n}'} ?\`,
    notesPlaceholder: (t) => \`Notes générales (${'${t.optional}'})\`,
    selectFirst: (noun) => \`Choisissez d'abord un ${'${noun}'}\`,
    selectChoose: (noun) => \`Choisir un ${'${noun}'}\`,
    selectChooseZone: (noun) => \`Choisir une ${'${noun}'}\`,
    noneAvailable: (_noun) => 'Aucune zone disponible',
  },
}

function capitalize(value) {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}

${renderStatic(staticTable)}

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

const LANG_INDEX = { en: 0, nl: 1, fr: 2 }

function buildTranslations(lang, t) {
  const g = GRAMMAR[lang]
  const result = {}
  const idx = LANG_INDEX[lang]

  for (const [key, values] of Object.entries(STATIC)) {
    result[key] = values[idx]
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

fs.writeFileSync(targetPath, output, 'utf8')
