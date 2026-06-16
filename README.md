# Schapentracker

A lightweight browser-based sheep management application for tracking sheep locations across fields and zones. Built with vanilla HTML, CSS, and JavaScript—no server or dependencies required.

## Features

### Field Management
- **Add/Remove fields** — Create custom paddocks (weides) to organize your sheep areas
- **Default Stal field** — A protected default "Stal" (barn) field that cannot be deleted
- **Zone support** — Each field can have multiple zones for granular location tracking
- **Minimum enforcement** — Every field must maintain at least 1 zone

### Sheep Tracking
- **Add/Remove sheep** — Register individual sheep with unique tags
- **Assign to locations** — Place sheep in specific fields and zones
- **Move sheep** — Quickly relocate sheep between fields and zones with modal dialogs
- **Clickable sheep names** — Click any sheep name in a zone to open the move dialog
- **Track timestamps** — Automatic last-modification tracking for each sheep

### Smart Workflows
- **Auto-select zones** — When selecting a field with only 1 zone, it auto-selects automatically
- **Submit button state** — The submit button is disabled until a zone is selected (if multiple zones exist)
- **Auto-move on deletion** — When deleting a zone or field with a single target location, sheep move automatically without confirmation
- **Forced reassignment** — Deleting zones/fields with multiple target options presents a confirmation modal
- **Stal protection** — The default Stal field and Stal zone cannot be deleted

### Data Management
- **Local storage** — All data persists in the browser using `localStorage` (key: `schapentracker:data`)
- **Export data** — Download your entire database as a JSON file
- **Import data** — Upload previously exported JSON files to restore data
- **Clear data** — Wipe all data with a confirmation prompt

### User Interface
- **Responsive layout** — Works on desktop and mobile devices
- **Expandable fields** — Click any field name to expand/collapse its zones
- **Visual feedback** — Zone status shows "Occupied" or "Empty since X days"
- **Organized sheep display** — Sheep names displayed inline within zone cards with grass and barn backgrounds

## Getting Started

1. Open `index.html` in any modern web browser
2. Start adding fields and sheep
3. Use the modals to manage locations and movements
4. Data saves automatically to browser storage

## Usage

### Adding a Field
1. Click the `+` button in the "Weides" section
2. Enter a field name
3. Click "Toevoegen" to create

### Adding a Sheep
1. Click the `+` button in the "Schapen" section
2. Enter a sheep tag/identifier
3. Select a field and zone (zone auto-selects if only 1 available)
4. Click "Toevoegen" to add

### Creating Zones
1. Expand a field by clicking its name
2. Click the `+` button in the zone grid
3. Enter a zone name
4. Click "Toevoegen" to create

### Moving a Sheep
- **Option 1:** Click the sheep's name anywhere in a zone
- **Option 2:** Click the "Verplaats" button in the sheep list
- Select target field and zone (auto-selected if only 1 zone available)
- Click "Verplaats" to move

### Deleting Zones or Fields
1. Click the `−` button on the zone or field (not available for Stal)
2. If sheep are present, select their destination
3. Confirm or cancel in the modal
4. Sheep auto-move if only 1 target exists

### Managing Data
- **Export** — Click "Download data" to save a backup JSON file
- **Import** — Click "Upload data" and select a previously exported JSON file
- **Clear all** — Click "Wipe all data" to reset the entire database

## Architecture

### Files
- `index.html` — DOM structure and modal definitions
- `app.js` — Core logic, state management, event delegation, and persistence
- `styles.css` — Responsive design, component styling, and animations
- `schaap.png` — Sheep icon overlay for zone displays
- `gras.png` — Grass background image for regular zones
- `stal.png` — Barn background image for Stal zones

### Key Data Model
```javascript
state = {
  paddocks: [
    {
      id: string,
      name: string,
      zones: [
        { id: string, name: string, emptySince: timestamp | null }
      ]
    }
  ],
  sheep: [
    {
      id: string,
      tag: string,
      paddockId: string,
      zoneId: string | null,
      lastUpdated: timestamp
    }
  ]
}
```

## Browser Compatibility
- Chrome/Chromium (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

Requires ES6 support and `localStorage` API availability.

## Notes
- The app requires no backend server or installation
- All data is stored locally in your browser
- Exporting regularly is recommended for data backup
- The Stal field and zone are protected to ensure a default location always exists
