/**
 * ============================================================
 *  GAT Work System — Google Apps Script Backend (BCT Bridge)
 *  ประจำ Google Spreadsheet: BCT (บอร์ดบันทึกรายการตรวจสอบของทีม BU)
 *  รุ่น v1.7.1 (5 พ.ย. 2569) — เพิ่ม 10 แท็บตามกระบวนการ 10 ขั้น (แท็บ ①ดึงแผน…⑩ผลงาน ประจำชีท) + setupProcessTabs() + tabs_status + auto-sync ①⑥⑩ — actions เดิม v1.6 ครบทุกข้อ
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
  VERSION: 'v1.7.1 (10 พ.ย. 69) — เพิ่มแท็บกระบวนการ 10 ขั้น (setupProcessTabs) + sync_process_tabs + tabs_status — เดิม v1.6 ครบ',
  SHEETS: {
    REGISTERS: 'GAT_Registers',   // Master Register: รายการตรวจสอบ/ภาระต้องส่ง
    ENTRIES: 'GAT_Entries',       // รายการบันทึกผลตรวจสอบรายครั้ง (BU กรอก)
    RECS: 'GAT_Issues',           // เก็บชื่อเดิม — ตอนนี้หมายถึง "ใบประเด็น/ข้อเสนอแนะ GAT"
    AUDIT_LOG: 'GAT_AuditLog',    // audit trail ทุกกระทำ
    PACKS: 'GAT_Packs',           // v1.5 — ข้อมูลที่ BU ส่งเพื่อเข้ารับการตรวจ (Pack)
    PLANS: 'GAT_Plans',           // v1.6 — แผนแจ้งเรื่องที่จะตรวจ (ปุ่มดันจากแท็บ 1)
    DTA: 'GAT_DTA',               // v1.6 — รายงานวัดผล DTA รายสัปดาห์ (ปุ่มดันจากแท็บ 10)
    P1: 'จุด1-แจ้งเรื่องตรวจ', P2: 'จุด2-รอBUส่งข้อมูล', P3: 'จุด3-เลือกหัวข้อตรวจ',
    P4: 'จุด4-ชุดคำสั่งAI', P5: 'จุด5-ผลตรวจAI', P6: 'จุด6-ใบRECส่งBU',
    P7: 'จุด7-BUแก้ไข', P8: 'จุด8-BUตอบในระบบ', P9: 'จุด9-GATปิดประเด็น', P10: 'จุด10-สรุปผล' // v1.7 — 10 แท็บกระบวนการ
  },
TZ: 'Asia/Bangkok',
  SHEET_ID: '1MK4ufs2ycbJg81ZVaqeJb0z3MEaflAMVZmKqmhkrZ1E',  // ชีต BCT กลาง — standalone deploy ชี้มาที่นี่
  REC_PREFIX: 'GAT-REC-',
  REC_PAD: 4
};

/* ================= เมนูในชีท (onOpen — แสดงเมื่อเปิดชีทครั้งแรก) ================= */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🛡 GAT')
        .addItem('⚙ ตั้งค่าโครงชีท (setupSheets)', 'setupSheets')
    .addItem('🔄 migrateSheets (ชีทเก่า → v1.1)', 'migrateSheets')
    .addSeparator()
    .addItem('🆕 ตั้งค่า 10 แท็บกระบวนการ (setupProcessTabs)', 'setupProcessTabs')
    .addItem('🔄 อัปเดต 10 แท็บกระบวนการ (updateProcessTabs)', 'updateProcessTabs')
    .addToUi();
}

/* ===== ล้างแถวทดสอบ REC-0016–0019 (เก็บ 0020 = หลักฐานวงจรทดสอบที่ผ่านครบ) =====
 * ลบทั้งแถว → ชีทเหลือ 15 ใบ seed + 0020; ช่องว่างแถวที่ลบถูกปิดด้วยการลบแบบ row เต็ม
 */
function cleanTestRows() {
  cleanRecRange_('GAT-REC-0016', 'GAT-REC-0019');
  try { SpreadsheetApp.getUi().alert('ล้างแถวทดสอบ REC-0016–0019 เรียบร้อย (ชีทเหลือ seed 15 ใบ + REC-0020)'); } catch (e) {}
}

