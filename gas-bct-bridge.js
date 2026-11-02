/**
 * ============================================================
 *  GAT Work System — Google Apps Script Backend (BCT Bridge)
 *  ประจำ Google Spreadsheet: BCT (บอร์ดบันทึกรายการตรวจสอบของทีม BU)
 *  รุ่น v1.1 (2 พ.ย. 2569) — เพิ่ม "ข้อเสนอแนะรันเลข" ตามคำสั่งพี่หนึ่ง
 *
 *  วงจรข้อเสนอแนะ (Recommendation / REC):
 *   ① GAT ตรวจจาก Web GAT → ออกข้อเสนอแนะ → ระบบรันเลขอัตโนมัติ GAT-REC-0001, 0002, …
 *   ② ข้อเสนอแนะ = แถวใหม่ในชีท GAT_Issues (สตัตัส "ส่งให้ BU แล้ว")
 *   ③ BU พิจารณาบนชีท (หรือหน้าเว็บ) เลือก:
 *        - "แก้ไข"    → ใส่สถานะ "แก้ไขแล้ว" + แนบ EVIDENCE_URL (หลักฐานการแก้ไข)
 *        - "ไม่แก้ไข" → ใส่สถานะ "ยืนยันไม่แก้ไข" + NO_FIX_REASON (เหตุผล) + RESPONSIBLE (ชื่อผู้รับผิดชอบ)
 *   ④ GAT ตรวจคำตอบ → ปิดรายการ (ป้าย 🔴 ขัดกฎหมาย/จำเป็นจริง = GAT ยืนยันกลับอย่างเป็นทางการตาม SOP ขั้น ⑤)
 *
 *  ติดตั้ง:
 *   1) เปิด Google Sheet BCT → Extensions → Apps Script → วางโค้ดนี้ทั้งไฟล์ → บันทึก
 *   2) รัน setupSheets() หนึ่งครั้ง (สร้าง/ปรับชีทให้ตรงโครง v1.1 อัตโนมัติ)
 *   3) Deploy → New deployment → Web app (Execute as: Me · Access: Anyone)
 *   4) คัดลอก Web app URL (ลงท้าย /exec) → ใส่ในหน้า Web GAT แท็บ BCT
 * ============================================================
 */

var CONFIG = {
  SHEETS: {
    REGISTERS: 'GAT_Registers',   // Master Register: รายการตรวจสอบ/ภาระต้องส่ง
    ENTRIES: 'GAT_Entries',       // รายการบันทึกผลตรวจสอบรายครั้ง (BU กรอก)
    RECS: 'GAT_Issues',           // เก็บชื่อเดิม — ตอนนี้หมายถึง "ใบประเด็น/ข้อเสนอแนะ GAT"
    AUDIT_LOG: 'GAT_AuditLog'     // audit trail ทุกกระทำ
  },
  TZ: 'Asia/Bangkok',
  REC_PREFIX: 'GAT-REC-',
  REC_PAD: 4
};

/* ================= SETUP (รันครั้งเดียว หรือรันใหม่เมื่ออัปเดตโครง) ================= */
function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet(ss, CONFIG.SHEETS.REGISTERS, [
    'REG_ID', 'BU', 'PROCESS_TYPE', 'PROCESS_CODE', 'TITLE', 'REGULATOR',
    'LAW_RULE', 'REQUIREMENT', 'DOCUMENT', 'DUE_DATE', 'FREQUENCY',
    'OWNER', 'COMPLIANCE_REVIEWER', 'LEGAL', 'SIGNATORY', 'STATUS',
    'EVIDENCE', 'SOURCE', 'UPDATED_AT', 'UPDATED_BY'
  ]);
  ensureSheet(ss, CONFIG.SHEETS.ENTRIES, [
    'ENTRY_ID', 'REG_ID', 'ENTRY_DATE', 'BU', 'PROCESS_CODE', 'PERIOD',
    'RESULT', 'SCORE', 'FINDINGS', 'EVIDENCE_URL', 'SUBMITTED_BY', 'SUBMITTED_AT', 'STATUS'
  ]);
  // ข้อเสนอแนะ — รันเลข + การตัดสินของ BU + หลักฐาน/เหตุผล/ผู้รับผิดชอบ
  ensureSheet(ss, CONFIG.SHEETS.RECS, [
    'REC_ID', 'REC_NO', 'CREATED_AT', 'CREATED_BY', 'REG_ID', 'PROCESS_TYPE',
    'PROCESS_CODE', 'SEVERITY', 'TITLE', 'DETAIL', 'SHEET_REF', 'STATUS',
    'BU_DECISION', 'EVIDENCE_URL', 'NO_FIX_REASON', 'RESPONSIBLE',
    'BU_RESPONDED_AT', 'GAT_CONFIRMED_AT', 'CLOSED_AT'
  ]);
  ensureSheet(ss, CONFIG.SHEETS.AUDIT_LOG, ['LOG_ID', 'TIMESTAMP', 'ACTOR', 'ACTION', 'TARGET', 'DETAIL']);
  log_('system', 'setup', 'sheets', 'โครงชีทพร้อม v1.1 (REC รันเลข + BU decision/evidence/reason/responsible)');
  return 'OK: ชีทพร้อมใช้งาน v1.1 — ต่อไป Deploy → Web app';
}

