// Toll Detour Counter – Google Apps Script (version 2)
// Paste into a Google Sheet (Extensions > Apps Script) or use as a standalone script:
// with no sheet it creates "Toll Audit Live" in your Google Drive.
//
// How it stores data
// - Tab "Records", 11 columns. Every save from a phone is ADDED as a new row (never searched or overwritten),
//   so saving stays fast however big the sheet gets. An edit or delete is a new row for the same id;
//   the phones always keep the newest version.
// - Rows are added in blocks as needed (a new tab only has 1,000 rows).
// - Google allows 10 million cells per spreadsheet. With 11 columns that is about 900,000 rows.
//   When a spreadsheet reaches MAXROWS, the script starts a new one ("Toll Audit Live (2)", "(3)", ...)
//   and carries on, so there is no practical limit.
// - Phones read new rows page by page (PAGE rows at a time), starting where they stopped last time.

const TAB = 'Records';
const HEAD = ['id', 'detour', 'dir', 'type', 'number', 'time_ms', 'time', 'updated', 'deleted', 'saved_at', 'remarks'];
const PAGE = 5000;
const DEFAULT_MAXROWS = 900000;          // rows per spreadsheet before starting a new one

function props_() { return PropertiesService.getScriptProperties(); }
function maxRows_() { return Number(props_().getProperty('MAXROWS')) || DEFAULT_MAXROWS; }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

// list of spreadsheet ids in use, oldest first; the last one receives new rows
function files_() {
  const p = props_();
  let f = JSON.parse(p.getProperty('FILES') || '[]');
  if (f.length) return f;
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    f = JSON.parse(p.getProperty('FILES') || '[]');
    if (f.length) return f;
    let ss = null;
    try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) {}
    if (!ss) { const old = p.getProperty('SHEET_ID'); if (old) { try { ss = SpreadsheetApp.openById(old); } catch (e) {} } }
    if (!ss) { ss = SpreadsheetApp.create('Toll Audit Live'); tab_(ss, true); }
    f = [ss.getId()];
    p.setProperty('FILES', JSON.stringify(f));
    return f;
  } finally { lock.releaseLock(); }
}
// the Records tab, created with exactly 11 columns (blank columns also count towards Google's cell limit)
function tab_(ss, fresh) {
  let s = ss.getSheetByName(TAB);
  if (!s) {
    s = ss.insertSheet(TAB);
    s.getRange(1, 1, 1, HEAD.length).setValues([HEAD]);
    s.setFrozenRows(1);
    const mc = s.getMaxColumns();
    if (mc > HEAD.length) s.deleteColumns(HEAD.length + 1, mc - HEAD.length);
    if (fresh) { const s1 = ss.getSheetByName('Sheet1'); if (s1 && ss.getSheets().length > 1) ss.deleteSheet(s1); }
  }
  if (s.getMaxColumns() < HEAD.length) s.insertColumnsAfter(s.getMaxColumns(), HEAD.length - s.getMaxColumns());   // tab made by the previous script: add the remarks column
  if (String(s.getRange(1, HEAD.length).getValues()[0][0]) !== HEAD[HEAD.length - 1]) s.getRange(1, HEAD.length).setValue(HEAD[HEAD.length - 1]);
  return s;
}
function rec_(r) {
  return {id: String(r[0]), gate: String(r[1]), dir: String(r[2]), type: String(r[3]), plate: String(r[4]), t: Number(r[5]),
          time: String(r[6]), updated: Number(r[7]), deleted: Number(r[8]), srv: Number(r[9]), remarks: String(r[10] || '')};
}

function doGet(e) {
  try {
    const P = (e && e.parameter) || {}, f = files_(), last = SpreadsheetApp.openById(f[f.length - 1]);
    const info = {ok: true, layout: 2, now: Date.now(), sheet: last.getUrl(), files: f.length};
    if (P.probe) return out_(info);
    if (P.from === undefined) {                       // older app versions: everything saved after 'since'
      const since = Number(P.since || 0), s = tab_(last), n = s.getLastRow(), recs = [];
      if (n > 1) s.getRange(2, 1, n - 1, HEAD.length).getValues().forEach(r => { if (Number(r[9]) > since) recs.push(rec_(r)); });
      return out_(Object.assign(info, {records: recs}));
    }
    let [fi, row] = String(P.from).split(':').map(Number);
    if (!(fi >= 0)) fi = 0; if (!(row >= 2)) row = 2;
    if (fi > f.length - 1) { fi = f.length - 1; row = 2; }
    const recs = [];
    while (true) {
      const s = tab_(SpreadsheetApp.openById(f[fi])), n = s.getLastRow();
      if (row <= n) {
        const k = Math.min(PAGE - recs.length, n - row + 1);
        s.getRange(row, 1, k, HEAD.length).getValues().forEach(r => recs.push(rec_(r)));
        row += k;
      }
      if (recs.length >= PAGE) break;
      if (row > n && fi < f.length - 1) { fi++; row = 2; continue; }
      break;
    }
    return out_(Object.assign(info, {records: recs, next: fi + ':' + row, more: recs.length >= PAGE}));
  } catch (err) { return out_({ok: false, error: String(err)}); }
}

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return out_({ok: false, error: 'bad request'}); }
  if (body.action) return out_({ok: true});          // old app versions asked about the photo reader; no longer used
  try { files_(); } catch (err) { return out_({ok: false, error: String(err)}); }   // create the spreadsheet before locking
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(25000);
    const now = Date.now();
    const rows = (body.records || []).filter(r => r && r.id).map(r => [String(r.id), r.gate || '', r.dir || '', r.type || '',
      "'" + String(r.plate || ''), Number(r.t) || 0, r.time || '', Number(r.updated) || 0, r.deleted ? 1 : 0, now, String(r.remarks || '').slice(0, 60)]);   // ' keeps leading zeros (0546)
    if (!rows.length) return out_({ok: true, added: 0, now: now});
    const p = props_(), f = files_();
    let ss = SpreadsheetApp.openById(f[f.length - 1]), s = tab_(ss), n = s.getLastRow();
    if (n - 1 + rows.length > maxRows_()) {             // this spreadsheet is full: start the next one
      ss = SpreadsheetApp.create('Toll Audit Live (' + (f.length + 1) + ')'); s = tab_(ss, true); n = s.getLastRow();
      f.push(ss.getId()); p.setProperty('FILES', JSON.stringify(f));
    }
    const need = n + rows.length, max = s.getMaxRows();
    if (need > max) s.insertRowsAfter(max, Math.max(need - max, 2000));   // grow in blocks
    s.getRange(n + 1, 1, rows.length, HEAD.length).setValues(rows);
    return out_({ok: true, added: rows.length, now: now, files: f.length});
  } catch (err) {
    return out_({ok: false, error: String(err)});
  } finally { try { lock.releaseLock(); } catch (x) {} }
}
