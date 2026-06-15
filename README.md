# Schapentracker — Minimal Static Version

A simple browser-based sheep tracker app built with static HTML, CSS, and JavaScript.

## Features

- Add and manage fields (weides/paddocks)
- Add sheep and assign them to paddocks and zones
- Create zones inside paddocks
- Move sheep between paddocks and zones
- Track last modification date per sheep
- Persist data locally using `localStorage`

## Run locally

1. Open `index.html` in a browser.
2. The app will load immediately with no server required.

## Usage

- Click `Toevoegen` in the `Weides` section to add a new paddock.
- Click `Toevoegen` in the `Schapen` section to add a sheep.
- Expand a paddock to view and add zones.
- Use the `Verplaats` button next to a sheep to move it to another paddock or zone.

## Data storage

- Data is saved in the browser's `localStorage` under the key `schapentracker:data`.
- Clearing browser storage will remove all paddocks, zones, and sheep data.

## Files

- `index.html` — main user interface
- `styles.css` — styles and responsive layout
- `app.js` — application logic, state management, and persistence
- `schaap.png` — sheep icon used in zone labels
- `gras.png` — background image for zone cards
