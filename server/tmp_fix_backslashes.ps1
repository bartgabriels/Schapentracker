$path = 'c:/Users/bartgabriels/OneDrive/Schapentracker/locales/translations.js'
$text = Get-Content -Raw -Path $path
# Collapse over-escaped apostrophes (multiple backslashes before a quote) to a single JS escape.
$text = [regex]::Replace($text, "\\\\{2,}'", "\\'")
Set-Content -Path $path -Value $text -Encoding UTF8