/* โยกย้ายชีทเก่า v1.0 → เพิ่มคอลัมน์ที่ขาดโดยไม่ทำข้อมูลหาย */
function migrateSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  addColumns_(ss, CONFIG.SHEETS.RECS, ['REC_NO', 'CREATED_BY', 'BU_DECISION', 'EVIDENCE_URL', 'NO_FIX_REASON', 'RESPONSIBLE']);
  log_('system', 'migrate', CONFIG.SHEETS.RECS, 'เพิ่มคอลัมน์ v1.1 (ถ้ายังไม่มี)');
  return 'OK';
}

function ensureSheet(ss, name, headers) {
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function addColumns_(ss, sheetName, newHeaders) {
  var sh = ss.getSheetByName(sheetName);
  if (!sh) { ensureSheet(ss, sheetName, newHeaders); return; }
  var existing = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var missing = newHeaders.filter(function (h) { return existing.indexOf(h) < 0; });
  if (missing.length) {
    sh.getRange(1, sh.getLastColumn() + 1, 1, missing.length).setValues([missing]).setFontWeight('bold');
  }
}

/* ================= API: GET (Web GAT ดึงข้อมูล) =================
 * ?action=list_recs   → ข้อเสนอแนะทั้งหมด (พร้อมเลขรัน)
 * ?action=list_registers / list_entries / overview
 */
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'overview';
  try {
    var payload;
    switch (action) {
      case 'list_registers': payload = readAll_(CONFIG.SHEETS.REGISTERS); break;
      case 'list_entries':   payload = readAll_(CONFIG.SHEETS.ENTRIES);   break;
      case 'list_recs':
      case 'list_issues':    payload = readAll_(CONFIG.SHEETS.RECS);      break;
      case 'overview':       payload = overview_();                       break;
      default: throw new Error('unknown action: ' + action);
    }
    return json_({ ok: true, action: action, generatedAt: now_(), data: payload });
  } catch (err) {
    return json_({ ok: false, error: String(err), action: action });
  }
}

/* ================= API: POST (Web GAT / BU) =================
 * body JSON (ส่งด้วย content-type text/plain เพื่อเลี่ยง CORS preflight):
 *  { action:"open_issue", data:{ REG_ID, PROCESS_TYPE, PROCESS_CODE, SEVERITY, TITLE, DETAIL, SHEET_REF, BY } }
 *      → ระบบรันเลข GAT-REC-000n ให้เอง (กันชนกันด้วย LockService)
 *  { action:"respond_issue", data:{ REC_ID, BU_DECISION:"แก้ไข"|"ไม่แก้ไข",
 *        EVIDENCE_URL, NO_FIX_REASON, RESPONSIBLE, BY } }
 *  { action:"close_issue", data:{ REC_ID, BY } }   → GAT ตรวจคำตอบแล้วปิด
 */