/* ===== ล้างแบบระบุช่วงเอง (เช่น GAT-REC-0016 ถึง GAT-REC-0026) ===== */
function cleanTestRowsPrompt() {
  var ui = SpreadsheetApp.getUi();
  var res = ui.prompt('ล้างแถวทดสอบ', 'พิมพ์ช่วงเลข REC ที่จะลบ (เช่น: 0016-0019):', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  var m = String(res.getResponseText()).trim().match(/^(\d{4})\s*-\s*(\d{4})$/);
  if (!m) { try { ui.alert('รูปแบบไม่ถูก — ต้องเป็น 0016-0019'); } catch (e) {} return; }
  cleanRecRange_(CONFIG.REC_PREFIX + m[1], CONFIG.REC_PREFIX + m[2]);
  try { ui.alert('ล้างแล้ว: ' + CONFIG.REC_PREFIX + m[1] + ' ถึง ' + CONFIG.REC_PREFIX + m[2]); } catch (e) {}
}

function cleanRecRange_(fromId, toId) {
  var sh = getSS_().getSheetByName(CONFIG.SHEETS.RECS);
  if (!sh) throw new Error('ไม่พบชีท ' + CONFIG.SHEETS.RECS);
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return 0;
  var vals = sh.getRange(2, 1, lastRow - 1, 1).getValues(); // REC_ID คอลัมน์ A
  var f = fromId.replace('GAT-REC-', ''), t = toId.replace('GAT-REC-', '');
  var del = [];
  for (var i = 0; i < vals.length; i++) {
    var v = String(vals[i][0]).replace(CONFIG.REC_PREFIX, '');
    if (v !== '' && v >= f && v <= t) del.push(i + 2);
  }
  for (var d = del.length - 1; d >= 0; d--) sh.deleteRow(del[d]);
  log_('GAT(แดง)', 'clean_test_rows', fromId + '..' + toId, 'ลบแถวทดสอบ ' + del.length + ' แถว');
  return del.length;
}

/* ================= SETUP (รันครั้งเดียว หรือรันใหม่เมื่ออัปเดตโครง) ================= */
/* v1.5.2 — บังคับชีตกลางตาม SHEET_ID เสมอ — กันกรณี script bound กับชีตอื่นแล้วเผลอเขียนผิดชีต
 * (เหตุจริง 4 พ.ย. 69: deploy ใหม่ bound กับชีตอื่น → Packs ไปเกิดในชีตผิด — แก้โดยชี้ตรง)
 */
function getSS_() {
  var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  return ss;
}

function setupSheets() {
  var ss = getSS_();
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
  // v1.5 — แท็บข้อมูลที่ BU ส่งเพื่อเข้ารับการตรวจ (1 pack = 1 แถว)
  ensureSheet(ss, CONFIG.SHEETS.PACKS, [
    'PACK_ID', 'BU', 'SCOPE', 'PERIOD', 'TITLE', 'LINKS', 'NOTE', 'STATUS', 'CREATED_BY', 'CREATED_AT', 'AI_REVIEW_AT', 'AI_NOTE', 'ITEM'
  ]);
  // ข้อเสนอแนะ — รันเลข + การตัดสินของ BU + หลักฐาน/เหตุผล/ผู้รับผิดชอบ + FM มาตรฐาน 11 ช่อง (REF_PM_WI/ผู้อนุมัติ)
  ensureSheet(ss, CONFIG.SHEETS.RECS, [
    'REC_ID', 'REC_NO', 'CREATED_AT', 'CREATED_BY', 'REG_ID', 'PROCESS_TYPE',
    'PROCESS_CODE', 'SEVERITY', 'TITLE', 'DETAIL', 'SHEET_REF', 'REF_PM_WI', 'APPROVER', 'STATUS',
    'BU_DECISION', 'EVIDENCE_URL', 'NO_FIX_REASON', 'RESPONSIBLE',
    'BU_RESPONDED_AT', 'GAT_CONFIRMED_AT', 'CLOSED_AT'
  ]);
  ensureSheet(ss, CONFIG.SHEETS.AUDIT_LOG, ['LOG_ID', 'TIMESTAMP', 'ACTOR', 'ACTION', 'TARGET', 'DETAIL']);
  log_('system', 'setup', 'sheets', 'โครงชีทพร้อม v1.1 (REC รันเลข + BU decision/evidence/reason/responsible)');
  return 'OK: ชีทพร้อมใช้งาน v1.1 — ต่อไป Deploy → Web app';
}

/* โยกย้ายชีทเก่า v1.0 → เพิ่มคอลัมน์ที่ขาดโดยไม่ทำข้อมูลหาย */
function migrateSheets() {
  var ss = getSS_();
  addColumns_(ss, CONFIG.SHEETS.RECS, ['REC_NO', 'CREATED_BY', 'BU_DECISION', 'EVIDENCE_URL', 'NO_FIX_REASON', 'RESPONSIBLE', 'REF_PM_WI', 'APPROVER']);
  addColumns_(ss, CONFIG.SHEETS.PACKS, ['ITEM']);
  log_('system', 'migrate', CONFIG.SHEETS.RECS, 'เพิ่มคอลัมน์ v1.1 + FM 11 ช่อง: REF_PM_WI + APPROVER (ถ้ายังไม่มี)');
  // v1.5 — ensure แท็บ Packs (ถ้ายังไม่มี)
  var pk = ensureSheet(ss, CONFIG.SHEETS.PACKS, ['PACK_ID', 'BU', 'SCOPE', 'PERIOD', 'TITLE', 'LINKS', 'NOTE', 'STATUS', 'CREATED_BY', 'CREATED_AT', 'AI_REVIEW_AT', 'AI_NOTE']);
  log_('system', 'migrate', CONFIG.SHEETS.PACKS, 'v1.5: เตรียมแท็บ GAT_Packs (BU ส่งข้อมูลเพื่อเข้ารับการตรวจ)');
  var tabs = setupProcessTabs();
  log_('system', 'migrate', 'process_tabs', 'v1.7: เตรียมแท็บกระบวนการ 10 ขั้น เรียบร้อย');
  return 'OK + Packs(ITEM คอลัมน์ 13) + แท็บ10ขั้น ' + tabs;
}


/* ================= v1.7: 10 แท็บกระบวนการ 10 ขั้น (เมนู 🛡 GAT → ตั้ง 10 แท็บ) =================
 * หลักการ: ข้อมูลจริงอยู่ในตารางแม่ (GAT_Plans/GAT_Packs/GAT_Issues) ตามเดิม — 10 แท็บนี้ = "กระจกสถานะ" ต่อขั้น
 * อัปเดตด้วย: ①เมนูชีท "🛡 GAT → 🔄 อัปเดต 10 แท็บกระบวนการ" (ดนี้) ②เว็บกดดัน sync_process_tabs ③เมื่อ setupProcessTabs/setupSheets
 * idempotent: เขียนทับช่วงข้อมูลทั้งช่วงทุกครั้ง — header บรรทัด 2–4 = คำอธิบายขั้น คงเดิม
 * แถวที่ว่าง (จัดแล้วเกิน) จะถูกเคลียร์เป็น "" — ไม่ลบแถว (รักษา formatting)
 */
var PROCESS_STEPS_ = [
  { no: 1, key: 'P1', name: '① แจ้งเรื่อง/ประเด็น (แผนจากแท็บ 1)', src: 'GAT_Plans', headers: ['STEP', 'NOTIF_ID', 'BU', 'PERIOD', 'ITEMS', 'N_ITEMS', 'STATUS'],
    note: 'ขั้น ① GAT แจ้ง BU เรื่องที่จะตรวจ — ที่มา: ปุ่ม ☁️ ดันชีต (แท็บ 1 เว็บ) → GAT_Plans' },
  { no: 2, key: 'P2', name: '② BU ส่งข้อมูล (Pack)', src: 'GAT_Packs', headers: ['STEP', 'PACK_ID', 'BU', 'SCOPE', 'PERIOD', 'TITLE', 'STATUS'],
    note: 'ขั้น ② BU ส่งหลักฐานเข้าระบบ รันเลข PACK-xxxx — SLA 3 วันทำการ — ที่มา: แท็บ 📤 BU ส่งข้อมูล (เว็บ)' },
  { no: 3, key: 'P3', name: '③ เลือกหัวข้อตรวจ', src: 'GAT_Packs', headers: ['STEP', 'PACK_ID', 'BU', 'SCOPE', 'PERIOD', 'TITLE', 'STATUS'],
    note: 'ขั้น ③ GAT เลือก Pack ที่จะตรวจ — ที่มา: แท็บ 🤖 AI Review (เว็บ)' },
  { no: 4, key: 'P4', name: '④ ชุดคำสั่ง AI (กติกา 6 ข้อ)', src: 'GAT_Packs', headers: ['STEP', 'PACK_ID', 'BU', 'TITLE', 'STATUS'],
    note: 'ขั้น ④ GAT กด "สร้างชุดคำสั่ง AI" + ตัดใบจากคำตอบ AI — ที่มา: แท็บ 🤖 AI Review (เว็บ)' },
  { no: 5, key: 'P5', name: '⑤ ผลตรวจ AI → ร่างใบ', src: 'GAT_Issues', headers: ['STEP', 'REC_ID', 'SEVERITY', 'TITLE', 'STATUS'],
    note: 'ขั้น ⑤ AI ออกผลตรวจ เป็นร่างใบข้อเสนอแนะ (REC) — ที่มา: คำตอบ AI ที่วางในแท็บ 🤖 (เว็บ)' },
  { no: 6, key: 'P6', name: '⑥ GAT คัดใบ → ออกใบส่ง BU', src: 'GAT_Issues', headers: ['STEP', 'REC_ID', 'SEVERITY', 'TITLE', 'STATUS'],
    note: 'ขั้น ⑥ คัดเฉพาะใบหลักฐานครบ → รันเลข GAT-REC-xxxx → ส่งให้ BU (สถานะ "ส่งให้ BU แล้ว")' },
  { no: 7, key: 'P7', name: '⑦ BU แก้ไข (นอกระบบ)', src: 'GAT_Issues', headers: ['STEP', 'REC_ID', 'BU_DECISION', 'EVIDENCE_URL', 'NO_FIX_REASON', 'RESPONSIBLE', 'STATUS'],
    note: 'ขั้น ⑦ BU นำใบไปแก้จริงในหน่วย/สะสมหลักฐาน — ขั้นนี้ offline (ไม่มีแถวในชีต = รายการของขั้น ⑥ ยังไม่ตอบ)' },
  { no: 8, key: 'P8', name: '⑧ BU ตอบในระบบ', src: 'GAT_Issues', headers: ['STEP', 'REC_ID', 'BU_DECISION', 'EVIDENCE_URL', 'NO_FIX_REASON', 'RESPONSIBLE', 'STATUS'],
    note: 'ขั้น ⑧ BU ตอบ "แก้ไข+หลักฐาน" หรือ "ไม่แก้ไข+เหตุผล+ผู้รับผิดชอบ" — ที่มา: แท็บ 🧾 (เว็บ) กล่อง ② BU พิจารณา' },
  { no: 9, key: 'P9', name: '⑨ GAT ปิดประเด็น', src: 'GAT_Issues', headers: ['STEP', 'REC_ID', 'TITLE', 'STATUS'],
    note: 'ขั้น ⑨ GAT ตรวจคำตอบแล้วยืนยันปิด (สิทธิ์อุทธรณ์ 7 วันทำการ) — ที่มา: แท็บ 🧾 กล่อง ③ (เว็บ)' },
  { no: 10, key: 'P10', name: '⑩ สรุปผล/รายงานวัดผล', src: 'GAT_DTA', headers: ['STEP', 'WEEK', 'PURPOSE', 'OBJ_P', 'KR1_P', 'KR2_P', 'KR3_P', 'SAVED_AT'],
    note: 'ขั้น ⑩ สรุปผลงาน + รายงานวัดผล DTA ทุกศุกร์ — ที่มา: แท็บ 10 (เว็บ) ปุ่ม ☁️ ดันชีต → GAT_DTA' }
];

/* สร้าง/ปรับ 10 แท็บครบ — ไม่มีข้อมูลจริง (เรียกบ่อยได้ ไม่ทำข้อมูลหาย) */
function setupProcessTabs() {
  var ss = getSS_();
  var made = 0;
  PROCESS_STEPS_.forEach(function (st) {
    var sh = ensureSheetWithHeaders_(ss, CONFIG.SHEETS[st.key], ['ขั้น', 'รายการ', 'หมายเหตุ']);
    // บรรทัด 2–4 = คำอธิบายฟิกซ์
    sh.getRange(2, 1, 3, 3).setValues([
      ['ขั้น' + st.no, st.name, st.note],
      ['ที่มาข้อมูล', 'ตารางแม่: ' + st.src, 'แท็บนี้ = กระจกสถานะ (Mirror) — ตามหลัก 1 source of truth'],
      ['จุดใช้งาน', 'เว็บ GAT https://pkggatassistant-del.github.io/gat-work-system/', 'อัปเดต: เมนู 🛡 GAT → 🔄 อัปเดต 10 แท็บ / เว็บปุ่มดัน']
    ]);
    made++;
  });
  return 'OK: แท็บกระบวนการพร้อม ' + made + '/10 แท็บ (เรียก updateProcessTabs เพื่อดันข้อมูล)';
}

/* ดันข้อมูลเข้าแท็บขั้นเดียว — append แถวใหม่ (KEY = ชื่อคอลัมน์, ค่า KEY ที่ไม่ซ้ำ) */
var KEY_BY_STEP_ = { 1: 'NOTIF_ID', 2: 'PACK_ID', 3: 'PACK_ID', 4: 'PACK_ID',
  5: 'REC_ID', 6: 'REC_ID', 7: 'REC_ID', 8: 'REC_ID', 9: 'REC_ID', 10: 'WEEK' };
function appendProcessRow_(stepNo, rowObj) {
  var st = PROCESS_STEPS_[stepNo - 1];
  if (!st) throw new Error('step ต้องเป็น 1–10');
  var keyCol = KEY_BY_STEP_[stepNo];
  var keyVal = rowObj[keyCol];
  if (!keyVal) throw new Error('ขาด ' + keyCol + ' สำหรับแท็บขั้น ' + stepNo);
  var ss = getSS_();
  var sh = ensureSheetWithHeaders_(ss, CONFIG.SHEETS[st.key], ['ขั้น', 'รายการ', 'หมายเหตุ']);
  var rowData = ['ขั้น' + st.no, String(keyVal), rowObj.DETAIL || ''].concat(
    st.headers.filter(function (h) { return h !== 'STEP'; }).map(function (h) { return rowObj[h] != null ? String(rowObj[h]) : ''; })
  );
  // กันซ้ำ: มี KEY นี้ในแท็บแล้ว = update ทับ
  var pos = findRowByC1_(sh, String(keyVal));
  if (pos > 0) {
    sh.getRange(pos, 1, 1, rowData.length).setValues([rowData]);
    return 'updated';
  }
  sh.appendRow(rowData);
  return 'appended';
}
/* หาแถวจากคอลัมน์ B (ค่า KEY) */
function findRowByC1_(sh, keyVal) {
  var last = sh.getLastRow();
  if (last < 5) return -1;
  var vals = sh.getRange(5, 2, last - 4, 1).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][0]).trim() === String(keyVal).trim()) return i + 5;
  }
  return -1;
}

