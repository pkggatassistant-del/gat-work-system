/* patch-v143.js — run-once — v1.43 (11 พ.ย. 69)
 * สั่งพี่หนึ่ง #31550 + ภาพ: "ขั้น 3 เลือกชื่อเรื่องไม่ได้" — หลัง v1.42 แท็บ 5 เลือก"ชื่อเรื่อง"(แผน) แล้ว แท็บ 3 ยังเลือกด้วย PACK ทั้งชุด
 * v1.43: แท็บ 3 = ① เลือกชื่อเรื่อง (แผน) ก่อน → ② เลือกการส่ง (PACK เฉพาะในเรื่อง) → ตารางตรวจ/ฟอร์มเดิมทุกอย่าง */
var fs = require('fs');
function read(p) { return fs.readFileSync(p, 'utf8'); }
function write(p, s) { fs.writeFileSync(p, s); }
function sub(file, pairs) {
  var s = read(file), out = s;
  pairs.forEach(function (pr) {
    if (out.indexOf(pr[0]) < 0) { console.error('MISS [' + file + ']: ' + String(pr[0]).slice(0, 90).replace(/\n/g, '\\n')); process.exitCode = 1; return; }
    var c = out.split(pr[0]).length - 1;
    if (c !== 1) { console.error('NOT-UNIQUE [' + file + ']: ' + String(pr[0]).slice(0, 90).replace(/\n/g, '\\n') + ' (count=' + c + ')'); process.exitCode = 1; return; }
    out = out.replace(pr[0], pr[1]);
  });
  write(file, out);
}

/* ===== index.html ===== */
sub('index.html', [
  /* 1) การ์ดเลือก — แทรก dropdown ชื่อเรื่อง (inspPlanPick) นำ + คำอธิบาย */
  [ "    <div class=\"card\">\n      <div class=\"card-hd\"><b>🎯 เลือกการส่ง (PACK) ที่จะตรวจ</b></div>\n      <div class=\"filters\"><select id=\"inspPackPick\" style=\"flex:1;min-width:300px\"><option value=\"\">— เลือก PACK ที่ BU ส่ง —</option></select>\n      <button class=\"button-lite\" id=\"btnInspRefresh\">🔄 รีเฟรชรายการ</button></div>\n      <div id=\"inspPackMeta\" class=\"desc\" style=\"margin-top:6px\"></div>\n    </div>",
    "    <div class=\"card\">\n      <div class=\"card-hd\"><b>🎯 ขั้น ① เลือกชื่อเรื่อง (เรื่องที่แจ้งในขั้น 1) → ② เลือกการส่ง (PACK) ที่จะตรวจ (v1.43)</b></div>\n      <div class=\"filters\"><select id=\"inspPlanPick\" style=\"flex:1.4;min-width:340px\"><option value=\"\">— เลือกชื่อเรื่อง (เรื่องที่แจ้งในขั้น 1) —</option></select>\n      <select id=\"inspPackPick\" style=\"flex:1;min-width:280px\"><option value=\"\">— เลือกการส่ง (PACK ในเรื่องนี้) —</option></select>\n      <button class=\"button-lite\" id=\"btnInspRefresh\">🔄 รีเฟรชรายการ</button></div>\n      <p class=\"desc\" style=\"margin-top:4px\">เลือก<b>ชื่อเรื่อง</b>ก่อน → เลือก<b>การส่ง (PACK)</b> ในเรื่องนั้น (สลับเรื่อง รายการการส่งกรองตาม) — เว้นชื่อเรื่อง = เห็นทุกเรื่อง</p>\n      <div id=\"inspPackMeta\" class=\"desc\" style=\"margin-top:6px\"></div>\n    </div>" ],

  /* 2) หัวการ์ดบน — อัปเดตลำดับใหม่ */
  [ "      <div class=\"card-hd\"><b>🔍 ขั้น 3 — ทีม GAT ตรวจหลักฐานที่ BU ส่งมา (รายละเอียดการตรวจ + ผลการตรวจขั้นนี่)</b></div>\n      <p class=\"desc\">เลือกการส่ง (PACK) จากตาราง → เติม <b>รายละเอียดการตรวจ</b> (วิธี/ตัวชิ้น) + <b>ผลการตรวจรายประเด็น</b> + สรุปผลรวม (ผ่าน/ไม่ผ่าน) → กดบันทึก",
    "      <div class=\"card-hd\"><b>🔍 ขั้น 3 — ทีม GAT ตรวจหลักฐานที่ BU ส่งมา (เลือกชื่อเรื่อง → เลือกการส่ง → รายละเอียด + ผลการตรวจ — v1.43)</b></div>\n      <p class=\"desc\">เลือก<b>ชื่อเรื่อง</b> (เรื่องที่แจ้งขั้น 1) → เลือก<b>การส่ง (PACK)</b> ในเรื่อง → เติม <b>รายละเอียดการตรวจ</b> + <b>ผลการตรวจรายประเด็น</b> + สรุปผลรวม (ผ่าน/ไม่ผ่าน) → กดบันทึก" ],
]);

console.log('patch-v143 done (html)');