function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var action = body.action;
    var data = body.data || {};
    switch (action) {
      case 'open_issue': {
        var lock = LockService.getScriptLock();
        lock.waitLock(10000);
        try {
          var rec = openIssue_(data);
          log_(data.BY || 'GAT', 'open_issue', rec.REC_ID, or_(data.TITLE));
          return json_({ ok: true, REC_ID: rec.REC_ID, REC_NO: rec.REC_NO });
        } finally { lock.releaseLock(); }
      }
      case 'respond_issue': {
        respondIssue_(data);
        log_(data.BY || 'BU', 'respond_issue', or_(data.REC_ID), or_(data.BU_DECISION));
        return json_({ ok: true });
      }
      case 'close_issue': {
        closeIssue_(data);
        log_(data.BY || 'GAT', 'close_issue', or_(data.REC_ID), 'ปิดรายการ');
        return json_({ ok: true });
      }
      default:
        throw new Error('unknown action: ' + action);
    }
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

/* ===== เปิดข้อเสนอแนะใหม่ → รันเลขตามแถวที่มีอยู่จริงบนชีท ===== */
function openIssue_(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.SHEETS.RECS);
  if (!sh) throw new Error('ไม่พบชีท ' + CONFIG.SHEETS.RECS + ' — รัน setupSheets() ก่อน');
  var lastRow = sh.getLastRow();
  var maxNo = 0;
  if (lastRow > 1) {
    var vals = sh.getRange(2, 1, lastRow - 1, 2).getValues(); // REC_ID, REC_NO
    vals.forEach(function (r) { var n = parseInt(r[1], 10); if (!isNaN(n) && n > maxNo) maxNo = n; });
  }
  var no = maxNo + 1;
  var recId = CONFIG.REC_PREFIX + ('0000' + no).slice(-CONFIG.REC_PAD);
  var now = now_();
  var row = [
    recId, no, now, or_(data.BY, 'GAT'), or_(data.REG_ID), or_(data.PROCESS_TYPE),
    or_(data.PROCESS_CODE), or_(data.SEVERITY, '🟢 ข้อเสนอ'), or_(data.TITLE), or_(data.DETAIL),
    or_(data.SHEET_REF), 'ส่งให้ BU แล้ว', '', '', '', '', '', '', ''
  ];
  sh.appendRow(row);
  return { REC_ID: recId, REC_NO: no };
}

/* ===== ใช้จากหน้า Web GAT / CLI: สร้างข้อเสนอแนะ (คืนเลขที่ได้) ===== */
function addIssue(payload) {
  var data = (typeof payload === 'string') ? JSON.parse(payload) : payload;
  var rec = openIssue_(data);
  log_(data.BY || 'GAT', 'add_issue', rec.REC_ID, or_(data.TITLE));
  return rec.REC_ID;
}

/* ===== BU ตอบข้อเสนอแนะ: แก้ไข (แนบหลักฐาน) หรือ ไม่แก้ไข (เหตุผล+ผู้รับผิดชอบ) ===== */
function respondIssue_(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.SHEETS.RECS);
  var pos = findRow_(sh, 'REC_ID', or_(data.REC_ID));
  if (pos < 0) throw new Error('ไม่พบ REC_ID: ' + data.REC_ID);
  var decision = or_(data.BU_DECISION, '');
  var newStatus;
  if (decision.indexOf('แก้') >= 0 && decision.indexOf('ไม่') < 0) {
    newStatus = 'แก้ไขแล้ว (รอ GAT ตรวจหลักฐาน)';
  } else if (decision.indexOf('ไม่แก้') >= 0) {
    newStatus = 'ยืนยันไม่แก้ไข (รอ GAT ยืนยัน)';
    if (!or_(data.NO_FIX_REASON)) throw new Error('ไม่แก้ไขต้องระบุ "เหตุผลการไม่แก้ไข"');
    if (!or_(data.RESPONSIBLE)) throw new Error('ไม่แก้ไขต้องระบุ "ชื่อผู้รับผิดชอบ"');
  } else {
    throw new Error('BU_DECISION ต้องเป็น "แก้ไข" หรือ "ไม่แก้ไข"');
  }
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var ci = function (n) { return headers.indexOf(n) + 1; };
  sh.getRange(pos, ci('BU_DECISION')).setValue(decision);
  sh.getRange(pos, ci('STATUS')).setValue(newStatus);
  if (or_(data.EVIDENCE_URL)) sh.getRange(pos, ci('EVIDENCE_URL')).setValue(data.EVIDENCE_URL);
  if (or_(data.NO_FIX_REASON)) sh.getRange(pos, ci('NO_FIX_REASON')).setValue(data.NO_FIX_REASON);
  if (or_(data.RESPONSIBLE)) sh.getRange(pos, ci('RESPONSIBLE')).setValue(data.RESPONSIBLE);
  sh.getRange(pos, ci('BU_RESPONDED_AT')).setValue(now_());
  return true;
}

