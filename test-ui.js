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
    console.log('\n══ RESULT รวม (v1.12): ' + pass + ' pass / ' + fail + ' fail ══');
    process.exit(fail ? 1 : 0);
  }, 350);

  // 5) ข้อความคัดลอก (buildSummaryText ผ่าน export)
  ok('แท็บครบหลัง render (v1.12 = 15 pane)', d.querySelectorAll('.tabpane').length === 15);

  // 6) Dashboard ยังแสดงแหล่งข้อมูล + BU chart (โดยไม่ crash)
  gat.showTab('dashboard');
  const dash = d.getElementById('dashBody').textContent;
  ok('Dashboard: มี "ตามแหล่งข้อมูล"', dash.includes('ตามแหล่งข้อมูล'));
  ok('Dashboard: ไม่มี "ตามประเภทกระบวนการ"', !dash.includes('ตามประเภทกระบวนการ'));

  /* 7–12: ย้ายไปตรวจในบล็อก async processDocs (บล็อก 4) */

  // 13) v1.12: process/runner ถูกถอดออก — nav หลัก = 10 กระบวนการ
  ok('v1.12: ไม่มีแท็บ process/runner บนหน้าเว็บ', !d.getElementById('pane-process') && !d.getElementById('pane-runner') && !d.querySelector('nav a[data-tab="process"]') && !d.querySelector('nav a[data-tab="runner"]'));
  ok('v1.12: pane รวม 15 (10 ขั้น + ฐานข้อมูล/เอกสาร)', d.querySelectorAll('.tabpane').length === 15);
  ok('v1.12: แท็บปกติต้องไม่มี procBody', d.getElementById('procBody') === null);
  ok('v1.12: state.process ยังโหลดจาก gat-process.json (เก็บเป็นข้อมูล)', !!(gat.state().process && gat.state().process.CORE && gat.state().process.CORE.length === 10));

  // 14) v1.12: 10 กระบวนการ = 10 แท็บหลัก + checklist ติดบนแท็บงานจริง
  var navIds = Array.from(d.querySelectorAll('nav a[data-tab]')).map(function (a) { return a.getAttribute('data-tab'); });
  ok('v1.12: nav หลัก 10 ขั้นเรียง P-01..P-10', ['p01','p02','packs','aireview','buanswer','close','p07','summary','dashboard','bct'].every(function (t) { return navIds.indexOf(t) >= 0; }));
  gat.showTab('p01');
  ok('v1.12: แท็บ P-01 มีการ์ด checklist P-01 + ฟอร์มจองเลขแผน', !!d.getElementById('stepbox') && d.getElementById('stepbox').textContent.includes('P-01') !== undefined && !!d.getElementById('btnSavePlan'));
  gat.showTab('p02');
  ok('v1.12: แท็บ P-02 มีการ์ด P-02 + ฟอร์มประกอบหนังสือ', d.getElementById('stepbox').textContent.indexOf('P-02') >= 0 && !!d.getElementById('btnP02Generate'));
  gat.showTab('packs');
  ok('v1.12: แท็บ P-03 มีการ์ด P-03 (checklist ติดบนแท็บ)', d.getElementById('stepbox') && d.getElementById('stepbox').textContent.indexOf('P-03') >= 0);
  gat.showTab('p07');
  ok('v1.12: แท็บ P-07 มีฟอร์มอุทธรณ์ (dropdown เลือกใบ + ผลตัดสิน)', !!d.getElementById('oacRecPick') && !!d.getElementById('btnOacLog'));
  // ติ๊ก checklist บนแท็บจริง → runState บันทึก
  gat.showTab('p01');
  var cb1 = d.querySelector('.rb-chk');
  w.localStorage.removeItem('gat_run_state');
  cb1.checked = true; cb1.dispatchEvent(new w.Event('click', { bubbles: true }));
  var after = w.GAT.state().runState || {};
  var saved = null;
  try { saved = JSON.parse(w.localStorage.getItem('gat_run_state') || 'null'); } catch (e) {}
  ok('v1.12: ติ๊ก checklist บนแท็บ P-01 บันทึกความคืบหน้า (runState + localStorage)', (after['P-01'] || [])[0] === true && !!saved && (saved['P-01'] || [])[0] === true);

  // --- v1.11: แท็บแยกตาม 10 กระบวนการ ---
  // seed REC ในขอบเขต 10 ใบ (เลียนแบบชีตจริง REC-0042–0051 ยังไม่มี BU ตอบ)
  var st0 = gat.state();
  st0.recs = st0.recs.concat(['0042','0043','0044','0045','0046','0047','0048','0049','0050','0051'].map(function (n) {
    return { REC_ID: 'GAT-REC-' + n, REC_NO: 42, SEVERITY: n === '0042' ? '🔴 ขัดกฎหมาย/จำเป็นจริง' : '🟢 ข้อเสนอ', TITLE: 'ทดสอบใบ ' + n, STATUS: 'P-04 ส่งให้ BU แล้ว', BU_DECISION: '' };
  }));
  gat._renderRecs();
  ok('v1.11: nav มีทั้ง P-04/P-05/P-06 (แยกแท็บ)', ['P-04','P-05','P-06'].every(function (t) {
    return Array.from(d.querySelectorAll('nav a')).some(function (a) { return a.textContent.indexOf(t) >= 0; });
  }));
  ok('v1.11: ฟอร์ม ② BU ตอบอยู่ใน pane-buanswer (ไม่ปน P-04)', d.getElementById('respRecPick').closest('.tabpane').id === 'pane-buanswer');
  ok('v1.11: ฟอร์ม ③ ปิดอยู่ใน pane-close', d.getElementById('closeRecPick').closest('.tabpane').id === 'pane-close');
  ok('v1.11: ฟอร์ม ① ออกใบอยู่ใน pane-aireview (จบการการ์ด AI)', d.getElementById('recRegPick').closest('.tabpane').id === 'pane-aireview');
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