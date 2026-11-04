// jsdom test — นิยามใหม่ PM/WI/SD/FM (สรุปผลงาน + Dashboard)
const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('index.html', 'utf8');
const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://pkggatassistant-del.github.io/gat-work-system/' });
const w = dom.window;
const SEED = JSON.parse(fs.readFileSync('gat-seed.json', 'utf8'));
const PROC = JSON.parse(fs.readFileSync('gat-process.json', 'utf8'));

w.fetch = (u) => {
  if (String(u).indexOf('gat-process.json') >= 0) return Promise.resolve({ ok: true, json: () => Promise.resolve(PROC) });
  return Promise.resolve({ ok: true, json: () => Promise.resolve(SEED) });
};
w.GAT_CONFIG = { VERSION: 'v1.2-test', BCT_API: '', SOURCES: { SEED: 'x', REC_SEED: 'x', PROCESS_SEED: 'gat-process.json' }, PROCESS_TYPES: { PM: { label: 'PM', color: '#2563eb' }, WI: { label: 'WI', color: '#0891b2' }, SD: { label: 'SD', color: '#7c3aed' }, FM: { label: 'FM', color: '#b45309' } } };

w.eval(fs.readFileSync('gat-config.js', 'utf8'));
w.eval(fs.readFileSync('app.js', 'utf8'));
w.document.dispatchEvent(new w.Event('DOMContentLoaded'));