/* ===== GAT ปิดรายการหลังตรวจคำตอบ (ขั้น ⑤ ของ SOP) ===== */
function closeIssue_(data) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.RECS);
  var pos = findRow_(sh, 'REC_ID', or_(data.REC_ID));
  if (pos < 0) throw new Error('ไม่พบ REC_ID: ' + data.REC_ID);
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  sh.getRange(pos, headers.indexOf('STATUS') + 1).setValue('ปิดแล้ว (GAT ยืนยัน)');
  sh.getRange(pos, headers.indexOf('GAT_CONFIRMED_AT') + 1).setValue(now_());
  sh.getRange(pos, headers.indexOf('CLOSED_AT') + 1).setValue(now_());
  return true;
}

/* ================= HELPERS ================= */
function findRow_(sh, headerName, value) {
  var lastCol = sh.getLastColumn();
  if (lastCol < 1 || sh.getLastRow() < 2) return -1;
  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  var col = headers.indexOf(headerName);
  if (col < 0) return -1;
  var vals = sh.getRange(2, col + 1, sh.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][0]).trim() === String(value).trim()) return i + 2;
  }
  return -1;
}

function overview_() {
  var regs = readAll_(CONFIG.SHEETS.REGISTERS);
  var ents = readAll_(CONFIG.SHEETS.ENTRIES);
  var recs = readAll_(CONFIG.SHEETS.RECS);
  var byBU = {};
  regs.forEach(function (r) {
    var bu = r.BU || '(ไม่ระบุ)';
    if (!byBU[bu]) byBU[bu] = { registers: 0, onTime: 0, late: 0, open: 0, fixed: 0, refused: 0 };
    byBU[bu].registers++;
  });
  ents.forEach(function (x) {
    var bu = x.BU || '(ไม่ระบุ)';
    if (!byBU[bu]) byBU[bu] = { registers: 0, onTime: 0, late: 0, open: 0, fixed: 0, refused: 0 };
    if (String(x.RESULT).indexOf('ล่าช้า') >= 0) byBU[bu].late++;
    else if (String(x.RESULT).indexOf('ยังไม่ส่ง') < 0) byBU[bu].onTime++;
  });
  recs.forEach(function (x) {
    var bu = '(ไม่ระบุ)';
    for (var i = 0; i < regs.length; i++) {
      if (regs[i].REG_ID === x.REG_ID) { bu = regs[i].BU || bu; break; }
    }
    if (!byBU[bu]) byBU[bu] = { registers: 0, onTime: 0, late: 0, open: 0, fixed: 0, refused: 0 };
    var st = String(x.STATUS || '');
    if (st.indexOf('ปิด') < 0) byBU[bu].open++;
    if (st.indexOf('แก้ไข') === 0) byBU[bu].fixed++;
    if (st.indexOf('ไม่แก้') >= 0) byBU[bu].refused++;
  });
  return { totals: { registers: regs.length, entries: ents.length, recs: recs.length }, byBU: byBU };
}

function readAll_(sheetName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(sheetName);
  if (!sh) throw new Error('ไม่พบชีท ' + sheetName + ' — รัน setupSheets() ก่อน');
  var rows = sh.getDataRange().getValues();
  if (rows.length < 2) return [];
  var headers = rows[0];
  return rows.slice(1).filter(function (r) {
    return String(r[0]).trim() !== '';
  }).map(function (r) {
    var o = {};
    headers.forEach(function (h, i) { o[h] = r[i]; });
    return o;
  });
}

function log_(actor, action, target, detail) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(CONFIG.SHEETS.AUDIT_LOG);
    if (!sh) return;
    sh.appendRow(['LG-' + Date.now(), now_, actor, action, target, detail]);
  } catch (e) { /* log พังไม่ให้กระทบงานหลัก */ }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
function now_() { return Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyy-MM-dd HH:mm:ss'); }
function or_(v, def) { return (v === undefined || v === null || String(v).trim() === '') ? (def || '') : v; }