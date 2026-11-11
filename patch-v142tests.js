/* patch-v142tests.js — run-once — ปรับเทสให้เข้ากับ v1.42 (แท็บ 5 = การ์ดเดียว ระดับชื่อเรื่อง/แผน; ถอดการ์ด ②) */
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

sub('test-ui.js', [
  /* 1) v1.11 dropdown assert — แท็บ 5 ใหม่นับแผนจาก gat_notifs (seed ไม่มีแพ็กผูกแผน → dropdown ยังว่าง) */
  [ "  gat.showTab('close');\n  ok('v1.11: ตารางสำเนาแท็บ 5 มี 10 แถว', d.getElementById('recBodyClose').querySelectorAll('tr').length === 10);\n  ok('v1.11: dropdown ปิดหลัก = 10 ใบเปิด (ขอบเขต REC)', d.getElementById('closeRecPick').options.length === 11);",
    "  gat.showTab('close');\n  ok('v1.11: ตารางสำเนาแท็บ 5 มี 10 แถว', d.getElementById('recBodyClose').querySelectorAll('tr').length === 10);\n  /* v1.42 — dropdown ปิดหลัก = ระดับชื่อเรื่อง (แผน): seed ไม่มีแพ็กผูกแผน → ยังเป็นทางเลือกเดียว */\n  ok('v1.42: dropdown ปิดหลัก = ระดับชื่อเรื่อง (แผน) — ยังไม่มีแผนที่ตรวจจบ → ทางเลือกเดียว', d.getElementById('closeRecPick').options.length === 1);" ],

  /* 2) v1.29 assert เดิม — REC ไม่เกี่ยวกับ dropdown ปิดหลักแล้ว */
  [ "  gat._renderRecs();\n  gat.showTab('close');\n  ok('v1.29: ใบที่ BU ตอบแล้วยังขึ้นใน dropdown ปิดหลัก (11)', d.getElementById('closeRecPick').options.length === 11);",
    "  gat._renderRecs();\n  gat.showTab('close');\n  /* v1.42 — REC ไม่เกี่ยวกับแผนปิดหลัก (นับจากแพ็กผูกแผน) — seed ยังไม่มี → dropdown ว่าง */\n  ok('v1.42: dropdown ปิดหลักยังว่างแม้ REC มีใบ (REC ไม่ใช่แหล่งชื่อเรื่องแล้ว)', d.getElementById('closeRecPick').options.length === 1);" ],
]);

console.log('patch-v142tests done');
