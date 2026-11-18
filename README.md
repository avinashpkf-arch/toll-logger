# Toll Detour Counter

Eight-phone manual counter for a toll detour audit (4 detours, entry and exit posts each). Open the app: https://avinashpkf-arch.github.io/toll-logger/

- One phone per post: LHS Kaniyur, LHS LMW, RHS Kaniyur, RHS Rangaz – each Entry and Exit
- Guides tap the vehicle type and the last 4 digits of the number plate on a phone-style keypad (saves on the 4th digit)
- All eight phones share one Google Sheet through a small Apps Script web app
- Matching per detour (its entries with its own exits), no time limit: exact numbers first (closest earlier entry,
  same type preferred), then optional typo matches (one digit wrong or two neighbouring digits swapped,
  same type, within 30 minutes)
- Excel export: Summary, one sheet per post (8), Matched, Unmatched

Files
- `index.html` – the app (no camera, no photos)
- `Code.gs` – Google Apps Script to paste into the Google Sheet
- `SETUP.txt` – one-time setup and how to use it
- `sw.js`, `manifest.webmanifest`, `icon-*.png` – installable app, works offline (syncs when signal returns)

No vehicle data is stored in this repository; it lives on the phones and in your private Google Sheet.
