// Toll Detour Live Log - Google Apps Script (paste into Extensions > Apps Script of a Google Sheet)
const SHEET = 'Log';
const HEAD = ['id','gate','dir','type','plate','time_ms','time','updated','deleted','srv','thumb'];
const MAXTHUMB = 45000; // a Sheets cell holds 50,000 characters at most

function sh_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
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
      s.getRange(2, 1, n - 1, HEAD.length).getValues().forEach(r => {
        if (Number(r[9]) > since) recs.push({id:String(r[0]),gate:String(r[1]),dir:String(r[2]),type:String(r[3]),plate:String(r[4]),t:Number(r[5]),
          time:String(r[6]),updated:Number(r[7]),deleted:Number(r[8]),srv:Number(r[9]),thumb:String(r[10]||'')});
      });
    }
    return out_({ok:true, records:recs, now:Date.now()});
  } catch (err) { return out_({ok:false, error:String(err)}); }
}
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(25000);
    const body = JSON.parse(e.postData.contents), s = sh_(), n = s.getLastRow(), now = Date.now();
    const old = n > 1 ? s.getRange(2, 1, n - 1, HEAD.length).getValues() : [];
    const idx = {}; old.forEach((r, i) => idx[String(r[0])] = i);
    const add = [], addIdx = {}; let changed = 0;
    (body.records || []).forEach(r => {
      if (!r || !r.id) return;
      const id = String(r.id);
      let th = String(r.thumb || ''); if (th.length > MAXTHUMB) th = '';   // never let one photo break the batch
      const row = [id, r.gate || '', r.dir || '', r.type || '', String(r.plate || ''), Number(r.t) || 0, r.time || '',
                   Number(r.updated) || 0, r.deleted ? 1 : 0, now, th];
      if (id in idx) {                       // already in the sheet: replace only if newer
        const i = idx[id];
        if (row[7] > Number(old[i][7])) {
          if (!th) row[10] = old[i][10];     // keep the stored photo if none was sent
          s.getRange(i + 2, 1, 1, HEAD.length).setValues([row]); old[i] = row; changed++;
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
