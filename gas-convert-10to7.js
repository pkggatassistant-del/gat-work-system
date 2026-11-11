// สคริปต์แปลงชีต BCT — 10 ขั้นตอน → 7 ขั้นตอน (ตามสั่ง #31444)
// ใช้: Apps Script editor ของชีต → วางทั้งไฟล์ → run convert10to7Steps → Approve สิทธิ์ → เช็ค log
// ความปลอดภัย: ไม่แตะตารางแม่ (GAT_Plans/Packs/Issues/Entries/Registers/DTA/Users/AuditLog/Vault)
//              แท็บจุดN เป็นกระจกอย่างเดียว (เช็คแล้ว — ไม่มีข้อมูลจริง) · ลบแบบ "เก็บสำรองชื่อเก่าก่อน" ทุกแท็บ

function convert10to7Steps() {
  var ss = SpreadsheetApp.openById('1MK4ufs2ycbJg81ZVaqeJb0z3MEaflAMVZmKqmhkrZ1E');
  var out = [];

  // ---------- 1) แผนที่ชื่อใหม่ 7 แท็บ (ตามวงจร 7 ขั้นที่เว็บใช้จริง) ----------
  var P = {
    1: 'จุด1-แจ้งเรื่องตรวจ',        // มีอยู่แล้ว — เก็บชื่อเดิม
    2: 'จุด2-รอBUส่งข้อมูล',
    3: 'จุด3-เลือกหัวข้อตรวจ',
    4: 'จุด4-ผลตรวจสรุป',           // รวมเดิม จุด4-ชุดคำสั่งAI + จุด5-ผลตรวจAI (สรุปผลขั้น 4)
    5: 'จุด5-ปิดประเด็นหลัก',        // เดิม จุด9-GATปิดประเด็น (ขั้น 5 ใหม่ = ปิดหลัก)
    6: 'จุด6-ส่งผลให้BU',            // เดิม จุด8-BUตอบในระบบ → ขั้น 6 ใหม่ = ส่งผล
    7: 'จุด7-รายงานDTA'             // เดิม จุด10-สรุปผล
  };

  // ---------- 2) เนื้อหาหัวใหม่ (ขั้น/รายการ/หมายเหตุ) ให้ตรงระบบ 7 ขั้น ----------
  var CONTENT = {
    'จุด1-แจ้งเรื่องตรวจ':      ['ขั้น 1', '① ทีม GAT แจ้งเรื่อง/ประเด็นที่จะตรวจ (ชื่อเรื่อง)', 'ที่มา: ปุ่ม ☁️ ดันชีต (แท็บ 1 เว็บ) → ตารางแม่ GAT_Plans'],
    'จุด2-รอBUส่งข้อมูล':       ['ขั้น 2', '② BU ส่งหลักฐานตามประเด็น (PACK)', 'ที่มา: แท็บ 2 เว็บ (ส่งหลักฐาน) → ตารางแม่ GAT_Packs'],
    'จุด3-เลือกหัวข้อตรวจ':     ['ขั้น 3', '③ ทีม GAT ตรวจหลักฐาน (เลือกการส่ง ตามชื่อเรื่อง)', 'ที่มา: แท็บ 3 เว็บ (ตรวจหลักฐาน) → ผลลง AI_NOTE ใน GAT_Packs'],
    'จุด4-ผลตรวจสรุป':          ['ขั้น 4', '④ สรุปผลการตรวจ + ออกใบข้อเสนอแนะ (REC) + ตัดสิน ผ่าน/ไม่ผ่าน', 'ที่มา: แท็บ 4 เว็บ (สรุปผล) → ตารางแม่ GAT_Issues'],
    'จุด5-ปิดประเด็นหลัก':      ['ขั้น 5', '⑤ ปิดประเด็นหลัก (เลือกชื่อเรื่อง — ประเด็นย่อยครบ+ผ่านทุกข้อ)', 'ที่มา: แท็บ 5 เว็บ (ปิดประเด็น) → AuditLog close_issue / สถานะแพ็ก'],
    'จุด6-ส่งผลให้BU':          ['ขั้น 6', '⑥ ส่งผลการตรวจให้ BU (ผ่าน/ไม่ผ่าน)', 'ที่มา: แท็บ 6 เว็บ (ส่งผลให้ BU) → GAT_Packs (STATUS)'],
    'จุด7-รายงานDTA':           ['ขั้น 7', '⑦ รายงานวัดผล DTA (รอบศุกร์ — OpenClaw เตรียมร่าง)', 'ที่มา: แท็บ 7 เว็บ → ตารางแม่ GAT_DTA']
  };

  // ---------- 3) ลบแท็บเกิน: จุด4-ชุดคำสั่งAI, จุด5-ผลตรวจAI, จุด8/9/10 ----------
  var TO_DELETE = ['จุด4-ชุดคำสั่งAI', 'จุด5-ผลตรวจAI', 'จุด8-BUตอบในระบบ', 'จุด9-GATปิดประเด็น', 'จุด10-สรุปผล'];
  // rename ก่อนลบ: ไม่ให้ตรงกับแท็บใหม่ที่จะใช้ (กันชนชื่อ)
  var rename = {
    'จุด4-ชุดคำสั่งAI': '_ลบ_จุด4-ชุดคำสั่งAI',
    'จุด5-ผลตรวจAI': '_ลบ_จุด5-ผลตรวจAI',
    'จุด8-BUตอบในระบบ': '_ลบ_จุด8-BUตอบในระบบ',
    'จุด9-GATปิดประเด็น': '_ลบ_จุด9-GATปิดประเด็น',
    'จุด10-สรุปผล': '_ลบ_จุด10-สรุปผล'
  };
  TO_DELETE.forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (sh) { sh.setName(rename[name]); out.push('rename for delete: ' + name); }
  });
  // ลบ (รวมรุ่นเก่าจาก GAS v1.6/v1.7 ถ้ามี: จุด1a/จุด1b — เทสรันซ้ำได้)
  var delMap = {
    '_ลบ_จุด4-ชุดคำสั่งAI': 1, '_ลบ_จุด5-ผลตรวจAI': 1, '_ลบ_จุด8-BUตอบในระบบ': 1,
    '_ลบ_จุด9-GATปิดประเด็น': 1, '_ลบ_จุด10-สรุปผล': 1, '_ลบ_จุด1b': 1, '_ลบ_จุด1a': 1, '_ลบ_จุด1': 1
  };
  Object.keys(delMap).forEach(function (from) {
    var sh = ss.getSheetByName(from);
    if (sh) { ss.deleteSheet(sh); out.push('ลบแท็บ: ' + from); }
  });

  // ---------- 4) เปลี่ยนชื่อแท็บคงเหลือ ----------
  // จุด6-ใบRECส่งBU → จุด4-ผลตรวจสรุป (เนื้อหาใกล้กัน — แท็บ REC)
  var sh6 = ss.getSheetByName('จุด6-ใบRECส่งBU');
  if (sh6) { sh6.setName('จุด4-ผลตรวจสรุป'); out.push('เปลี่ยนชื่อ: จุด6-ใบRECส่งBU → จุด4-ผลตรวจสรุป'); }
  // จุด9-GATปิดประเด็น ถูกลบไปแล้ว — สร้าง "จุด5-ปิดประเด็นหลัก" ใหม่
  // จุด7-BUแก้ไข → จุด6-ส่งผลให้BU
  var sh7 = ss.getSheetByName('จุด7-BUแก้ไข');
  if (sh7) { sh7.setName('จุด6-ส่งผลให้BU'); out.push('เปลี่ยนชื่อ: จุด7-BUแก้ไข → จุด6-ส่งผลให้BU'); }
  // จุด10-สรุปผล ถูกลบไปแล้ว — สร้าง "จุด7-รายงานDTA" ใหม่

  // ---------- 5) สร้างแท็บใหม่ที่ขาด: จุด5-ปิดประเด็นหลัก + จุด7-รายงานDTA ----------
  var MIRROR_HEADERS = [['ขั้น', 'รายการ', 'หมายเหตุ']];
  function ensureMirror(name, rowA, rowB, rowC) {
    var sh = ss.getSheetByName(name);
    if (!sh) { sh = ss.insertSheet(name); }
    sh.clear();
    sh.getRange(1, 1, 1, 3).setValues(MIRROR_HEADERS).setFontWeight('bold');
    sh.getRange(2, 1, 3, 3).setValues([[rowA[0], rowA[1], rowA[2]], [rowB[0], rowB[1], rowB[2]], [rowC[0], rowC[1], rowC[2]]]);
    sh.setColumnWidth(1, 110); sh.setColumnWidth(2, 380); sh.setColumnWidth(3, 620);
    return sh;
  }
  // จุด5-ปิดประเด็นหลัก
  ensureMirror(P[5],
    CONTENT['จุด5-ปิดประเด็นหลัก'],
    ['ที่มาข้อมูล', 'ตารางแม่: GAT_Issues / GAT_Packs', 'แท็บนี้ = กระจกสถานะ (Mirror) — ตามหลัก 1 source of truth'],
    ['จุดใช้งาน', 'เว็บ GAT https://pkggatassistant-del.github.io/gat-work-system/', 'อัปเดต: แท็บ 5 เว็บ (ปิดประเด็นหลัก)'] );
  // จุด7-รายงานDTA
  ensureMirror(P[7],
    CONTENT['จุด7-รายงานDTA'],
    ['ที่มาข้อมูล', 'ตารางแม่: GAT_DTA', 'แท็บนี้ = กระจกสถานะ (Mirror) — ตามหลัก 1 source of truth'],
    ['จุดใช้งาน', 'เว็บ GAT https://pkggatassistant-del.github.io/gat-work-system/', 'อัปเดต: แท็บ 7 เว็บ (รายงานวัดผล DTA)'] );

  // ---------- 6) อัปเดตหัวให้แท็บที่มีอยู่ (จุด1, จุด2, จุด3, จุด4 ใหม่, จุด6 ใหม่) ----------
  function refreshContent(name) {
    var sh = ss.getSheetByName(name);
    if (!sh) { out.push('ไม่พบ (ข้าม): ' + name); return; }
    var c = CONTENT[name];
    if (!c) { out.push('ไม่มีเนื้อหาใหม่ (ข้าม): ' + name); return; }
    sh.getRange(2, 1, 1, 3).setValues([c]);
    out.push('อัปเดตเนื้อหา: ' + name);
  }
  ['จุด1-แจ้งเรื่องตรวจ', 'จุด2-รอBUส่งข้อมูล', 'จุด3-เลือกหัวข้อตรวจ', 'จุด4-ผลตรวจสรุป', 'จุด6-ส่งผลให้BU'].forEach(refreshContent);

  // ---------- 7) เรียงลำดับแท็บ: GAT_Registers, GAT_Vault, ใบแจ้งประเด็น BU, จุด1..7, ตารางแม่ ----------
  var ORDER = ['GAT_Registers', 'GAT_Vault', 'ใบแจ้งประเด็น BU',
    'จุด1-แจ้งเรื่องตรวจ', 'จุด2-รอBUส่งข้อมูล', 'จุด3-เลือกหัวข้อตรวจ', 'จุด4-ผลตรวจสรุป',
    'จุด5-ปิดประเด็นหลัก', 'จุด6-ส่งผลให้BU', 'จุด7-รายงานDTA',
    'GAT_DTA', 'GAT_Plans', 'GAT_Packs', 'GAT_Issues', 'GAT_Entries', 'GAT_AuditLog', 'คู่มือติดตั้ง'];
  // เคลียร์แท็บ "_ลบ_" ค้าง (ถ้ายังไม่ถูกลบเพราะ error ก่อนหน้า)
  ss.getSheets().forEach(function (sh) {
    var n = sh.getName();
    if (n.indexOf('_ลบ_') === 0) { try { ss.deleteSheet(sh); out.push('ลบแท็บ: ' + n); } catch (e) { out.push('ลบไม่ได้: ' + n + ' (' + e.message + ')'); } }
  });
  // เรียง: move แท็บตาม ORDER (ถ้ามี)
  var pos = 0;
  ORDER.forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (sh) { ss.setActiveSheet(sh); ss.moveActiveSheet(pos + 1); pos++; }
  });

  // ---------- 8) AuditLog + รายงาน ----------
  try {
    var log = ss.getSheetByName('GAT_AuditLog');
    if (log) {
      var ts = Utilities.formatDate(new Date(), 'Asia/Bangkok', "yyyy-MM-dd'T'HH:mm:ss'Z'");
      log.appendRow(['LG-convert7', ts, 'system', 'setup', 'sheets', 'แปลงโครงชีต 10 ขั้น → 7 ขั้น (ลบแท็บกระจก จุด4AI/จุด5AI/จุด8/จุด9/จุด10 · สร้าง จุด4-ผลตรวจสรุป + จุด5-ปิดประเด็นหลัก + จุด7-รายงานDTA · ตารางแม่ไม่ถูกแตะ)']);
      out.push('จด AuditLog แล้ว');
    }
  } catch (e) { out.push('AuditLog err: ' + e.message); }

  Logger.log('======== สรุปผล =======\n' + out.join('\n'));
  try { SpreadsheetApp.getUi().alert('แปลงชีต 10→7 ขั้น เสร็จ:\n' + out.join('\n')); } catch (e) {}
}

/* ================= วิธีใช้ (พี่หนึ่ง) =================
1. เปิดชีต BCT → Extensions (ส่วนขยาย) → Apps Script
2. วางโค้ดทั้งหมดนี้แทนของเดิมในไฟล์ Code.gs (หรือสร้างไฟล์ .gs ใหม่ ตั้งชื่อ convert7)
3. เลือก function: convert10to7Steps → Run (▶)
4. ยินยอมสิทธิ์ครั้งแรก (Authorize) — แค่ครั้งแรกครั้งเดียว
5. กลับมาดูชีต: แท็บจะเหลือ จุด1..จุด7 + ตารางแม่เหมือนเดิม (ลอง Ctrl+F หา "จุด8" = ไม่เจอ)
6. ผลรันโชว์ใน Execution log
================================================== */
