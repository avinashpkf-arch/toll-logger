# Toll Detour Counter

Eight-phone manual counter for a toll detour audit (4 detours, entry and exit posts each). Open the app: https://avinashpkf-arch.github.io/toll-logger/

- One phone per post: LHS Kaniyur, LHS LMW, RHS Kaniyur, RHS Rangaz – each Entry and Exit
- Logins: one ID + PIN per post (one phone at a time, sees only its own post) and an Admin ID (all posts, Excel).
  PINs are stored only as SHA-256 hashes in `index.html`; the PINs themselves are not in this repository
- Guides tap the vehicle type and the last 4 digits of the number plate on a phone-style keypad (saves on the 4th digit)
- All eight phones share one Google Sheet through a small Apps Script web app (append-only log, rows added as needed,
  ~900k rows per spreadsheet, then it starts a new spreadsheet automatically; phones read new rows page by page)
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
