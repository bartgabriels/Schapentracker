# Schapentracker

Schapentracker is een lichte, browsergebaseerde applicatie om schapen te beheren over weides en zones. De app draait volledig in HTML, CSS en JavaScript (zonder verplichte backend) en bewaart data lokaal in je browser.

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

### Weer per weide
- 3-daagse weersvoorspelling op basis van postcode.
- Ondersteuning voor Belgische en Nederlandse postcodes.
- Forecast is in- en uitklapbaar per weide.
- Caching van weersdata voor performantie.

### Databeheer
- Lokale opslag via localStorage onder sleutel schapentracker:data.
- Gegevens exporteren naar JSON.
- Gegevens importeren vanuit JSON.
- Alle gegevens wissen met bevestiging.

## Gebruik

1. Open https://bartgabriels.github.io/Schapentracker/ in een moderne browser.
2. Voeg weides, zones en schapen toe.
3. Gebruik de modals om te verplaatsen, bewerken of verwijderen.
4. Data wordt automatisch opgeslagen in de browser.

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
- [app.js](app.js): state, businesslogica, event handling, opslag, weer en historiek.
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