function syncProcessTabs_(rows) {
  var counts = {};
  PROCESS_STEPS_.forEach(function (st) { counts[st.key] = 0; });
  rows.forEach(function (r) {
    var step = parseInt(r.STEP, 10);
    if (!isNaN(step) && step >= 1 && step <= 10) {
      appendProcessRow_(step, r);
      counts[PROCESS_STEPS_[step - 1].key]++;
    }
  });
  return counts;
}

/* อัปเดตครบทั้ง 10 แท็บจากตารางแม่ — เมนู 🛡 GAT → 🔄 อัปเดต 10 แท็บกระบวนการ */
function updateProcessTabs() {
  var ss = getSS_();
  var plans = safeRead_(ss, CONFIG.SHEETS.PLANS);
  var packs = safeRead_(ss, CONFIG.SHEETS.PACKS);
  var recs  = safeRead_(ss, CONFIG.SHEETS.RECS);
  var dta   = safeRead_(ss, CONFIG.SHEETS.DTA);
  var n = { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0, P6: 0, P7: 0, P8: 0, P9: 0, P10: 0 };
  plans.forEach(function (p) {
    appendProcessRow_(1, { NOTIF_ID: p.NOTIF_ID, BU: p.BU, PERIOD: p.PERIOD, ITEMS: p.ITEMS, N_ITEMS: p.N_ITEMS, STATUS: '✅ แจ้งแล้ว' }); n.P1++;
  });
  packs.forEach(function (p) {
    var stP = String(p.STATUS || '');
    appendProcessRow_(2, { PACK_ID: p.PACK_ID, BU: p.BU, SCOPE: p.SCOPE, PERIOD: p.PERIOD, TITLE: p.TITLE + (p.ITEM ? ' — ตามประเด็น: ' + p.ITEM : ''), STATUS: stP }); n.P2++;
    // v1.7.1 — ขั้น ③ = เฉพาะ PACK ที่ส่ง "ตามประเด็นจากขั้น ①" (มี ITEM)
    if (p.ITEM) {
      appendProcessRow_(3, { PACK_ID: p.PACK_ID, DETAIL: 'ส่งตามประเด็น: ' + p.ITEM + ' — ' + (p.TITLE || ''), STATUS: stP });
    }
    appendProcessRow_(4, { PACK_ID: 'แท็บ4→' + p.PACK_ID, DETAIL: 'หัวเรื่องที่ AI จะตรวจ: ' + (p.TITLE || ''), STATUS: stP });
  });
  recs.forEach(function (r) {
    var st = String(r.STATUS || '');
    var isClosed = st.indexOf('ปิดแล้ว') >= 0;
    var isResp = st.indexOf('แก้ไขแล้ว') >= 0 || st.indexOf('ไม่แก้ไข') >= 0;
    appendProcessRow_(6, { REC_ID: r.REC_ID, SEVERITY: r.SEVERITY, TITLE: r.TITLE, STATUS: st });
    appendProcessRow_(5, { REC_ID: 'แท็บ5→' + r.REC_ID, DETAIL: '(ผลตรวจ AI → ร่างใบ ' + r.REC_ID + ')', STATUS: isClosed ? 'เสร็จ' : 'กำลังดำเนินการ' });
    if (!isResp) {
      appendProcessRow_(7, { REC_ID: 'แท็บ7→' + r.REC_ID, DETAIL: 'ยังไม่มีคำตอบจาก BU — อยู่ขั้น ⑦ (BU นำไปแก้/พิจารณา)', STATUS: st });
    } else {
      appendProcessRow_(8, { REC_ID: r.REC_ID, BU_DECISION: r.BU_DECISION, EVIDENCE_URL: r.EVIDENCE_URL, NO_FIX_REASON: r.NO_FIX_REASON, RESPONSIBLE: r.RESPONSIBLE, STATUS: st });
      appendProcessRow_(7, { REC_ID: 'แท็บ7→' + r.REC_ID, DETAIL: 'BU ตอบแล้ว (ดูขั้น ⑧)', STATUS: 'เสร็จ' });
    }
    if (!isClosed) {
      appendProcessRow_(9, { REC_ID: 'แท็บ9→' + r.REC_ID, DETAIL: 'ยังไม่ปิด —' + st, STATUS: st });
    } else {
      appendProcessRow_(9, { REC_ID: 'แท็บ9→' + r.REC_ID, DETAIL: '✅ ' + st, STATUS: st });
    }
  });
  dta.forEach(function (w) {
    appendProcessRow_(10, { WEEK: w.WEEK, PURPOSE: w.PURPOSE, OBJ_P: w.OBJ_P, KR1_P: w.KR1_P, KR2_P: w.KR2_P, KR3_P: w.KR3_P, SAVED_AT: w.SAVED_AT, STATUS: 'รายงานแล้ว' }); n.P10++;
  });
  return { saved: n };
}