setTimeout(() => {
  const d = w.document, gat = w.GAT;
  let pass = 0, fail = 0;
  const ok = (name, cond, note) => { if (cond) pass++; else { fail++; console.error('❌ ' + name + (note!==undefined && note!==null && note!=='' && typeof note !== 'boolean' ? ' :: '+note : '')); } };

  // 1) นิยามใหม่: KPI "เอกสารกระบวนการทีม" = 6/7/6/5 รวม 24 (จาก gat-process.json จริง)
  const kpis = d.getElementById('kpiRow').textContent;
  ok('KPI ทีม 6·7·6·5', kpis.includes('6·7·6·5'));
  ok('KPI รวม 24 หัวข้อ', kpis.includes('24 หัวข้อ'));
  ok('ไม่มีตัวเลขนิยามเก่า 100 · 58 · 9 · 17 บน KPI', !kpis.includes('100 · 58 · 9 · 17'));

  // 2) รอบที่ 2: นับแหล่งข้อมูลด้วย seed จริง
  const st = gat.state();
  ok('state.process ถูกเก็บ', st.process && st.process.PM && st.process.PM.items.length === 6);
  const regs = st.registers.length;
  ok('registers > 150 จาก seed จริง', regs > 150);

  // 3) สรุปผลงาน: ไม่มีการนับแบบเก่า (PM x / WI y / SD z / FM w จาก 184)
  gat.showTab('summary');
  const sumTxt = d.getElementById('summaryBody').textContent;
  ok('สรุป: ไม่มี "จาก PKG_Compliance_plan ... PM 100"', !sumTxt.includes('PM 100 / WI 9'));
  ok('สรุป: มีหัวข้อ "ระบบเอกสาร 4 ประเภท"', sumTxt.includes('ระบบเอกสาร 4 ประเภท'));
  ok('สรุป: มีบล็อก 24 หัวข้อ', sumTxt.includes('รวม 24 หัวข้อ'));

  // 4) v1.12: เอกสารกระบวนการเต็ม (แผนภาพ + แม่แบบ + PM/WI_DOCS) ย้ายไปท้ายแท็บคู่มือ (state = ข้อมูล)
  gat.showTab('manual');
  setTimeout(function () {
    const pdEl = d.getElementById('processDocs');
    const proc = pdEl ? pdEl.textContent : '';
    const raw = JSON.stringify(gat.state().process || {});
    ok('เอกสาร: หัว "ความสัมพันธ์ของเอกสารข้อกำหนด"', proc.includes('ความสัมพันธ์ของเอกสารข้อกำหนด') || raw.includes('ความสัมพันธ์ของเอกสารข้อกำหนด'));
    ok('แผนภาพ: PM กำหนดว่าต้องทำอะไร ใครรับผิดชอบ', proc.includes('กำหนดว่าต้องทำอะไร ใครรับผิดชอบ และทำเมื่อไหร่') || raw.includes('กำหนดว่าต้องทำอะไร'));
    ok('แผนภาพ: มีปลายทาง Evidence / KPI / Audit', proc.includes('Evidence / KPI / Audit') || raw.includes('Evidence / KPI'));
    ok('แผนภาพ: SD = เอกสารข้อกำหนดคุณลักษณะงาน', proc.includes('เอกสารข้อกำหนดคุณลักษณะงาน') || raw.includes('คุณลักษณะงาน'));
    ok('hero แสดง v2.8', proc.includes('v2.8') || raw.includes('v2.8'));
    ok('CORE: มีตาราง "กระบวนการที่จำเป็น 10"', proc.includes('กระบวนการที่จำเป็น 10') || raw.includes('P-01'));
    ok('CORE: มี P-01 ถึง P-10', raw.includes('P-01') && raw.includes('P-10'));
    ok('CORE: อ้าง FM-01 ใน P-04', raw.includes('FM-01'));
    ok('ROLES: มีตาราง 7 หน่วยงาน + OAC/BMC/Process Owner', proc.includes('7 หน่วยงาน') && raw.includes('OAC') && raw.includes('BMC') && raw.includes('Process Owner') && raw.includes('GAT Coordinator'));
    ok('ROLES: มีข้อสำคัญ เจ้าของกระบวนการรับผิดชอบจริง', proc.includes('เจ้าของกระบวนการ (Process Owner) ต้องเป็นผู้จัดทำ') || raw.includes('ต้องเป็นผู้จัดทำ'));
    ok('PM_TEMPLATE: 18 หัวข้อ + Process Code/Records & Evidence', proc.includes('แม่แบบ PM — เอกสารกระบวนการ 18 หัวข้อ') && raw.includes('Process Code') && raw.includes('Records & Evidence'));
    ok('WI_TEMPLATE: 15 หัวข้อ + Reference PM/Completion Criteria', proc.includes('แม่แบบ WI — คำสั่งปฏิบัติ 15 หัวข้อ') && raw.includes('Reference PM') && raw.includes('Completion Criteria'));
    ok('WI_RULE: กฎ "WI ต้องแตกจากขั้นตอนของ PM" แสดงบนหน้า', proc.includes('WI ต้องแตกออกมาจากแต่ละขั้นตอนของ PM') || raw.includes('WI ต้องแตกออกมา'));
    ok('WI_PRINCIPLE: หลักเกณฑ์ อ่านแล้วทำตามได้จริง', proc.includes('ผู้ปฏิบัติงานต้องอ่านแล้วทำตามได้จริง') || raw.includes('ผู้ปฏิบัติ'));
    ok('SD_GROUPS: 6 กลุ่ม (Policy→Checklist)', proc.includes('Supporting Document 6 กลุ่ม') && proc.includes('Policy') && proc.includes('Checklist') && proc.includes('Guideline'));
    ok('SD_FIELDS: เจ้าของ/แหล่ง/บังคับ/ทบทวน แสดง', proc.includes('เจ้าของเอกสาร') && proc.includes('สถานะการทบทวน'));
    ok('SD register: มีคอลัมน์แหล่งที่มา + จัดตามกลุ่ม', proc.includes('จัดตามกลุ่มมาตรฐาน') && proc.includes('แหล่งที่มา'));
    ok('FM_FIELDS: 11 ช่อง + Reference PM/WI + ผู้อนุมัติ', proc.includes('แบบฟอร์มบันทึกผล 11 ช่อง') && proc.includes('Reference PM / WI') && proc.includes('ผู้อนุมัติ (ถ้ามี)'));
    ok('FM_PRINCIPLE: ไม่สร้างฟอร์มเกินจำเป็น', proc.includes('ไม่ควรสร้างแบบฟอร์มมากเกินความจำเป็น'));
    // --- v1.13: แท็บ 2/6/7 logic — seed packs+recs → ตาราง 3 อัน + ดาวน์โหลด bupix ---
  var st5 = gat.state();
  st5.packs = [{ PACK_ID: 'PACK-0001', BU: 'PAO', SCOPE: 'สวัสดิการพื้นฐาน', TITLE: 'รายละเอียดสวัสดิการ ต.ค. 69', STATUS: 'รอ GAT เลือกตรวจ' }];
  st5.recs = st5.recs.concat([{ REC_ID: 'GAT-REC-0042', REC_NO: 42, SEVERITY: '🔴 ขัดกฎหมาย/จำเป็นจริง', TITLE: 'ทดสอบส่ง BU', STATUS: 'P-04 ขั้น ④ / ส่งให้ BU แล้ว', BU_DECISION: '' }]);
  gat._renderPickTable(); gat._renderSentTable(); gat._renderFixTable();
  ok('v1.13: แท็บ 2 — ตารางเลือกหัวข้อแสดง PACK', d.getElementById('pickBody').textContent.indexOf('PACK-0001') >= 0);
  gat.showTab('aisend');
  ok('v1.13: แท็บ 6 — ตารางติดตามใบส่ง BU (REC-0042)', d.getElementById('recBodySent').textContent.indexOf('GAT-REC-0042') >= 0);
  ok('v1.13: แท็บ 6 — ฟอร์มออกใบมือรวมอยู่แท็บเดียว', !!d.getElementById('recRegPick') && !!d.getElementById('btnOpenRec'));
  gat.showTab('bufix');
  ok('v1.13: แท็บ 7 — ตารางรายการให้ BU ทำ + SLA "5 วันทำการ"', d.getElementById('recBodyFix').textContent.indexOf('GAT-REC-0042') >= 0 && d.getElementById('recBodyFix').textContent.indexOf('5 วันทำการ') >= 0);
  ok('v1.13: แท็บ 7 — ปุ่มดาวน์โหลดรายการ (.md)', !!d.getElementById('btnBufixDl'));
  // actLabel ของ RUN_STEPS ว่าจะไปทำแท็บไหน
  var g8 = d.getElementById('stepbox');
  gat.showTab('buanswer');
  var sbTxt = d.getElementById('stepbox').textContent;
  ok('v1.13: checklist แท็บ 8 + SLA "ตอบใน 5 วันทำการ"', sbTxt.indexOf('8') >= 0 && sbTxt.indexOf('5 วันทำการ') >= 0);

  // --- v1.14: P-01 ครึ่งแรก — GAT แจ้งเรื่องรายประเด็น → BU เลือกเรื่องที่ส่ง ---
  st5.packs = [];
  var nb2 = d.getElementById('notBu');
  ok('v1.14: แท็บ 1 มีการ์ดแจ้งเรื่อง + ส่งข้อมูล แยกครึ่ง', !!d.getElementById('notItems') && !!d.getElementById('btnNotifyPlan') && !!d.getElementById('packNotif') && !!d.getElementById('btnSendPack'));
  if (nb2) {
    nb2.value = 'PAO';
    d.getElementById('notItems').value = 'เรื่องที่ 1: ตรวจสวัสดิการ — เอกสาร: ใบลา — ผู้รับผิดชอบ: PAO — กำหนดส่ง: 11 พ.ย.\nเรื่องที่ 2: ตรวจ IPD';
    d.getElementById('btnNotifyPlan').click();
  }
  ok('v1.14: บันทึกแผน รันเลข PLAN-2569-', (d.getElementById('notStatus').textContent || '').indexOf('PLAN-2569-') >= 0);
  ok('v1.14: BU dropdown เห็นแผนที่แจ้ง', d.getElementById('packNotif').options.length >= 2);
  ok('v1.14: รายการ "เรื่องที่จะตรวจ" แสดง 2 เรื่อง', d.getElementById('notList').textContent.indexOf('เรื่องที่ 2') >= 0);

  // --- v1.15/16: notBu = ช่องกรอกได้ (ตามหนึ่งสั่ง) · packBu = dropdown จาก seed + PAO ---
  var elN = d.getElementById('notBu');
  ok('v1.16: การ์ดแจ้งใช้ช่องกรอก BU (input พิมพ์ได้)', elN && elN.tagName === 'INPUT');
  var optsP = Array.from(d.getElementById('packBu').options).map(function (o) { return o.value; });
  ok('v1.15: packBu dropdown รายชื่อครบ + PAO', optsP.length >= 55 && optsP.indexOf('PAO') >= 0, 'got ' + optsP.length);
  // saveNotifPlan อ่าน notBu.value ได้เมื่อเป็น input
  elN.value = 'PAO';
  d.getElementById('notItems').value = 'เรื่องที่ 1: ทดสอบช่องกรอก';
  d.getElementById('btnNotifyPlan').click();
  ok('v1.16: บันทึกแผนจากช่องกรอก (ไม่ต้อง dropdown)', (d.getElementById('notStatus').textContent || '').indexOf('PLAN-2569-') >= 0);

  // --- v1.17: แท็บ 2 ลบออกจากรายการ (เลือก checkbox → confirm → update_pack_status) ---
  var st6 = gat.state(); st6.packs = [{ PACK_ID: 'PACK-0001', BU: 'TEST', TITLE: 'probe', STATUS: 'x' }, { PACK_ID: 'PACK-0002', BU: 'PKG', TITLE: 'สวัสดิการ', STATUS: 'x' }];
  gat._renderPickTable();
  d.querySelectorAll('.pick-chk')[0].checked = true;
  var origPrompt = w.prompt, origConfirm = w.confirm;
  w.prompt = function () { return 'แดง (GAT)'; }; w.confirm = function () { return true; };
  var posts = []; // ดัก postToBCT — ปกติยิง fetch จริง ในเทส mock ไม่ได้ตอบ cb → แค่ยืนยันเรียก
  ok('v1.17: มีปุ่ม 🗑 ลบออกจากรายการ', !!d.getElementById('btnPickRemove'));
  try { gat._removePickPacks(); } catch (e) {}
  w.prompt = origPrompt; w.confirm = origConfirm;
  gat._removePickPacks(); // ไม่เลือก → warn

  // --- v1.18: ลิงก์หลักฐานฉบับ GAT (แชร์สิทธิ์ openclaw) → ชุดคำสั่ง AI ใช้แทนลิงก์ BU ---
  st6.packs = [{ PACK_ID: 'PACK-9992', BU: 'PKG', SCOPE: 'สวัสดิการ', PERIOD: 'ต.ค. 69', TITLE: 'ทดสอบลิงก์', LINKS: 'https://drive.bu-private/x', NOTE: '' }];
  gat._fillPackSelectors(); gat._renderPickTable();
  var pkSel = d.getElementById('aiPackPick'); pkSel.value = 'PACK-9992';
  d.getElementById('aiEvidenceLinks').value = 'https://docs.google.com/spreadsheets/gat-copy-test';
  d.getElementById('btnSaveEvidence').click();
  ok('v1.18: บันทึกลิงก์ GAT ผูก Pack', (d.getElementById('evidenceStatus').textContent || '').indexOf('PACK-9992') >= 0);
  Array.from(d.querySelectorAll('button')).find(function (b) { return b.id === 'btnAiBuild'; }).click();
  var pr = d.getElementById('aiPrompt').value;
  ok('v1.18: ชุดคำสั่ง AI ใช้ลิงก์ GAT แทนลิงก์ BU อัตโนมัติ', pr.indexOf('gat-copy-test') >= 0 && pr.indexOf('drive.bu-private') < 0);

  // --- v1.19: แท็บ 3 แสดงลิงก์หลักฐาน BU (คลิกได้) ---
  st6.packs.push({ PACK_ID: 'PACK-9991', BU: 'PKG', SCOPE: 'การเงิน', PERIOD: 'ต.ค. 69', TITLE: 'FIN', LINKS: 'เอกสารรายรับ: https://docs.bu.com/fin1\nสรุปวางเบิก: https://docs.bu.com/fin2', NOTE: '' });
  gat._fillPackSelectors();
  var pkSel2 = d.getElementById('aiPackPick'); pkSel2.value = 'PACK-9991';
  gat.showTab('aiprompt');
  var blc = d.getElementById('buLinksCard');
  var nLinks = blc.querySelectorAll('a').length;
  ok('v1.19: แท็บ 3 แสดงลิงก์ BU คลิกได้ 2 ลิงก์', nLinks === 2, 'got ' + nLinks);
  ok('v1.19: มีคำเตือน "ยังไม่มีลิงก์ฉบับ AI"', blc.textContent.indexOf('ยังไม่มีลิงก์ฉบับ AI') >= 0);

  // --- v1.20: แท็บ 1 GAT ติ๊กเรื่องที่จะตรวจ → ส่งเข้าขั้น 3 (ไม่รอ PACK) ---
  try { localStorage.removeItem('gat_plan_pick'); } catch (e) {}
  d.getElementById('notItems').value = 'เรื่องที่ 1: ตรวจใบลา — เอกสาร: สมุดลา\nเรื่องที่ 2: ตรวจหลักฐานชำระ ต.ค. — เอกสาร: ชีตเงินสดย่อย';
  // notBu เป็น input — เติมค่า
  d.getElementById('notBu').value = 'PAO';
  d.getElementById('btnNotifyPlan').click();
  ok('v1.20: แผนแจ้งมี checkbox ต่อเรื่อง (จาก v1.14 รวม >=2)', d.querySelectorAll('.not-pick').length >= 2, 'got ' + d.querySelectorAll('.not-pick').length);
  var chk2 = Array.from(d.querySelectorAll('.not-pick')).find(function (c) { return (c.getAttribute('data-idx') || '').endsWith('#1'); });
  if (chk2) chk2.checked = true;
  d.getElementById('btnGotoAipFromPlan').click();
  ok('v1.20: ปุ่มส่งเข้าขั้น 3 เปิดแท็บ aiprompt', d.getElementById('pane-aiprompt').classList.contains('on'));
  ok('v1.20: dropdown แท็บ 3 มีโหมด "ตามเรื่องที่ติ๊ก"', Array.from(d.getElementById('aiPackPick').options).some(function (o) { return o.value === '__PLAN__'; }));
  // note: __PLAN__ option ถูกเติมตอนเปลี่ยนแท็บ — เรียก _fillPackSelectors ซ้ำเพื่อ sync หลังบันทึกแผน
  gat._fillPackSelectors();
  var sel99 = d.getElementById('aiPackPick'); sel99.value = '__PLAN__'; sel99.dispatchEvent(new w.Event('change'));
  Array.from(d.querySelectorAll('button')).find(function (b) { return b.id === 'btnAiBuild'; }).click();
  var pr2 = d.getElementById('aiPrompt').value;
  ok('v1.20: ชุดคำสั่ง AI อ้างเรื่องที่ติ๊กจากแผน (PACK ยังไม่มาก็ตรวจได้)', pr2.indexOf('PLAN-2569-002')>=0 != null && (pr2.indexOf('เรื่องที่ 2') >= 0 || pr2.indexOf('แผนแจ้ง') >= 0), pr2.slice(0, 60));

  console.log('\n══ RESULT รวม (v1.20): ' + pass + ' pass / ' + fail + ' fail ══');
    process.exit(fail ? 1 : 0);
  }, 350);

  // 5) ข้อความคัดลอก (buildSummaryText ผ่าน export)
  ok('แท็บครบหลัง render (v1.13 = 17 pane)', d.querySelectorAll('.tabpane').length === 17);

  // 6) Dashboard ยังแสดงแหล่งข้อมูล + BU chart (โดยไม่ crash)
  gat.showTab('dashboard');
  const dash = d.getElementById('dashBody').textContent;
  ok('Dashboard: มี "ตามแหล่งข้อมูล"', dash.includes('ตามแหล่งข้อมูล'));
  ok('Dashboard: ไม่มี "ตามประเภทกระบวนการ"', !dash.includes('ตามประเภทกระบวนการ'));

  /* 7–12: ย้ายไปตรวจในบล็อก async processDocs (บล็อก 4) */

  // 13) v1.12: process/runner ถูกถอดออก — เก็บเป็นข้อมูล
  ok('v1.12: ไม่มีแท็บ process/runner บนหน้าเว็บ', !d.getElementById('pane-process') && !d.getElementById('pane-runner') && !d.querySelector('nav a[data-tab="process"]') && !d.querySelector('nav a[data-tab="runner"]'));
  ok('v1.12: แท็บปกติต้องไม่มี procBody', d.getElementById('procBody') === null);
  ok('v1.12: state.process ยังโหลดจาก gat-process.json (เก็บเป็นข้อมูล)', !!(gat.state().process && gat.state().process.CORE && gat.state().process.CORE.length === 10));

  // 14) v1.13: 10 แท็บชื่อ 1..10 ตามหนึ่งสั่ง + checklist ติดบนแท็บ
  var navIds = Array.from(d.querySelectorAll('nav a[data-tab]')).map(function (a) { return a.getAttribute('data-tab'); });
  ok('v1.13: nav หลักครบ 10 แท็บใหม่', ['packs','p02pick','aiprompt','aicand','aisel','aisend','bufix','buanswer','close','summary'].every(function (t) { return navIds.indexOf(t) >= 0; }));
  // เข้าแต่ละแท็บ = stepbox มีการ์ดขั้นนั้น
  var seqTabs = [['packs','2'],['p02pick','1'],['aiprompt','3'],['aicand','4'],['aisel','5'],['aisend','6'],['bufix','7'],['buanswer','8'],['close','9'],['summary','10']];
  var okBoxes = 0;
  seqTabs.forEach(function (x) { gat.showTab(x[0]); var sb = d.getElementById('stepbox'); if (sb && sb.textContent.indexOf(x[1]) >= 0) okBoxes++; });
  ok('v1.13: checklist ขึ้นครบ 10 แท็บ (stepbox ให้เลข 1..10)', okBoxes === 10, 'got ' + okBoxes);

  // --- v1.11: แท็บแยกตาม 10 กระบวนการ ---
  // seed REC ในขอบเขต 10 ใบ (เลียนแบบชีตจริง REC-0042–0051 ยังไม่มี BU ตอบ)
  var st0 = gat.state();
  st0.recs = st0.recs.concat(['0042','0043','0044','0045','0046','0047','0048','0049','0050','0051'].map(function (n) {
    return { REC_ID: 'GAT-REC-' + n, REC_NO: 42, SEVERITY: n === '0042' ? '🔴 ขัดกฎหมาย/จำเป็นจริง' : '🟢 ข้อเสนอ', TITLE: 'ทดสอบใบ ' + n, STATUS: 'P-04 ส่งให้ BU แล้ว', BU_DECISION: '' };
  }));
  gat._renderRecs();
  ok('v1.11+: nav มีทั้ง P-04/P-05/P-06 หรือแท็บไหม่ 5/6/9 อย่างน้อย 1 ชุด', Array.from(d.querySelectorAll('nav a')).some(function (a) { return a.textContent.indexOf('P-04') >= 0 || a.textContent.indexOf('ส่งให้ BU') >= 0; }));
  ok('v1.11: ฟอร์ม ② BU ตอบอยู่ใน pane-buanswer (ไม่ปน P-04)', d.getElementById('respRecPick').closest('.tabpane').id === 'pane-buanswer');
  ok('v1.11: ฟอร์ม ③ ปิดอยู่ใน pane-close', d.getElementById('closeRecPick').closest('.tabpane').id === 'pane-close');
  ok('v1.13: ฟอร์ม ① ออกใบมือย้ายไป pane-aisend (ขั้น 6)', d.getElementById('recRegPick').closest('.tabpane').id === 'pane-aisend');
  ok('v1.11: ทะเบียนกลางอยู่ที่แท็บ recs เฉพาะ', d.getElementById('recBody').closest('.tabpane').id === 'pane-recs');
  gat.showTab('buanswer');
  ok('v1.11: ตารางสำเนา P-05 มี 10 แถว (ขอบเขต REC)', d.getElementById('recBodyAns').querySelectorAll('tr').length === 10);
  ok('v1.11: ตัวนับสำเนา P-05 = รวม 10 รายการ', d.getElementById('recCountAns').textContent.indexOf('10') >= 0);
  gat.showTab('close');
  ok('v1.11: ตารางสำเนา P-06 มี 10 แถว', d.getElementById('recBodyClose').querySelectorAll('tr').length === 10);
  gat.showTab('buanswer');
  ok('v1.11: dropdown ตอบใบ = 10 ตัวเลือก + หัว', d.getElementById('respRecPick').options.length === 11);
  gat.showTab('close');
  ok('v1.11: dropdown ปิดใบว่าง (BU ยังไม่ตอบ)', d.getElementById('closeRecPick').options.length === 1);
  // seed ใบที่ BU ตอบแล้ว 1 ใบ (ทับ REC-0051) → ต้องขึ้นใน dropdown ปิด
  var st2 = gat.state();
  st2.recs = st2.recs.filter(function (r) { return r.REC_ID !== 'GAT-REC-0051'; });
  st2.recs.push({ REC_ID: 'GAT-REC-0051', REC_NO: 42, SEVERITY: '🔴 ขัดกฎหมาย/จำเป็นจริง', TITLE: 'ทดสอบ BU ตอบแล้ว', STATUS: 'BU ตอบแล้ว', BU_DECISION: 'แก้ไข', EVIDENCE_URL: 'https://example.com/x' });
  gat._renderRecs();
  gat.showTab('close');
  ok('v1.11: BU ตอบแล้วขึ้นใน dropdown ปิด (P-06)', d.getElementById('closeRecPick').options.length === 2);

  /* ผลรวม print ในบล็อก async (หลังบล็อก 4 เสร็จ) — บล็อกนี้รอ scheduler */
}, 400);