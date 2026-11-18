// Toll Detour Live Log - Google Apps Script
// Works pasted into a Google Sheet (Extensions > Apps Script) or as a standalone script:
// if there is no sheet, it creates "Toll Audit Live" in your Google Drive and uses it.
const SHEET = 'Log';
const HEAD = ['id','gate','dir','type','plate','time_ms','time','updated','deleted','srv','thumb'];
const MAXTHUMB = 45000; // a Sheets cell holds 50,000 characters at most

function book_() {
  let ss = null;
  try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) {}
  if (ss) return ss;
  const p = PropertiesService.getScriptProperties(), id = p.getProperty('SHEET_ID');
  if (id) { try { return SpreadsheetApp.openById(id); } catch (e) {} }
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const id2 = p.getProperty('SHEET_ID');
    if (id2) { try { return SpreadsheetApp.openById(id2); } catch (e) {} }
    ss = SpreadsheetApp.create('Toll Audit Live');
    p.setProperty('SHEET_ID', ss.getId());
    return ss;
  } finally { lock.releaseLock(); }
}
function sh_() {
  const ss = book_();
  let s = ss.getSheetByName(SHEET);
  if (!s) {
    s = ss.insertSheet(SHEET);
    s.appendRow(HEAD);
    s.setFrozenRows(1);
    s.getRange('A:A').setNumberFormat('@');
    s.getRange('E:E').setNumberFormat('@');
    s.getRange('G:G').setNumberFormat('@');
  }
  return s;
}
function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function doGet(e) {
  try {
    const since = Number((e && e.parameter || {}).since || 0);
    const s = sh_(), n = s.getLastRow(), recs = [];
    if (n > 1) {
      // read only the 'srv' column first, then only the rows that changed since the phone last asked
      const srv = s.getRange(2, 10, n - 1, 1).getValues();
      let first = -1;
      for (let i = 0; i < srv.length; i++) if (Number(srv[i][0]) > since) { first = i; break; }
      if (first >= 0) {
        s.getRange(first + 2, 1, n - 1 - first, HEAD.length).getValues().forEach(r => {
          if (Number(r[9]) > since) recs.push({id:String(r[0]),gate:String(r[1]),dir:String(r[2]),type:String(r[3]),plate:String(r[4]),t:Number(r[5]),
            time:String(r[6]),updated:Number(r[7]),deleted:Number(r[8]),srv:Number(r[9]),thumb:String(r[10]||'')});
        });
      }
    }
    return out_({ok:true, records:recs, now:Date.now(), sheet:book_().getUrl()});
  } catch (err) { return out_({ok:false, error:String(err)}); }
}
// Google's own text recognition (Drive OCR). Needs: Apps Script editor > Services (+) > Drive API > Add.
function ocr_(b64) {
  const blob = Utilities.newBlob(Utilities.base64Decode(b64), 'image/jpeg', 'plate.jpg');
  let id;
  try {        // Drive API v3 (default)
    id = Drive.Files.create({name: 'toll_ocr_tmp', mimeType: 'application/vnd.google-apps.document'}, blob, {ocrLanguage: 'en', fields: 'id'}).id;
  } catch (e3) {   // Drive API v2
    if (!Drive.Files.insert) throw e3;
    id = Drive.Files.insert({title: 'toll_ocr_tmp', mimeType: 'image/jpeg'}, blob, {ocr: true, ocrLanguage: 'en'}).id;
  }
  try { return DocumentApp.openById(id).getBody().getText(); }
  finally { try { Drive.Files.remove(id); } catch (x) { try { DriveApp.getFileById(id).setTrashed(true); } catch (y) {} } }
}
function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return out_({ok:false, error:'bad request'}); }
  if (body.action === 'ocrcheck') return out_({ok:true, drive: typeof Drive !== 'undefined'});
  if (body.action === 'ocr') {
    try { return out_({ok:true, text: ocr_(body.image)}); } catch (err) { return out_({ok:false, error:'ocr: ' + err}); }
  }
  try { book_(); } catch (err) { return out_({ok:false, error:String(err)}); }   // make sure the spreadsheet exists before locking
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(25000);
    const s = sh_(), n = s.getLastRow(), now = Date.now();
    // only the id (A) and updated (H) columns are needed to find existing rows
    const ids = n > 1 ? s.getRange(2, 1, n - 1, 1).getValues() : [], upd = n > 1 ? s.getRange(2, 8, n - 1, 1).getValues() : [];
    const idx = {}; ids.forEach((r, i) => idx[String(r[0])] = i);
    const add = [], addIdx = {}; let changed = 0;
    (body.records || []).forEach(r => {
      if (!r || !r.id) return;
      const id = String(r.id);
      let th = String(r.thumb || ''); if (th.length > MAXTHUMB) th = '';   // never let one photo break the batch
      const row = [id, r.gate || '', r.dir || '', r.type || '', String(r.plate || ''), Number(r.t) || 0, r.time || '',
                   Number(r.updated) || 0, r.deleted ? 1 : 0, now, th];
      if (id in idx) {                       // already in the sheet: replace only if newer
        const i = idx[id];
        if (row[7] > Number(upd[i][0])) {
          if (th) s.getRange(i + 2, 1, 1, HEAD.length).setValues([row]);          // with photo
          else s.getRange(i + 2, 1, 1, HEAD.length - 1).setValues([row.slice(0, -1)]);  // keep the stored photo
          upd[i] = [row[7]]; changed++;
        }
      } else if (id in addIdx) {             // same id twice in one upload: keep the newer copy
        const k = addIdx[id];
        if (row[7] > add[k][7]) { if (!th) row[10] = add[k][10]; add[k] = row; }
      } else { addIdx[id] = add.length; add.push(row); }
    });
    if (add.length) s.getRange(n + 1, 1, add.length, HEAD.length).setValues(add);
    return out_({ok:true, added:add.length, changed:changed, now:now});
  } catch (err) {
    return out_({ok:false, error:String(err)});
  } finally { try { lock.releaseLock(); } catch (x) {} }
}