function buildTabsStatus_() {
  var ss = getSS_();
  return PROCESS_STEPS_.map(function (st) {
    var sh = ss.getSheetByName(CONFIG.SHEETS[st.key]);
    var cnt = 0;
    if (sh && sh.getLastRow() >= 5) cnt = sh.getLastRow() - 4;
    return { step: st.no, tab: CONFIG.SHEETS[st.key], source: st.src, rows: cnt };
  });
}

function safeRead_(ss, name) {
  try { return readAll_(name); } catch (e) { return []; }
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
      case 'list_packs':     payload = readAll_(CONFIG.SHEETS.PACKS); break;
      case 'list_entries':   payload = readAll_(CONFIG.SHEETS.ENTRIES);   break;
      case 'list_recs':
      case 'list_issues':    payload = readAll_(CONFIG.SHEETS.RECS);      break;
      case 'list_plans':     payload = readAll_(CONFIG.SHEETS.PLANS); break;   // v1.6
      case 'list_dta':       payload = readAll_(CONFIG.SHEETS.DTA); break;     // v1.6
      case 'tabs_status':    payload = buildTabsStatus_(); break;              // v1.7
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
      case 'clean_recs': {
        var nDeleted = cleanRecRange_(CONFIG.REC_PREFIX + String(data.from), CONFIG.REC_PREFIX + String(data.to));
        return json_({ ok: true, deleted: nDeleted });
      }
      case 'backfill_ref_pm_wi': {
        var nFilled = backfillRefPmWi_(data.REF || 'P-04 ขั้น ④ (ตาม WI-02)');
        return json_({ ok: true, filled: nFilled });
      }
      case 'fix_log_timestamps': {
        var nFixed = fixLogTimestamps_(data.NOTE || '2 พ.ย. 69 (แก้ย้อนหลัง — ค่าเดิมเสียจากบั๊ก v1.2)');
        return json_({ ok: true, fixed: nFixed });
      }
      case 'submit_pack': {
        var lock2 = LockService.getScriptLock();
        lock2.waitLock(10000);
        try {
          var pk = submitPack_(data);
          log_(data.BY || 'BU', 'submit_pack', pk.PACK_ID, or_(data.TITLE));
          return json_({ ok: true, PACK_ID: pk.PACK_ID });
        } finally { lock2.releaseLock(); }
      }
      case 'update_pack_status': {
        var lock3 = LockService.getScriptLock();
        lock3.waitLock(10000);
        try {
          var nUpd = updatePackStatus_(data);
          log_(data.BY || 'GAT', 'update_pack_status', or_(data.PACK_ID), or_(data.STATUS));
          return json_({ ok: true, updated: nUpd });
        } finally { lock3.releaseLock(); }
      }
      case 'push_plans': { // v1.6 — ดันแผนแจ้งจากแท็บ 1 ลง GAT_Plans (idempotent ตาม NOTIF_ID)
        var lockP = LockService.getScriptLock(); lockP.waitLock(10000);
        try {
          var rows = data.rows || [];
          var outP = { saved: 0, updated: 0 };
          for (var pi = 0; pi < rows.length; pi++) {
            var rp = pushPlanRow_(rows[pi]);
            outP.saved++; if (rp === 'updated') outP.updated++;
          }
          log_(data.BY || 'GAT', 'push_plans', rows.map(function (x) { return x.NOTIF_ID; }).join(','), outP.saved + ' แผน');
          return json_({ ok: true, saved: outP.saved, updated: outP.updated });
        } finally { lockP.releaseLock(); }
      }
      case 'push_dta': { // v1.6 — ดันรายงานวัดผลจากแท็บ 10 ลง GAT_DTA (idempotent ตาม WEEK)
        var lockD = LockService.getScriptLock(); lockD.waitLock(10000);
        try {
          var modeD = pushDtaRow_(data.row || {});
          log_(data.BY || 'GAT', 'push_dta', or_(data.row && data.row.weekLabel), modeD);
          return json_({ ok: true, mode: modeD });
        } finally { lockD.releaseLock(); }
      }
      case 'sync_process_tabs': { // v1.7 — ดันแถวลง 10 แท็บกระบวนการตาม STEP
        var lockS = LockService.getScriptLock(); lockS.waitLock(10000);
        try {
          var outS = syncProcessTabs_(data.rows || []);
          log_(data.BY || 'GAT', 'sync_process_tabs', (data.rows || []).length + ' แถว', JSON.stringify(outS));
          return json_({ ok: true, counts: outS });
        } finally { lockS.releaseLock(); }
      }
      case 'migrate':
        return json_({ ok: true, result: migrateSheets() });
      case 'ping':
        return json_({ ok: true, version: CONFIG.VERSION || 'v1.6', actions: 'open_issue,respond_issue,close_issue,submit_pack,update_pack_status,migrate,ping,clean_recs,backfill_ref_pm_wi,fix_log_timestamps,push_plans,push_dta,tabs_status,sync_process_tabs,setupProcessTabs,list_plans,list_dta' });
      default:
        throw new Error('unknown action: ' + action);
    }
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

