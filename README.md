# Schapentracker

🇳🇱 **[Lees in het Nederlands](#nederlands)** | 🇬🇧 **[Read in English](#english)**

---

## Nederlands

# Schapentracker

Schapentracker is een lichte, browsergebaseerde applicatie om schapen te beheren over weides en zones. De app draait volledig in HTML, CSS en JavaScript (zonder verplichte backend) en bewaart data lokaal in je browser.

### Taalinstellingen
De app ondersteunt **volledige meertalige ondersteuning** met Nederlands en Engels. Gebruik de taalkeuzelijst bovenaan de pagina om tussen talen te schakelen. Je voorkeur wordt automatisch opgeslagen.

## Functionaliteiten

### Weides
- Weides toevoegen, bewerken en verwijderen.
- Beschermde standaardweide Stal die niet verwijderd kan worden.
- Postcode per weide (optioneel).
- Oppervlakte op weideniveau wordt automatisch berekend als som van alle zone-oppervlaktes.

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
2. Kies je taal met de dropdown bovenaan (Nederlands/English).
3. Voeg weides, zones en schapen toe.
4. Gebruik de modals om te verplaatsen, bewerken of verwijderen.
5. Data wordt automatisch opgeslagen in de browser.

## Belangrijke schermen en acties

### Weide toevoegen
1. Klik op + bij Weides.
2. Vul naam (en optioneel postcode) in.
3. Klik op Toevoegen.

### Zone toevoegen of bewerken
1. Open een weide.
2. Klik op + voor een nieuwe zone, of op het edit-icoon naast een zone-naam.
3. Vul naam, oppervlakte (m2) en omtrek (m) in.
4. Sla op.

### Schaap verplaatsen
1. Klik op Verplaats bij een schaap in de lijst, of klik op een schaapnaam in een zone.
2. Kies doelweide en doelzone.
3. Klik op Verplaats.

## Bestandsstructuur

- [index.html](index.html): structuur van de pagina en modals.
- [app.js](app.js): state, businesslogica, event handling, opslag, weer, historiek en meertalige ondersteuning.
- [styles.css](styles.css): layout en styling.
- [gras.png](gras.png), [stal.png](stal.png), [schaap.png](schaap.png), [wol.png](wol.png): visuele assets.

## Datamodel (vereenvoudigd)

```js
state = {
  paddocks: [
    {
      id: string,
      name: string,
      postcode: string,
      zones: [
        {
          id: string,
          name: string,
          area: number | null,
          perimeter: number | null,
          emptySince: timestamp | null
        }
      ]
    }
  ],
  sheep: [
    {
      id: string,
      tag: string,
      gender: 'female' | 'male' | null,
      motherId: string | null,
      fatherId: string | null,
      paddockId: string,
      zoneId: string | null,
      lastUpdated: timestamp
    }
  ],
  history: [
    {
      id: string,
      ts: timestamp,
      entity: string,
      message: string
    }
  ]
}
```

## Browsercompatibiliteit

- Chrome / Chromium (recent)
- Edge (recent)
- Firefox (recent)
- Safari (recent)

Vereist ondersteuning voor ES6 en localStorage.

## Opmerking

De map [server](server) is aanwezig in de repository, maar de frontend in deze root werkt zelfstandig in de browser.

---

<a name="english"></a>

## English

# Schapentracker

Schapentracker is a lightweight, browser-based application for managing sheep across paddocks and zones. The app runs entirely in HTML, CSS, and JavaScript (no required backend) and stores data locally in your browser.

### Language Settings
The app supports **full multilingual support** with Dutch and English. Use the language selector at the top of the page to switch between languages. Your preference is automatically saved.

## Features

### Paddocks
- Add, edit, and delete paddocks.
- Protected default paddock "Stal" (Stall) which cannot be deleted.
- Optional postcode per paddock.
- Paddock area is automatically calculated as the sum of all zone areas.

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
2. Choose your language with the dropdown at the top (Nederlands/English).
3. Add paddocks, zones, and sheep.
4. Use modals to move, edit, or delete.
5. Data is automatically saved in your browser.

## Key Screens and Actions

### Add Paddock
1. Click + next to Paddocks.
2. Enter name (and optionally postcode).
3. Click Add.

### Add or Edit Zone
1. Open a paddock.
2. Click + for a new zone, or click the edit icon next to a zone name.
3. Enter name, area (m2), and perimeter (m).
4. Save.

### Move Sheep
1. Click Move next to a sheep in the list, or click a sheep name in a zone.
2. Choose target paddock and target zone.
3. Click Move.

## File Structure

- [index.html](index.html): page structure and modals.
- [app.js](app.js): state, business logic, event handling, storage, weather, history, and multilingual support.
- [styles.css](styles.css): layout and styling.
- [gras.png](gras.png), [stal.png](stal.png), [schaap.png](schaap.png), [wol.png](wol.png): visual assets.

## Data Model (simplified)

```js
state = {
  paddocks: [
    {
      id: string,
      name: string,
      postcode: string,
      zones: [
        {
          id: string,
          name: string,
          area: number | null,
          perimeter: number | null,
          emptySince: timestamp | null
        }
      ]
    }
  ],
  sheep: [
    {
      id: string,
      tag: string,
      gender: 'female' | 'male' | null,
      motherId: string | null,
      fatherId: string | null,
      paddockId: string,
      zoneId: string | null,
      lastUpdated: timestamp
    }
  ],
  history: [
    {
      id: string,
      ts: timestamp,
      entity: string,
      message: string
    }
  ]
}
```

## Browser Compatibility

- Chrome / Chromium (recent)
- Edge (recent)
- Firefox (recent)
- Safari (recent)

Requires ES6 and localStorage support.

## Note

The [server](server) directory is present in the repository, but the frontend in this root works independently in the browser.

---

**Last updated**: June 2026 | **Version**: 2.0 (Multilingual Support)
