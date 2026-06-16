# Schapentracker

🇳🇱 **[Lees in het Nederlands](#nederlands)** | 🇬🇧 **[Read in English](#english)** | 🇫🇷 **[Lire en français](#francais)**

---

## Translator Workflow

Use `locales/translations.csv` for translation work. This file is intended for translators and contains no application logic.

- Columns:
  - `key`: internal translation key (do not change)
  - `nl`: Dutch source text
  - `en`: English text
  - `fr`: French text
- Rules:
  - Keep placeholders exactly as-is (for example `{name}`, `{count}`, `{from}`)
  - Do not rename, remove, or add keys in the `key` column
  - Preserve line breaks and punctuation where meaningful
- Delivery:
  - Edit only the target language column(s)
  - Return the same CSV format

---

## Nederlands

Schapentracker is een lichte, browsergebaseerde applicatie om schapen te beheren over weides en zones. De app draait volledig in HTML, CSS en JavaScript (zonder verplichte backend) en bewaart data lokaal in je browser.

### Taalinstellingen
De app ondersteunt **volledige meertalige ondersteuning** met Nederlands, Engels en Frans. Gebruik de taalkeuzelijst bovenaan de pagina om tussen talen te schakelen. Je voorkeur wordt automatisch opgeslagen.

### Tabweergave
De hoofdinterface gebruikt 3 tabs om drukte te verminderen:
- **Weides en zones**
- **Schapen**
- **Historiek**

## Functionaliteiten

### Weides
- Weides toevoegen, bewerken en verwijderen.
- Beschermde standaardweide Stal die niet verwijderd kan worden.
- Postcode per weide (optioneel).
- Oppervlakte op weideniveau wordt automatisch berekend als som van alle zone-oppervlaktes.
- Weides staan standaard open en kunnen handmatig in/uitgeklapt worden.

### Zones
- Meerdere zones per weide.
- Zones toevoegen, bewerken en verwijderen.
- Per zone kan je Oppervlakte (m2) en Omtrek (m) bijhouden.
- Een weide moet altijd minstens 1 zone behouden.
- Beschermde Stal-zone binnen de Stal-weide.
- **Schapen per zone**: Schapen worden in een compacte, scrollbare lijst weergegeven om overlapping van teksten te voorkomen.

### Schapen
- Schapen toevoegen, hernoemen, verplaatsen en verwijderen.
- Schapen kunnen aan een specifieke weide en zone gekoppeld worden.
- **Geslacht bijhouden**: Ooi (vrouw, ♀) of Ram (man, ♂) met gekleurde iconen.
- **Stamboom/Genealogie**: Moeder- en vaderdieren selecteren bij toevoegen van een schaap.
  - Moederselect toont alleen ooien.
  - Vaderselect toont alleen rammen.
  - Bij bewerken: stamboomweergave in format `"vadertag" x "moedertag"`.
  - Ouderrelaties worden behouden en automatisch opgeschoond bij verwijderen.
- Laatste wijzigingsdatum per schaap wordt bijgehouden.
- Klik op een schaapnaam in een zone om meteen het verplaatsvenster te openen.

### Slimme verplaats- en verwijderlogica
- Automatische zonekeuze wanneer er maar 1 geldige doelzone bestaat.
- Submit-knoppen blijven uitgeschakeld tot een geldige zone gekozen is.
- Bij verwijderen van zone/weide met schapen:
  - automatische verplaatsing als er exact 1 geldig doel is,
  - anders een modal om een doelzone te kiezen.
- Bulkactie op zones: Verplaats alle dieren.

### Historiek
- Alle belangrijke acties worden gelogd (toevoegen, bewerken, verwijderen, verplaatsen, import, wissen).
- Historiek is persistent en zichtbaar in de UI.
- Export bevat maximaal de 100 meest recente historiekitems.
- **Volledig vertaald**: Alle historiekberichten verschijnen in je gekozen taal.

### Weer per weide
- 3-daagse weersvoorspelling op basis van postcode.
- Ondersteuning voor Belgische en Nederlandse postcodes.
- Forecast is in- en uitklapbaar per weide.
- Caching van weersdata voor performantie.

### Databeheer
- Lokale opslag via localStorage onder sleutel `schapentracker:data`.
- Gegevens exporteren naar JSON.
- Gegevens importeren vanuit JSON.
- Alle gegevens wissen met bevestiging.

## Gebruik

1. Open https://bartgabriels.github.io/Schapentracker/ in een moderne browser.
2. Kies je taal met de dropdown bovenaan (Nederlands/English/Français).
3. Gebruik de tabs om tussen weides/zones, schapen en historiek te wisselen.
4. Voeg weides, zones en schapen toe.
5. Gebruik de modals om te verplaatsen, bewerken of verwijderen.
6. Data wordt automatisch opgeslagen in de browser.

## Bestandsstructuur

- [index.html](index.html): structuur van de pagina en modals.
- [app.js](app.js): state, businesslogica, event handling, opslag, weer, historiek en meertalige ondersteuning.
- [styles.css](styles.css): layout en styling.
- [locales/translations.csv](locales/translations.csv): vertaaltabel (`key`, `nl`, `en`, `fr`) voor vertalers.
- [gras.png](gras.png), [stal.png](stal.png), [schaap.png](schaap.png), [wol.png](wol.png): visuele assets.

## Browsercompatibiliteit

- Chrome / Chromium (recent)
- Edge (recent)
- Firefox (recent)
- Safari (recent)

Vereist ondersteuning voor ES6 en localStorage.

## Opmerking

De map [server](server) is aanwezig in de repository, maar de frontend in deze root werkt zelfstandig in de browser.

---

## English

Schapentracker is a lightweight, browser-based application for managing sheep across paddocks and zones. The app runs entirely in HTML, CSS, and JavaScript (no required backend) and stores data locally in your browser.

### Language Settings
The app supports **full multilingual support** with Dutch, English, and French. Use the language selector at the top of the page to switch between languages. Your preference is automatically saved.

### Tab Layout
The main interface uses 3 tabs to reduce visual clutter:
- **Paddocks and zones**
- **Sheep**
- **History**

## Features

### Paddocks
- Add, edit, and delete paddocks.
- Protected default paddock "Stal" (Stall) which cannot be deleted.
- Optional postcode per paddock.
- Paddock area is automatically calculated as the sum of all zone areas.
- Paddocks are expanded by default and can be collapsed/expanded manually.

### Zones
- Multiple zones per paddock.
- Add, edit, and delete zones.
- Track area (m2) and perimeter (m) per zone.
- A paddock must always retain at least 1 zone.
- Protected "Stal" zone within the Stal paddock.
- **Sheep per zone**: Sheep are displayed in a compact, scrollable list to prevent text overlap.

### Sheep
- Add, rename, move, and delete sheep.
- Sheep can be assigned to a specific paddock and zone.
- **Track sex**: Ewe (female, ♀) or Ram (male, ♂) with color-coded icons.
- **Pedigree/Genealogy**: Select parent animals when adding a sheep.
  - Mother selector shows only ewes.
  - Father selector shows only rams.
  - When editing: pedigree displayed in format `"father_tag" x "mother_tag"`.
  - Parent relationships are preserved and automatically cleaned up when deleting.
- Last update timestamp is tracked per sheep.
- Click a sheep name in a zone to immediately open the move dialog.

### Smart move and delete logic
- Automatic zone selection when there is only 1 valid target zone.
- Submit buttons remain disabled until a valid zone is selected.
- When deleting zone/paddock with sheep:
  - Automatic move if there is exactly 1 valid target,
  - Otherwise, a modal to select a target zone.
- Bulk action on zones: Move all animals.

### History
- All important actions are logged (add, edit, delete, move, import, clear).
- History is persistent and visible in the UI.
- Export contains up to 100 most recent history items.
- **Fully translated**: All history messages appear in your selected language.

### Weather per paddock
- 3-day weather forecast based on postcode.
- Support for Belgian and Dutch postcodes.
- Forecast is collapsible per paddock.
- Weather data caching for performance.

### Data Management
- Local storage via localStorage under key `schapentracker:data`.
- Export data to JSON.
- Import data from JSON.
- Clear all data with confirmation.

## Usage

1. Open https://bartgabriels.github.io/Schapentracker/ in a modern browser.
2. Choose your language with the dropdown at the top (Nederlands/English/Français).
3. Use tabs to switch between paddocks/zones, sheep, and history.
4. Add paddocks, zones, and sheep.
5. Use modals to move, edit, or delete.
6. Data is automatically saved in your browser.

## File Structure

- [index.html](index.html): page structure and modals.
- [app.js](app.js): state, business logic, event handling, storage, weather, history, and multilingual support.
- [styles.css](styles.css): layout and styling.
- [locales/translations.csv](locales/translations.csv): translation table (`key`, `nl`, `en`, `fr`) for translators.
- [gras.png](gras.png), [stal.png](stal.png), [schaap.png](schaap.png), [wol.png](wol.png): visual assets.

## Browser Compatibility

- Chrome / Chromium (recent)
- Edge (recent)
- Firefox (recent)
- Safari (recent)

Requires ES6 and localStorage support.

## Note

The [server](server) directory is present in the repository, but the frontend in this root works independently in the browser.

---

## Francais

Schapentracker est une application legere basee sur le navigateur pour gerer des moutons dans des paturages et des zones. L'application fonctionne entierement en HTML, CSS et JavaScript (sans backend obligatoire) et enregistre les donnees localement dans votre navigateur.

### Parametres de langue
L'application prend en charge une **localisation complete** en neerlandais, anglais et francais. Utilisez le selecteur de langue en haut de la page pour changer de langue. Votre preference est enregistree automatiquement.

### Organisation par onglets
L'interface principale utilise 3 onglets pour reduire l'encombrement visuel :
- **Paturages et zones**
- **Moutons**
- **Historique**

## Fonctionnalites

### Paturages
- Ajouter, modifier et supprimer des paturages.
- Paturage par defaut protege "Stal" qui ne peut pas etre supprime.
- Code postal optionnel par paturage.
- La surface du paturage est calculee automatiquement comme somme des surfaces des zones.
- Les paturages sont ouverts par defaut et peuvent etre replies/deplies manuellement.

### Zones
- Plusieurs zones par paturage.
- Ajouter, modifier et supprimer des zones.
- Suivi de la surface (m2) et du perimetre (m) par zone.
- Un paturage doit toujours conserver au moins 1 zone.
- Zone "Stal" protegee dans le paturage Stal.
- **Moutons par zone** : les moutons sont affiches dans une liste compacte et defilable pour eviter le chevauchement du texte.

### Moutons
- Ajouter, renommer, deplacer et supprimer des moutons.
- Les moutons peuvent etre assignes a un paturage et une zone specifiques.
- **Suivi du sexe** : brebis (femelle, ♀) ou belier (male, ♂) avec des icones colorees.
- **Pedigree/Genealogie** : selection des parents lors de l'ajout d'un mouton.
  - Le selecteur de mere affiche uniquement les brebis.
  - Le selecteur de pere affiche uniquement les beliers.
  - En edition : affichage du pedigree au format `"tag_pere" x "tag_mere"`.
  - Les relations parentales sont conservees et nettoyees automatiquement lors d'une suppression.
- La date de derniere mise a jour est enregistree par mouton.
- Cliquez sur le nom d'un mouton dans une zone pour ouvrir directement la fenetre de deplacement.

### Logique intelligente de deplacement et suppression
- Selection automatique de la zone lorsqu'il n'y a qu'une seule zone cible valide.
- Les boutons d'envoi restent desactives tant qu'une zone valide n'est pas selectionnee.
- Lors de la suppression d'une zone/paturage avec des moutons :
  - deplacement automatique s'il n'y a qu'une seule destination valide,
  - sinon, ouverture d'une fenetre modale pour choisir une zone cible.
- Action groupée sur les zones : deplacer tous les animaux.

### Historique
- Toutes les actions importantes sont journalisees (ajout, modification, suppression, deplacement, import, effacement).
- L'historique est persistant et visible dans l'interface.
- L'export contient jusqu'a 100 elements d'historique recents.
- **Entierement traduit** : tous les messages d'historique apparaissent dans la langue selectionnee.

### Meteo par paturage
- Prevision meteo sur 3 jours basee sur le code postal.
- Prise en charge des codes postaux belges et neerlandais.
- Les previsions sont repliables/depliables par paturage.
- Mise en cache des donnees meteo pour de meilleures performances.

### Gestion des donnees
- Stockage local via localStorage avec la cle `schapentracker:data`.
- Export des donnees en JSON.
- Import des donnees depuis JSON.
- Effacement de toutes les donnees avec confirmation.

## Utilisation

1. Ouvrez https://bartgabriels.github.io/Schapentracker/ dans un navigateur moderne.
2. Choisissez votre langue en haut de la page (Nederlands/English/Francais).
3. Utilisez les onglets pour basculer entre paturages/zones, moutons et historique.
4. Ajoutez des paturages, des zones et des moutons.
5. Utilisez les fenetres modales pour deplacer, modifier ou supprimer.
6. Les donnees sont enregistrees automatiquement dans le navigateur.

## Structure des fichiers

- [index.html](index.html) : structure de la page et des modales.
- [app.js](app.js) : etat, logique metier, gestion des evenements, stockage, meteo, historique et localisation multilingue.
- [styles.css](styles.css) : mise en page et styles.
- [locales/translations.csv](locales/translations.csv) : table de traduction (`key`, `nl`, `en`, `fr`) pour les traducteurs.
- [gras.png](gras.png), [stal.png](stal.png), [schaap.png](schaap.png), [wol.png](wol.png) : assets visuels.

## Compatibilite navigateur

- Chrome / Chromium (recent)
- Edge (recent)
- Firefox (recent)
- Safari (recent)

Necessite ES6 et la prise en charge de localStorage.

## Remarque

Le dossier [server](server) est present dans le depot, mais le frontend a la racine fonctionne de maniere autonome dans le navigateur.

---

**Last updated**: June 2026 | **Version**: 2.2 (NL/EN/FR + Tab Layout)