/* ===== เปิดข้อเสนอแนะใหม่ → รันเลขตามแถวที่มีอยู่จริงบนชีท ===== */
function openIssue_(data) {
  var ss = getSS_();
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
    or_(data.SHEET_REF), or_(data.REF_PM_WI, 'P-04 ขั้น ④ (ตาม WI-02)'), or_(data.APPROVER), 'ส่งให้ BU แล้ว', '', '', '', '', '', '', ''
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
  var ss = getSS_();
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
  var sh = getSS_().getSheetByName(CONFIG.SHEETS.RECS);
  var pos = findRow_(sh, 'REC_ID', or_(data.REC_ID));
  if (pos < 0) throw new Error('ไม่พบ REC_ID: ' + data.REC_ID);
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  sh.getRange(pos, headers.indexOf('STATUS') + 1).setValue('ปิดแล้ว (GAT ยืนยัน)');
  sh.getRange(pos, headers.indexOf('GAT_CONFIRMED_AT') + 1).setValue(now_());
  sh.getRange(pos, headers.indexOf('CLOSED_AT') + 1).setValue(now_());
  return true;
}

/* ===== v1.4 (GAT(แดง) 3 พ.ย. 69): บำรุงรักษาทางไกล ===== */
/* เติม REF_PM_WI ให้แถวเก่าที่ว่าง (หลัง migrate เพิ่มคอลัมน์) */
function backfillRefPmWi_(ref) {
  var ss = getSS_();
  var sh = ss.getSheetByName(CONFIG.SHEETS.RECS);
  if (!sh) throw new Error('ไม่พบชีท ' + CONFIG.SHEETS.RECS);
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var ciRef = headers.indexOf('REF_PM_WI');
  if (ciRef < 0) throw new Error('ยังไม่มีคอลัมน์ REF_PM_WI — รัน migrate ก่อน');
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return 0;
  var vals = sh.getRange(2, ciRef + 1, lastRow - 1, 1).getValues();
  var filled = 0;
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][0]).trim() === '') {
      sh.getRange(i + 2, ciRef + 1).setValue(ref);
      filled++;
    }
  }
  log_('GAT(แดง)', 'backfill_ref_pm_wi', CONFIG.SHEETS.RECS, 'เติม REF_PM_WI ' + filled + ' แถว = ' + ref);
  return filled;
}

