$ErrorActionPreference = 'Stop'

$path = 'c:/Users/bartgabriels/OneDrive/Schapentracker/locales/translations.js'
$lines = Get-Content -Path $path

function Find-LineIndex([string]$prefix, [int]$startAt = 0) {
  for ($i = $startAt; $i -lt $lines.Count; $i++) {
    if ($lines[$i].StartsWith($prefix)) { return $i }
  }
  throw "Could not find line starting with: $prefix"
}

function Escape-JsSingle([string]$value) {
  return ($value -replace "'", "\\'")
}

$termsStart = Find-LineIndex '// Language bundle extracted from app.js'
$grammarStart = Find-LineIndex 'const GRAMMAR = {'
$termsBlock = ($lines[$termsStart..($grammarStart - 1)] -join "`n").TrimEnd()

function Extract-Literals([string]$lang) {
  $langStart = Find-LineIndex "  ${lang}: {" $grammarStart
  $literalsStart = -1
  for ($i = $langStart; $i -lt $lines.Count; $i++) {
    if ($lines[$i].Trim() -eq 'literals: {') {
      $literalsStart = $i + 1
      break
    }
  }
  if ($literalsStart -lt 0) { throw "Could not find literals start for $lang" }

  $map = [ordered]@{}
  $rx = [regex]"^\s+'([^']+)':\s+'((?:\\'|[^'])*)',$"
  for ($i = $literalsStart; $i -lt $lines.Count; $i++) {
    $line = $lines[$i]
    if ($line.Trim() -eq '},') { break }
    $m = $rx.Match($line)
    if (-not $m.Success) { throw "Unexpected literal line for ${lang}: $line" }
    $map[$m.Groups[1].Value] = $m.Groups[2].Value
  }
  return $map
}

$literalsEn = Extract-Literals 'en'
$literalsNl = Extract-Literals 'nl'
$literalsFr = Extract-Literals 'fr'

$keysEn = @($literalsEn.Keys)
$keysNl = @($literalsNl.Keys)
$keysFr = @($literalsFr.Keys)

if (($keysEn.Count -ne $keysNl.Count) -or ($keysEn.Count -ne $keysFr.Count)) {
  throw 'Literal key count mismatch across languages'
}
for ($i = 0; $i -lt $keysEn.Count; $i++) {
  if ($keysEn[$i] -ne $keysNl[$i] -or $keysEn[$i] -ne $keysFr[$i]) {
    throw "Literal key order mismatch at index $i"
  }
}

$rows = New-Object System.Collections.Generic.List[string]
foreach ($key in $keysEn) {
  $en = $literalsEn[$key]
  $nl = $literalsNl[$key]
  $fr = $literalsFr[$key]
  $rows.Add("  '$(Escape-JsSingle $key)': ['$(Escape-JsSingle $en)', '$(Escape-JsSingle $nl)', '$(Escape-JsSingle $fr)'],")
}
$rowsBlock = $rows -join "`n"

$dynamicStart = Find-LineIndex 'const DYNAMIC = {'
$buildStart = Find-LineIndex 'function buildTranslations(lang, t) {'
$dynamicEnd = $buildStart - 1
while ($dynamicEnd -ge $dynamicStart -and $lines[$dynamicEnd].Trim() -eq '') { $dynamicEnd-- }
if ($lines[$dynamicEnd].Trim() -ne '}') { throw 'Could not locate end of DYNAMIC block' }
$dynamicBlock = ($lines[$dynamicStart..$dynamicEnd] -join "`n").TrimEnd()

$windowStart = Find-LineIndex 'window.FLOCKOPS_TRANSLATIONS = {'
$windowBlock = ($lines[$windowStart..($lines.Count - 1)] -join "`n").TrimEnd()

$grammarBlock = @'
const GRAMMAR = {
  en: {
    addNoun: (verb, noun) => `${verb} ${noun}`,
    editNoun: (verb, noun) => `${verb} ${noun}`,
    deleteNoun: (verb, noun) => `${verb} ${noun}`,
    actionNoun: (_key, noun) => noun,
    definiteNoun: (_key, noun) => noun,
    demonstrative: (_key) => 'this',
    confirmDelete: (v, dem, n) => `Are you sure you want to ${v} ${dem} ${n}?`,
    notesPlaceholder: (t) => `General ${t.notes} (${t.optional})`,
    selectFirst: (noun) => `Choose a ${noun} first`,
    selectChoose: (noun) => `Choose ${noun}`,
    selectChooseZone: (noun) => `Choose ${noun}`,
    noneAvailable: (noun) => `No ${noun} available`,
  },
  nl: {
    addNoun: (verb, noun) => `${noun} ${verb}`,
    editNoun: (verb, noun) => `${noun} ${verb}`,
    deleteNoun: (verb, noun) => `${noun} ${verb}`,
    actionNoun: (_key, noun) => noun,
    definiteNoun: (_key, noun) => noun,
    demonstrative: (key) => ({ sheep: 'dit', paddock: 'deze', zone: 'deze' }[key]),
    confirmDelete: (v, dem, n) => `Weet je zeker dat je ${dem} ${n} wilt ${v}?`,
    notesPlaceholder: (t) => `Algemene ${t.notes} (${t.optional})`,
    selectFirst: (noun) => `Kies eerst een ${noun}`,
    selectChoose: (noun) => `Kies ${noun}`,
    selectChooseZone: (noun) => `Kies ${noun}`,
    noneAvailable: (noun) => `Geen ${noun} beschikbaar`,
  },
  fr: {
    addNoun: (verb, noun) => `${verb} ${noun}`,
    editNoun: (verb, noun) => `${verb} ${noun}`,
    deleteNoun: (verb, noun) => `${verb} ${noun}`,
    actionNoun: (key, noun) => `${{ sheep: 'un', paddock: 'un', zone: 'une' }[key]} ${noun}`,
    definiteNoun: (key, noun) => `${{ sheep: 'le', paddock: 'le', zone: 'la' }[key]} ${noun}`,
    demonstrative: (key) => ({ sheep: 'ce', paddock: 'ce', zone: 'cette' }[key]),
    confirmDelete: (v, dem, n) => `Voulez-vous vraiment ${v} ${dem} ${n} ?`,
    notesPlaceholder: (t) => `Notes générales (${t.optional})`,
    selectFirst: (noun) => `Choisissez d'abord un ${noun}`,
    selectChoose: (noun) => `Choisir un ${noun}`,
    selectChooseZone: (noun) => `Choisir une ${noun}`,
    noneAvailable: (_noun) => `Aucune zone disponible`,
  },
}

function capitalize(value) {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}

const LANG_INDEX = { en: 0, nl: 1, fr: 2 }

const TRANSLATION_ROWS = {
'@

$buildBlock = @'
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
'@

$output = @(
  $termsBlock,
  '',
  $grammarBlock,
  $rowsBlock,
  '}',
  '',
  $dynamicBlock,
  '',
  $buildBlock,
  '',
  $windowBlock,
  ''
) -join "`n"

Set-Content -Path $path -Value $output -Encoding UTF8

$reportPath = 'c:/Users/bartgabriels/OneDrive/Schapentracker/server/tmp_compact_translations_report.json'
$report = @{
  keyCount = $keysEn.Count
  lineCount = ((Get-Content -Path $path).Count)
}
$report | ConvertTo-Json | Set-Content -Path $reportPath -Encoding UTF8
