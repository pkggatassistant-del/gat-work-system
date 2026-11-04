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
  const ok = (name, cond) => { if (cond) pass++; else { fail++; console.error('❌ ' + name); } };

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

  // 4) แผนภาพ เอกสารข้อกำหนด (meta.hierarchy) ตามภาพจริง
  gat.showTab('process');
  const proc = d.getElementById('procBody').textContent;
  ok('แท็บกระบวนการ: หัว "ความสัมพันธ์ของเอกสารข้อกำหนด"', proc.includes('ความสัมพันธ์ของเอกสารข้อกำหนด'));
  ok('แผนภาพ: PM กำหนดว่าต้องทำอะไร ใครรับผิดชอบ', proc.includes('กำหนดว่าต้องทำอะไร ใครรับผิดชอบ และทำเมื่อไหร่'));
  ok('แผนภาพ: มีปลายทาง Evidence / KPI / Audit', proc.includes('Evidence / KPI / Audit'));
  ok('แผนภาพ: SD = เอกสารข้อกำหนดคุณลักษณะงาน', proc.includes('เอกสารข้อกำหนดคุณลักษณะงาน'));
  ok('hero แสดง v2.7 (ตัดชื่อยาว)', proc.includes('v2.8'));

  // 5) ข้อความคัดลอก (buildSummaryText ผ่าน export)
  ok('แท็บครบหลัง render (v1.11 = 14 pane)', d.querySelectorAll('.tabpane').length === 14);

  // 6) Dashboard ยังแสดงแหล่งข้อมูล + BU chart (โดยไม่ crash)
  gat.showTab('dashboard');
  const dash = d.getElementById('dashBody').textContent;
  ok('Dashboard: มี "ตามแหล่งข้อมูล"', dash.includes('ตามแหล่งข้อมูล'));
  ok('Dashboard: ไม่มี "ตามประเภทกระบวนการ"', !dash.includes('ตามประเภทกระบวนการ'));

  // 7) CORE 10 กระบวนการ แสดงในแท็บกระบวนการ
  ok('CORE: มีตาราง "กระบวนการที่จำเป็น 10"', proc.includes('กระบวนการที่จำเป็น 10'));
  ok('CORE: มี P-01 ถึง P-10', proc.includes('P-01') && proc.includes('P-10'));
  ok('CORE: อ้าง FM-01 ใน P-04', proc.includes('FM-01'));

  // 8) หลักการแบ่งหน้าที่ 7 หน่วยงาน
  ok('ROLES: มีตาราง 7 หน่วยงาน + OAC/BMC/Process Owner', proc.includes('7 หน่วยงาน') && proc.includes('OAC') && proc.includes('BMC') && proc.includes('Process Owner') && proc.includes('GAT Coordinator'));
  ok('ROLES: มีข้อสำคัญ เจ้าของกระบวนการรับผิดชอบจริง', proc.includes('เจ้าของกระบวนการ (Process Owner) ต้องเป็นผู้จัดทำ'));

  // 9) แม่แบบ PM 18 หัวข้อ
  ok('PM_TEMPLATE: 18 หัวข้อ + Process Code/Records & Evidence', proc.includes('แม่แบบ PM — เอกสารกระบวนการ 18 หัวข้อ') && proc.includes('Process Code') && proc.includes('Records & Evidence'));

  // 10) แม่แบบ WI 15 หัวข้อ + กฎแตกจาก PM
  ok('WI_TEMPLATE: 15 หัวข้อ + Reference PM/Completion Criteria', proc.includes('แม่แบบ WI — คำสั่งปฏิบัติ 15 หัวข้อ') && proc.includes('Reference PM') && proc.includes('Completion Criteria'));
  ok('WI_RULE: กฎ "WI ต้องแตกจากขั้นตอนของ PM" แสดงบนหน้า', proc.includes('WI ต้องแตกออกมาจากแต่ละขั้นตอนของ PM'));
  ok('WI_PRINCIPLE: หลักเกณฑ์ อ่านแล้วทำตามได้จริง', proc.includes('ผู้ปฏิบัติงานต้องอ่านแล้วทำตามได้จริง'));

  // 11) มาตรฐาน SD 6 กลุ่ม + 4 ช่องบังคับ
  ok('SD_GROUPS: 6 กลุ่ม (Policy→Checklist)', proc.includes('Supporting Document 6 กลุ่ม') && proc.includes('Policy') && proc.includes('Checklist') && proc.includes('Guideline'));
  ok('SD_FIELDS: เจ้าของ/แหล่ง/บังคับ/ทบทวน แสดง', proc.includes('เจ้าของเอกสาร') && proc.includes('สถานะการทบทวน'));
  ok('SD register: มีคอลัมน์แหล่งที่มา + จัดตามกลุ่ม', proc.includes('จัดตามกลุ่มมาตรฐาน') && proc.includes('แหล่งที่มา'));

  // 12) มาตรฐาน FM 11 ช่อง
  ok('FM_FIELDS: 11 ช่อง + Reference PM/WI + ผู้อนุมัติ', proc.includes('แบบฟอร์มบันทึกผล 11 ช่อง') && proc.includes('Reference PM / WI') && proc.includes('ผู้อนุมัติ (ถ้ามี)'));
  ok('FM_PRINCIPLE: ไม่สร้างฟอร์มเกินจำเป็น', proc.includes('ไม่ควรสร้างแบบฟอร์มมากเกินความจำเป็น'));

  const runTxt = d.getElementById('runBody').textContent;
  // 13) Runner: แท็บใหม่ + การ์ด 10 ขั้น + checklist ติ๊กได้
  ok('แท็บ runner อยู่ในระบบ (14 pane + nav)', d.querySelectorAll('.tabpane').length === 14 && d.getElementById('runBody') !== null);
  ok('Runner: hero CORE 10 + KPI ผ่านแล้ว', runTxt.includes('เดินกระบวนการ CORE 10') && runTxt.includes('ผ่านแล้ว'));
  ok('Runner: มี P-01..P-10 ครบ + ชี้จุด PM', runTxt.includes('P-01') && runTxt.includes('P-10') && runTxt.includes('PM:'));
  ok('Runner: มีปุ่มไปทำจริง (ออกใบ/บันทึกคำตอบ/ปิดรายการ)', runTxt.includes('ออกใบที่แท็บ P-04') && runTxt.includes('ตอบใบที่แท็บ P-05') && runTxt.includes('ปิดรายการ (GAT ยืนยัน) ที่แท็บ P-06'));
  // ติ๊ก checklist ขั้นแรก แล้วเลขผ่านต้องขยับ
  var cb1 = d.querySelector('.rb-chk');
  w.localStorage.removeItem('gat_run_state');
  cb1.checked = true; cb1.dispatchEvent(new w.Event('click', { bubbles: true }));
  var after = w.GAT.state().runState || {};
  var saved = null;
  try { saved = JSON.parse(w.localStorage.getItem('gat_run_state') || 'null'); } catch (e) {}
  ok('Runner: ติ๊ก checklist บันทึกความคืบหน้า (runState + localStorage)', (after['P-01'] || [])[0] === true && !!saved && (saved['P-01'] || [])[0] === true);

  // --- v1.11: แท็บแยกตาม 10 กระบวนการ ---
  // seed REC ในขอบเขต 10 ใบ (เลียนแบบชีตจริง REC-0042–0051 ยังไม่มี BU ตอบ)
  var st0 = gat.state();
  st0.recs = st0.recs.concat(['0042','0043','0044','0045','0046','0047','0048','0049','0050','0051'].map(function (n) {
    return { REC_ID: 'GAT-REC-' + n, REC_NO: 42 + 0, SEVERITY: n === '0042' ? '🔴 ขัดกฎหมาย/จำเป็นจริง' : '🟢 ข้อเสนอ', TITLE: 'ทดสอบใบ ' + n, STATUS: 'P-04 ส่งให้ BU แล้ว', BU_DECISION: '' };
  }));
  gat._renderRecs();
  ok('v1.11: nav มีทั้ง P-04/P-05/P-06 (แยกแท็บ)', ['P-04','P-05','P-06'].every(function (t) {
    return Array.from(d.querySelectorAll('nav a')).some(function (a) { return a.textContent.indexOf(t) >= 0; });
  }));
  ok('v1.11: ฟอร์ม ② BU ตอบอยู่ใน pane-buanswer (ไม่ปน P-04)', d.getElementById('respRecPick').closest('.tabpane').id === 'pane-buanswer');
  ok('v1.11: ฟอร์ม ③ ปิดอยู่ใน pane-close', d.getElementById('closeRecPick').closest('.tabpane').id === 'pane-close');
  ok('v1.11: ฟอร์ม ① ออกใบอยู่ใน pane-aireview (จบการการ์ด AI)', d.getElementById('recRegPick').closest('.tabpane').id === 'pane-aireview');
  ok('v1.11: ทะเบียนกลางอยู่在แท็บ recs เฉพาะ', d.getElementById('recBody').closest('.tabpane').id === 'pane-recs');
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

  console.log('\n══ RESULT: ' + pass + ' pass / ' + fail + ' fail ══');
  process.exit(fail ? 1 : 0);
}, 400);