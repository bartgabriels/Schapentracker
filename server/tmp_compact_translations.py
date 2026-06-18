import re
from pathlib import Path

path = Path(r"c:\Users\bartgabriels\OneDrive\Schapentracker\locales\translations.js")
source = path.read_text(encoding="utf-8")
lines = source.splitlines()


def find_line(prefix: str) -> int:
    for i, line in enumerate(lines):
        if line.startswith(prefix):
            return i
    raise RuntimeError(f"Could not find line starting with: {prefix}")


def esc(value: str) -> str:
    return value.replace('\\', '\\\\').replace("'", "\\'")


def extract_literals(lang: str) -> dict:
    lang_start = find_line(f"  {lang}: {{")
    literals_start = None
    for i in range(lang_start, len(lines)):
        if lines[i].strip() == "literals: {":
            literals_start = i + 1
            break
    if literals_start is None:
        raise RuntimeError(f"Could not find literals start for {lang}")

    literals = {}
    entry_re = re.compile(r"^\s+'([^']+)':\s+'((?:\\'|[^'])*)',$")
    i = literals_start
    while i < len(lines):
        line = lines[i]
        if line.strip() == "},":
            break
        m = entry_re.match(line)
        if not m:
            raise RuntimeError(f"Unexpected literal line for {lang}: {line}")
        key = m.group(1)
        value = m.group(2)
        literals[key] = value
        i += 1

    return literals


terms_start = find_line("// Language bundle extracted from app.js")
grammar_start = find_line("const GRAMMAR = {")
terms_block = "\n".join(lines[terms_start:grammar_start]).rstrip()

literals_en = extract_literals("en")
literals_nl = extract_literals("nl")
literals_fr = extract_literals("fr")

keys_en = list(literals_en.keys())
if keys_en != list(literals_nl.keys()) or keys_en != list(literals_fr.keys()):
    raise RuntimeError("Literal key order mismatch across languages")

rows = []
for key in keys_en:
    rows.append(
        f"  '{esc(key)}': ['{literals_en[key]}', '{literals_nl[key]}', '{literals_fr[key]}'],"
    )
rows_block = "\n".join(rows)


dynamic_start = find_line("const DYNAMIC = {")
brace_depth = 0
end_dynamic = None
for i in range(dynamic_start, len(lines)):
    brace_depth += lines[i].count("{")
    brace_depth -= lines[i].count("}")
    if brace_depth == 0:
        end_dynamic = i
        break
if end_dynamic is None:
    raise RuntimeError("Could not locate end of DYNAMIC block")

dynamic_block = "\n".join(lines[dynamic_start:end_dynamic + 1]).rstrip()

window_start = find_line("window.FLOCKOPS_TRANSLATIONS = {")
window_block = "\n".join(lines[window_start:]).rstrip()

output = f"""{terms_block}

const GRAMMAR = {{
  en: {{
    addNoun: (verb, noun) => `${{verb}} ${{noun}}`,
    editNoun: (verb, noun) => `${{verb}} ${{noun}}`,
    deleteNoun: (verb, noun) => `${{verb}} ${{noun}}`,
    actionNoun: (_key, noun) => noun,
    definiteNoun: (_key, noun) => noun,
    demonstrative: (_key) => 'this',
    confirmDelete: (v, dem, n) => `Are you sure you want to ${{v}} ${{dem}} ${{n}}?`,
    notesPlaceholder: (t) => `General ${{t.notes}} (${{t.optional}})`,
    selectFirst: (noun) => `Choose a ${{noun}} first`,
    selectChoose: (noun) => `Choose ${{noun}}`,
    selectChooseZone: (noun) => `Choose ${{noun}}`,
    noneAvailable: (noun) => `No ${{noun}} available`,
  }},
  nl: {{
    addNoun: (verb, noun) => `${{noun}} ${{verb}}`,
    editNoun: (verb, noun) => `${{noun}} ${{verb}}`,
    deleteNoun: (verb, noun) => `${{noun}} ${{verb}}`,
    actionNoun: (_key, noun) => noun,
    definiteNoun: (_key, noun) => noun,
    demonstrative: (key) => ({{ sheep: 'dit', paddock: 'deze', zone: 'deze' }}[key]),
    confirmDelete: (v, dem, n) => `Weet je zeker dat je ${{dem}} ${{n}} wilt ${{v}}?`,
    notesPlaceholder: (t) => `Algemene ${{t.notes}} (${{t.optional}})`,
    selectFirst: (noun) => `Kies eerst een ${{noun}}`,
    selectChoose: (noun) => `Kies ${{noun}}`,
    selectChooseZone: (noun) => `Kies ${{noun}}`,
    noneAvailable: (noun) => `Geen ${{noun}} beschikbaar`,
  }},
  fr: {{
    addNoun: (verb, noun) => `${{verb}} ${{noun}}`,
    editNoun: (verb, noun) => `${{verb}} ${{noun}}`,
    deleteNoun: (verb, noun) => `${{verb}} ${{noun}}`,
    actionNoun: (key, noun) => `${{{{ sheep: 'un', paddock: 'un', zone: 'une' }}[key]}} ${{noun}}`,
    definiteNoun: (key, noun) => `${{{{ sheep: 'le', paddock: 'le', zone: 'la' }}[key]}} ${{noun}}`,
    demonstrative: (key) => ({{ sheep: 'ce', paddock: 'ce', zone: 'cette' }}[key]),
    confirmDelete: (v, dem, n) => `Voulez-vous vraiment ${{v}} ${{dem}} ${{n}} ?`,
    notesPlaceholder: (t) => `Notes générales (${{t.optional}})`,
    selectFirst: (noun) => `Choisissez d'abord un ${{noun}}`,
    selectChoose: (noun) => `Choisir un ${{noun}}`,
    selectChooseZone: (noun) => `Choisir une ${{noun}}`,
    noneAvailable: (_noun) => `Aucune zone disponible`,
  }},
}}

function capitalize(value) {{
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}}

const LANG_INDEX = {{ en: 0, nl: 1, fr: 2 }}

const TRANSLATION_ROWS = {{
{rows_block}
}}

{dynamic_block}

function buildTranslations(lang, t) {{
  const g = GRAMMAR[lang]
  const index = LANG_INDEX[lang]
  const result = {{}}

  for (const [key, row] of Object.entries(TRANSLATION_ROWS)) {{
    result[key] = row[index]
  }}

  for (const [key, compute] of Object.entries(DYNAMIC)) {{
    result[key] = compute(t, g)
  }}

  return result
}}

{window_block}
"""

path.write_text(output + "\n", encoding="utf-8")
