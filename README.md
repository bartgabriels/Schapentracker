# FlockOps

FlockOps is a browser app for sheep management across paddocks and zones.
It runs fully client-side (HTML/CSS/JavaScript) and stores data in `localStorage`.

## What It Does

- Manage paddocks and zones
- Manage sheep records, movement, injections, and shearing
- Move sheep out of flock instead of deleting them
- Track history and planning items
- View pedigree trees per sheep
- Export/import JSON backups
- Multilingual UI (Dutch, English, French)

## Main Navigation

Visible tabs:
- Paddocks and zones
- Sheep
- History
- Planning
- Pedigree

Billing access:
- Billing is intentionally not shown as a visible tab button.
- Open Billing by clicking the `FlockOps` heading.

## Sheep Lifecycle

### In flock
Active sheep are used in normal operations (counts, planning candidates, location logic, etc.).

### Out of flock
Removing a sheep now means moving it out of flock, with:
- Reason (`slaughter`, `deceased`, `sold`)
- Date
- Optional notes

Out-of-flock sheep are retained in data and can be shown/hidden in the out-of-flock block.

## Pedigree

Pedigree is shown per active sheep as vertically stacked cards.

- Only active sheep are listed as primary pedigree cards
- Parent/grandparent lookup can still include out-of-flock animals
- Sex icons are shown on every animal node (`♀` / `♂`)

## Billing Model

Current billing lines:
- Fields: included
- Zones: EUR 0.30 each
- Active sheep: EUR 0.30 each
- Inactive sheep (out of flock): EUR 0.05 each
- Users:
  - First 2 users are free
  - EUR 0.50 per user above 2
  - Until authentication/login exists, app assumes `1` user

## Data Storage and Backups

- Storage key: `flockops:data`
- Language key: `flockops:lang`
- Optional auto-download on close for backup attempts
- Import supports older JSON structures; app hydrates and normalizes state

## Project Structure

- `index.html`: layout, tabs, modal markup
- `app.js`: state, rendering, workflows, i18n, persistence
- `styles.css`: styling
- `dummy-data.json`: sample import data
- `locales/translations.csv`: translator-oriented key table
- `server/`: optional server-side workspace (frontend works standalone)

## Run

No build step required.

1. Open `index.html` in a modern browser.
2. Or use the hosted version: `https://bartgabriels.github.io/FlockOps/`

## Translation Workflow

Use `locales/translations.csv` for translation updates.

Rules:
- Do not edit keys in the `key` column
- Keep placeholders unchanged (example: `{tag}`, `{date}`)
- Edit only language columns (`nl`, `en`, `fr`)