/* แก้ TIMESTAMP ใน GAT_AuditLog ที่เสียจากบั๊ก v1.2 (ค่าเป็นข้อความโค้ด) — ระบุหมายเหตุ ไม่ปลอมเวลา */
function fixLogTimestamps_(note) {
  var ss = getSS_();
  var sh = ss.getSheetByName(CONFIG.SHEETS.AUDIT_LOG);
  if (!sh) return 0;
  var rows = sh.getDataRange().getValues();
  var fixed = 0;
  for (var i = 1; i < rows.length; i++) {
    var v = String(rows[i][1] || '');
    if (v.indexOf('function now_') >= 0 || v.trim() === '') {
      sh.getRange(i + 1, 2).setValue(note);
      fixed++;
    }
  }
  log_('GAT(แดง)', 'fix_log_timestamps', CONFIG.SHEETS.AUDIT_LOG, 'แก้ TIMESTAMP เสีย ' + fixed + ' แถว');
  return fixed;
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


/* ================= v1.6: ดันข้อมูลจากเว็บลงชีต (GAT_Plans + GAT_DTA) ================= */
function ensureSheetWithHeaders_(ss, name, headers) {
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  for (var i = 0; i < headers.length; i++) {
    var cur = sh.getRange(1, i + 1).getValue();
    if (String(cur || '') !== headers[i]) sh.getRange(1, i + 1).setValue(headers[i]);
  }
  try { sh.setFrozenRows(1); } catch (e) {}
  return sh;
}
/* upsert ตามคอลัมน์ key — เจอแถวที่ค่าตรง = เขียนทับ, ไม่มี = append (กันดันซ้ำเป็นแถวใหม่) */
function upsertRowByCol_(sh, nCols, keyCol, keyVal, rowData) {
  var last = sh.getLastRow();
  var col = last > 1 ? sh.getRange(2, keyCol, last - 1, 1).getValues() : [];
  for (var i = 0; i < col.length; i++) {
    if (String(col[i][0]).trim() === String(keyVal).trim()) {
      sh.getRange(i + 2, 1, 1, nCols).setValues([rowData]);
      return 'updated';
    }
  }
  sh.appendRow(rowData);
  return 'appended';
}
var PLAN_HEADERS = ['NOTIF_ID', 'BU', 'PERIOD', 'ITEMS', 'N_ITEMS', 'BY', 'SAVED_AT', 'SYNC_AT'];
function pushPlanRow_(d) {
  if (!d || !d.NOTIF_ID) throw new Error('ข้อมูลแผนไม่ครบ (NOTIF_ID)');
  var ss = getSS_();
  var sh = ensureSheetWithHeaders_(ss, CONFIG.SHEETS.PLANS, PLAN_HEADERS);
  var items = Array.isArray(d.items) ? d.items.join(' ⏎ ') : String(d.items || '');
  var row = [or_(d.NOTIF_ID), or_(d.BU), or_(d.PERIOD), items, (Array.isArray(d.items) ? d.items.length : 0), or_(d.BY), or_(d.SAVED_AT), now_()];
  return upsertRowByCol_(sh, PLAN_HEADERS.length, 1, d.NOTIF_ID, row);
}
var DTA_HEADERS = ['WEEK', 'SAVED_AT', 'SRC', 'PURPOSE', 'VISION', 'ACCOUNT', 'OBJ_P', 'KR1_P', 'KR2_P', 'KR3_P',
  'KR1_NOTE', 'KR2_NOTE', 'KR3_NOTE', 'OKR_NOTE',
  'BP1', 'BP2', 'BP3', 'LL1', 'LL2', 'LL3', 'II1', 'II2', 'II3',
  'XP_1', 'XP_2', 'XP_3', 'XP_4', 'XP_5', 'XP_6', 'XP_7', 'XP_8', 'XP_9', 'XP_10', 'XP_11', 'XP_12', 'XP_13', 'XP_14', 'XP_15',
  'TMM_AP', 'TMM_OWNER', 'TMM_DONE', 'TMM_STAT', 'TMM_LNK', 'COACH1', 'COACH2', 'COACH3'];
function dtaRow_(d) {
  var xp = d.xp || [], tmm = d.tmm || [];
  var f = function (a, i) { return a && a[i] != null ? String(a[i]) : ''; };
  var xpc = function (i) { return xp[i] ? '✔' : ''; };
  return [
    or_(d.weekLabel), or_(d.SAVED_AT, now_()), 'WEB_v1.25',
    or_(d.purpose), or_(d.vision), or_(d.account),
    or_(d.objP, 0), or_(d.kr1, 0), or_(d.kr2, 0), or_(d.kr3, 0),
    or_(d.kr1note), or_(d.kr2note), or_(d.kr3note), or_(d.okrnote),
    f(d.bp, 0), f(d.bp, 1), f(d.bp, 2), f(d.ll, 0), f(d.ll, 1), f(d.ll, 2), f(d.ii, 0), f(d.ii, 1), f(d.ii, 2),
    xpc(0), xpc(1), xpc(2), xpc(3), xpc(4), xpc(5), xpc(6), xpc(7), xpc(8), xpc(9), xpc(10), xpc(11), xpc(12), xpc(13), xpc(14),
    tmm.map(function (t) { return t.ap ? ((t.done ? '✔' : '○') + ' ' + t.ap) : ''; }).filter(Boolean).join(' ⏎ '),
    tmm.map(function (t) { return t.owner || ''; }).filter(Boolean).join(', '),
    tmm.filter(function (t) { return t.done; }).length + '/' + tmm.length,
    tmm.map(function (t) { return t.stat || ''; }).filter(Boolean).join(' ⏎ '),
    tmm.map(function (t) { return t.link || ''; }).filter(Boolean).join(' ⏎ '),
    f(d.coach, 0), f(d.coach, 1), f(d.coach, 2)
  ];
}
function pushDtaRow_(d) {
  var key = or_(d.weekLabel, '');
  if (!key) throw new Error('ต้องระบุรอบรายงาน (สัปดาห์) ก่อนดัน — เลือกสัปดาห์ หรือกรอก "สรุปรอบวันที่"');
  var ss = getSS_();
  var sh = ensureSheetWithHeaders_(ss, CONFIG.SHEETS.DTA, DTA_HEADERS);
  return upsertRowByCol_(sh, DTA_HEADERS.length, 1, key, dtaRow_(d));
}

function readAll_(sheetName) {
  var ss = getSS_();
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

/* v1.5 — BU ส่งข้อมูลเข้ารับตรวจ (1 pack = 1 แถว) — รันเลข PACK-000n กันชนด้วย LockService */
function submitPack_(data) {
  var ss = getSS_();
  var sh = ss.getSheetByName(CONFIG.SHEETS.PACKS);
  if (!sh) { setupSheets(); sh = ss.getSheetByName(CONFIG.SHEETS.PACKS); }
  var last = sh.getLastRow();
  var maxNo = 0;
  if (last > 1) {
    var ids = sh.getRange(2, 1, last - 1, 1).getValues();
    ids.forEach(function (r) {
      var m = String(r[0]).match(/PACK-(\d+)/);
      if (m) { var n = parseInt(m[1], 10); if (n > maxNo) maxNo = n; }
    });
  }
  var pad = 4;
  var no = String(maxNo + 1); while (no.length < pad) no = '0' + no;
  var packId = 'PACK-' + no;
  var now = Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyy-MM-dd HH:mm');
  var item = or_(data.ITEM);
  if (item !== '') {
    var st_ = String(item);
    if (st_.length > 300) st_ = st_.slice(0, 300);
    item = st_;
  }
  if (!or_(data.LINKS)) throw new Error('ต้องแนบลิงก์หลักฐานอย่างน้อย 1 ลิงก์ — ระบบบันทึกไม่ได้ถ้าไม่มีหลักฐาน (กติกาขั้น ②)');
  var now = Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyy-MM-dd HH:mm');
  sh.appendRow([packId, or_(data.BU), or_(data.SCOPE), or_(data.PERIOD), or_(data.TITLE), or_(data.LINKS), or_(data.NOTE), 'รอ GAT เลือกตรวจ', or_(data.BY || 'BU'), now, '', '', item]);
  return { PACK_ID: packId };

}

/* v1.5.2 — เปลี่ยนสถานะ Pack (เช่น mark "ทดสอบระบบ — ปิด" หรือ "ตรวจแล้ว") */
function updatePackStatus_(data) {
  if (!data.PACK_ID) throw new Error('ต้องระบุ PACK_ID');
  var sh = getSS_().getSheetByName(CONFIG.SHEETS.PACKS);
  if (!sh) throw new Error('ไม่พบแท็บ ' + CONFIG.SHEETS.PACKS);
  var last = sh.getLastRow();
  var ids = last > 1 ? sh.getRange(2, 1, last - 1, 1).getValues() : [];
  var hit = -1;
  ids.forEach(function (r, i) { if (String(r[0]) === String(data.PACK_ID)) hit = i + 2; });
  if (hit < 0) throw new Error('ไม่พบ ' + data.PACK_ID);
  var col = data.FIELD === 'AI_NOTE' || data.FIELD === 'AI_REVIEW_AT'
    ? (data.FIELD === 'AI_NOTE' ? 12 : 11)
    : 8; // STATUS column
  var val = data.STATUS || '';
  /* v1.7.1 — AI_NOTE: รับ NOTE เนื้อหาผลการตรวจ (บล็อกจาก inspBuildNote + ตารางตรวจต่อประเด็น v1.34) */
  if (data.FIELD === 'AI_NOTE' && data.NOTE) val = data.STATUS + '\n' + data.NOTE;
  if (data.FIELD === 'AI_REVIEW_AT') val = Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyy-MM-dd HH:mm');
  sh.getRange(hit, col).setValue(val);
  return 1;
}

function log_(actor, action, target, detail) {
  try {
    var ss = getSS_();
    var sh = ss.getSheetByName(CONFIG.SHEETS.AUDIT_LOG);
    if (!sh) return;
    sh.appendRow(['LG-' + Date.now(), now_(), actor, action, target, detail]);
  } catch (e) { /* log พังไม่ให้กระทบงานหลัก */ }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
function now_() { return Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyy-MM-dd HH:mm:ss'); }
function or_(v, def) { return (v === undefined || v === null || String(v).trim() === '') ? (def || '') : v; }