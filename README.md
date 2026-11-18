# Toll Detour Counter

Four-phone manual counter for a toll detour audit. Open the app: https://avinashpkf-arch.github.io/toll-logger/

- One phone per post: Side A Entry, Side A Exit, Side B Entry, Side B Exit
- Guides tap the vehicle type and the last 4 digits of the number plate on a phone-style keypad (saves on the 4th digit)
- All four phones share one Google Sheet through a small Apps Script web app
- Matching per side (A entries with A exits, B with B): exact numbers first, then optional fuzzy matches
  (one digit wrong or two neighbouring digits swapped), within a transit time window, first in first out
- Excel export: Summary, A Entry, A Exit, B Entry, B Exit, A/B Matched, Long stay, A/B Unmatched

Files
- `index.html` – the app (no camera, no photos)
- `Code.gs` – Google Apps Script to paste into the Google Sheet
- `SETUP.txt` – one-time setup and how to use it
- `sw.js`, `manifest.webmanifest`, `icon-*.png` – installable app, works offline (syncs when signal returns)

No vehicle data is stored in this repository; it lives on the phones and in your private Google Sheet.
