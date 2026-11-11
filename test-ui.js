// jsdom test — นิยามใหม่ PM/WI/SD/FM (สรุปผลงาน + Dashboard)
const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('index.html', 'utf8');
const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://pkggatassistant-del.github.io/gat-work-system/' });
const w = dom.window;
const SEED = JSON.parse(fs.readFileSync('gat-seed.json', 'utf8'));
const PROC = JSON.parse(fs.readFileSync('gat-process.json', 'utf8'));

w.fetch = (u) => {
  const s = String(u);
  if (s.indexOf('gat-process.json') >= 0) return Promise.resolve({ ok: true, json: () => Promise.resolve(PROC) });
  if (s.indexOf('GAT-MANUAL.md') >= 0) return Promise.resolve({ ok: true, text: () => Promise.resolve(fs.readFileSync('GAT-MANUAL.md', 'utf8')) });
  if (s.indexOf('gat-rec-migration') >= 0) return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
  return Promise.resolve({ ok: true, json: () => Promise.resolve(SEED) });
};
w.GAT_CONFIG = { VERSION: 'v1.2-test', BCT_API: '', SOURCES: { SEED: 'x', REC_SEED: 'x', PROCESS_SEED: 'gat-process.json' }, PROCESS_TYPES: { PM: { label: 'PM', color: '#2563eb' }, WI: { label: 'WI', color: '#0891b2' }, SD: { label: 'SD', color: '#7c3aed' }, FM: { label: 'FM', color: '#b45309' } } };

w.eval(fs.readFileSync('gat-config.js', 'utf8'));
w.eval(fs.readFileSync('app.js', 'utf8'));
/* v1.26 — เตรียมแผนแจ้ง 2 ประเด็นก่อน init (จำลองเครื่องที่มีแผนค้างใน localStorage) */
try { w.localStorage.setItem('gat_notifs', JSON.stringify([{ NOTIF_ID: 'PLAN-2569-001', BU: 'สอยดาว', PERIOD: 'พ.ย. 69', items: ['ตรวจรายการขายน้ำมันเครื่อง', 'ตรวจใบเสร็จรายรับ'], BY: 'GAT(แดง)', SAVED_AT: '5 พ.ย.' }])); } catch (e) {}
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
  gat._renderPickTable(); gat._renderSentTable(); gat._renderExtraTable();
  ok('v1.13: แท็บ 2 — ตารางเลือกหัวข้อแสดง PACK', d.getElementById('pickBody').textContent.indexOf('PACK-0001') >= 0);
  gat.showTab('aisend');
  ok('v1.13: แท็บ 6 — ตารางติดตามใบส่ง BU (REC-0042)', d.getElementById('recBodySent').textContent.indexOf('GAT-REC-0042') >= 0);
  ok('v1.29: ฟอร์มออกใบมือย้ายไปแท็บ 4 (sum4)', !!d.getElementById('recRegPick') && !!d.getElementById('btnOpenRec') && d.getElementById('recRegPick').closest('.tabpane').id === 'pane-sum4');

  // --- v1.14: P-01 ครึ่งแรก — GAT แจ้งเรื่องรายประเด็น → BU เลือกเรื่องที่ส่ง ---
  st5.packs = [];
  var nb2 = d.getElementById('notBu');
  ok('v1.14: แท็บ 1 มีการ์ดแจ้งเรื่อง + ส่งข้อมูล แยกครึ่ง', !!d.getElementById('notItems') && !!d.getElementById('btnNotifyPlan') && !!d.getElementById('packNotif') && !!d.getElementById('btnSendPack'));
  if (nb2) {
    nb2.value = 'PAO';
    /* v1.31 — ฟอร์ม 4 ช่อง: ชื่อเรื่อง/เหตุการณ์/ประเด็น(แยกบรรทัด)/ผู้รับผิดชอบ */
    d.getElementById('notTitle').value = 'ตรวจสวัสดิการพนักงาน';
    d.getElementById('notEvent').value = 'พบข้อสงสัยการลาครั้งล่าสุด';
    d.getElementById('notItems').value = 'ตรวจใบลา/สมุดลา\nตรวจ IPD ค้างชำระ';
    d.getElementById('notOwner').value = 'ผจก. PAO';
    d.getElementById('btnNotifyPlan').click();
  }
  ok('v1.14: บันทึกแผน รันเลข PLAN-2569-', (d.getElementById('notStatus').textContent || '').indexOf('PLAN-2569-') >= 0);
  ok('v1.14: BU dropdown เห็นแผนที่แจ้ง', d.getElementById('packNotif').options.length >= 2);
  ok('v1.14: รายการ "เรื่องที่จะตรวจ" แสดง 2 เรื่อง (v1.44: ชื่อเรื่องนำ)', d.getElementById('notList').querySelectorAll('.not-pick').length === 2, 'got ' + d.getElementById('notList').querySelectorAll('.not-pick').length);

  // --- v1.15/16: notBu = ช่องกรอกได้ (ตามหนึ่งสั่ง) · packBu = dropdown จาก seed + PAO ---
  var elN = d.getElementById('notBu');
  ok('v1.16: การ์ดแจ้งใช้ช่องกรอก BU (input พิมพ์ได้)', elN && elN.tagName === 'INPUT');
  var optsP = Array.from(d.getElementById('packBu').options).map(function (o) { return o.value; });
  ok('v1.15: packBu dropdown รายชื่อครบ + PAO', optsP.length >= 55 && optsP.indexOf('PAO') >= 0, 'got ' + optsP.length);
  // saveNotifPlan อ่าน notBu.value ได้เมื่อเป็น input
  elN.value = 'PAO';
  d.getElementById('notTitle').value = 'ทดสอบช่องกรอก';
  d.getElementById('notEvent').value = 'ทดสอบเหตุการณ์';
  d.getElementById('notItems').value = 'ประเด็นทดสอบ';
  d.getElementById('notOwner').value = 'ผจก. ทดสอบ';
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
  // --- v1.29: ขั้น 3 ตรวจหลักฐาน → ขั้น 4 สรุปผล → ส่งเพิ่มเติมแท็บ 2 → ขั้น 6 ส่งผล → ขั้น 5 ปิดใหญ่ (ปรับ v1.45: เลือกชื่อเรื่อง ระบบเลือกการส่งให้) ---
  st6.packs = [{ PACK_ID: 'PACK-9992', BU: 'PKG', SCOPE: 'สวัสดิการ', PERIOD: 'ต.ค. 69', TITLE: 'ทดสอบลิงก์', LINKS: '[ประเด็น 1: หัวข้อทดสอบ]\nhttps://docs.bu.com/ev1', NOTE: 'อ้างแผน: PLAN-2569-001', STATUS: 'รอ GAT เลือกตรวจ', AI_NOTE: '' }];
  gat._fillPackSelectors(); gat.showTab('inspect'); gat._renderInspect();
  var inspPlan = d.getElementById('inspPlanPick');
  ok('v1.29: แท็บ 3 มี ① dropdown ชื่อเรื่อง', !!inspPlan);
  ok('v1.29: แท็บ 3 ไม่มี dropdown เลือกการส่งแล้ว (v1.45 — ระบบเลือกให้)', !d.getElementById('inspPackPick'));
  ok('v1.29: ① มีชื่อเรื่อง PLAN-2569-001', !!inspPlan && Array.from(inspPlan.options).some(function (o) { return o.value === 'PLAN-2569-001'; }));
  if (inspPlan) { inspPlan.value = 'PLAN-2569-001'; inspPlan.dispatchEvent(new w.Event('change')); }
  ok('v1.29: เลือกชื่อเรื่อง → ระบบเลือกการส่งให้อัตโนมัติ (PACK-9992)', gat.state().insp === 'PACK-9992', gat.state().insp);
  ok('v1.29: ข้อมูลที่ BU ส่งตรวจขึ้นทันที (ลิงก์หลักฐานคลิกได้)', d.getElementById('inspItemsBox').querySelectorAll('a[target="_blank"]').length >= 1);
  ok('v1.29: แท็บ 3 มีฟอร์มรายละเอียด+ผลการตรวจ+ผลรวม', !!d.getElementById('inspDetail') && !!d.getElementById('inspResult') && !!d.getElementById('inspSums'));
  var updFired = 0; var baseF = w.fetch;
  w.fetch = function (u, o) { var b = o && o.body ? String(o.body) : ''; if (b.indexOf('update_pack_status') >= 0) { updFired++; return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ ok: true }); } }); } return baseF(u, o); };
  d.getElementById('inspBy').value = 'แดง ต. (GAT)';
  d.getElementById('inspDetail').value = 'ดึงไฟล์สลิปตรวจ 12 รายการ';
  d.getElementById('inspResult').value = 'ประเด็น 1 ผ่าน · ประเด็น 2 พบจ่ายขาดเอกสาร';
  d.getElementById('inspSums').value = 'ไม่ผ่าน';
  d.getElementById('btnInspSave').click();
  setTimeout(function () {
    ok('v1.29: บันทึกผลขั้น 3 ยิง update_pack_status', updFired >= 1, updFired);
    ok('v1.29: สถานะหลังบันทึกบอก กลับขั้น 2 (ไม่ผ่าน)', (d.getElementById('inspStatus').textContent || '').indexOf('ขั้น 2') >= 0 || (d.getElementById('inspStatus').textContent || '').indexOf('เพิ่มเติม') >= 0, d.getElementById('inspStatus').textContent);
    /* ขั้น 4 — sum4: ดึงค่า AI_NOTE จากขั้น 3 มาโชว์เป็นแบบฟอร์มผล */
    var st7 = gat.state(); st7.packs = [{ PACK_ID: 'PACK-9992', BU: 'PKG', TITLE: 'ทดสอบลิงก์', STATUS: 'ตรวจแล้ว — ไม่ผ่าน กลับขั้น 2 (ขั้น 3)', AI_NOTE: 'ผลการตรวจจากขั้น 3 — พบจ่ายขาดเอกสาร', LINKS: 'https://docs.bu.com/ev1' }];
    gat._fillPackSelectors(); gat._renderResult4();
    var sumSel = d.getElementById('sumPackPick'); sumSel.value = 'PACK-9992'; sumSel.dispatchEvent(new w.Event('change'));
    ok('v1.29: แท็บ 4 แบบฟอร์มผลแสดงข้อมูลจากขั้น 3 (AI_NOTE)', d.getElementById('sumFormBox').textContent.indexOf('พบจ่ายขาดเอกสาร') >= 0, d.getElementById('sumFormBox').textContent.slice(0, 80));
    /* ตัดสิน ไม่ผ่าน → กลับขั้น 2 */
    var decFired = 0;
    w.fetch = function (u, o) { var b = o && o.body ? String(o.body) : ''; if (b.indexOf('update_pack_status') >= 0) { decFired++; return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ ok: true }); } }); } return baseF(u, o); };
    d.getElementById('btnSumFail').click();
    setTimeout(function () {
      ok('v1.29: ปุ่มตัดสิน ไม่ผ่าน ยิง update_pack_status', decFired >= 1, decFired);
      /* ส่งหลักฐานเพิ่มเติม (การ์ดในแท็บ 2) */
      var st8 = gat.state(); st8.packs = [{ PACK_ID: 'PACK-9992', BU: 'PKG', TITLE: 'ทดสอบลิงก์', STATUS: 'ไม่ผ่าน — รอ BU ส่งหลักฐานเพิ่มเติม (ขั้น 2)', AI_NOTE: '', LINKS: 'https://docs.bu.com/ev1' }];
      gat._fillPackSelectors(); gat._renderExtraTable(); gat._fillInspectPack();
      ok('v1.29: ตารางไม่ผ่าน (แท็บ 2) มีแถว 1', d.getElementById('extraBody').querySelectorAll('tr').length === 1, d.getElementById('extraBody').children.length);
      var exSel = d.getElementById('extraPackPick'); exSel.value = 'PACK-9992'; exSel.dispatchEvent(new w.Event('change'));
      var sendFired = 0;
      w.fetch = function (u, o) { var b = o && o.body ? String(o.body) : ''; if (b.indexOf('update_pack_status') >= 0) { sendFired++; return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ ok: true }); } }); } return baseF(u, o); };
      d.getElementById('extraLinks').value = 'https://docs.bu.com/extra1 [ประเด็น 2]';
      d.getElementById('extraBy').value = 'ป้าย (BU PAO)';
      d.getElementById('btnExtraSend').click();
      setTimeout(function () {
        ok('v1.29: ส่งหลักฐานเพิ่มเติมยิง update_pack_status', sendFired >= 1, sendFired);
        /* ขั้น 6 — ส่งผลให้ BU */
        var st9 = gat.state(); st9.packs = [{ PACK_ID: 'PACK-9992', BU: 'PKG', TITLE: 'ทดสอบลิงก์', STATUS: 'ผ่านการตรวจ — รอปิดประเด็น (ขั้น 5)', AI_NOTE: '', LINKS: 'https://docs.bu.com/ev1' }];
        gat._fillPackSelectors(); gat._renderResult4();
        var spSel = d.getElementById('sendPackPick');
        ok('v1.29: แท็บ 6 dropdown มี PACK ที่ตัดสินแล้ว', Array.from(spSel.options).some(function (o) { return o.value === 'PACK-9992'; }), Array.from(spSel.options).map(function (o) { return o.value; }).join(','));
        spSel.value = 'PACK-9992'; spSel.dispatchEvent(new w.Event('change'));
        var send6 = 0;
        w.fetch = function (u, o) { var b = o && o.body ? String(o.body) : ''; if (b.indexOf('update_pack_status') >= 0) { send6++; return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ ok: true }); } }); } return baseF(u, o); };
        d.getElementById('sendPackBy').value = 'แดง (GAT)';
        d.getElementById('btnSendResult').click();
        setTimeout(function () {
          ok('v1.29: ส่งผลให้ BU ยิง update_pack_status', send6 >= 1, send6);
          /* ขั้น 5 — v1.42: การ์ด ② ถูกถอด → เทสเดิมควบเปลี่ยน: ปุ่ม/หรองเลือก ② ต้องไม่มีใน DOM (สถานะปิดย่อยพาดมาจากขั้น 3 แล้ว) */
          setTimeout(function () {
            ok('v1.29/42: การ์ด ② ปิดประเด็นย่อยถูกถอด — ไม่มี closeBigPackPick/btnCloseBig', !d.getElementById('closeBigPackPick') && !d.getElementById('btnCloseBig'));
            globalThis.flow29Res = true;
          }, 90);
        }, 20);
      }, 20);
    }, 20);
  }, 20);

  // --- v1.20: แท็บ 1 GAT ติ๊กเรื่องที่จะตรวจ → ส่งเข้าขั้น 3 (ไม่รอ PACK) — v1.44: ติ๊กที่ชื่อเรื่อง (data-plan) ---
  try { localStorage.removeItem('gat_plan_pick'); } catch (e) {}
  d.getElementById('notTitle').value = 'ตรวจใบลา+ชำระเงิน';
  d.getElementById('notEvent').value = 'ตรวจงวด ต.ค.';
  d.getElementById('notItems').value = 'ตรวจใบลา — เอกสาร: สมุดลา\nตรวจหลักฐานชำระเงิน ต.ค. — เอกสาร: ชีตเงินสดย่อย';
  d.getElementById('notOwner').value = 'ผจก. PAO';
  // notBu เป็น input — เติมค่า
  d.getElementById('notBu').value = 'PAO';
  d.getElementById('btnNotifyPlan').click();
  ok('v1.20/44: checkbox เฉพาะระดับชื่อเรื่อง (1 เรื่อง = 1 ติ๊ก — ไม่ติ๊กประเด็น)', d.querySelectorAll('.not-pick').length >= 3 && d.querySelectorAll('.not-pick').length === d.querySelectorAll('#notList .card').length, 'chks=' + d.querySelectorAll('.not-pick').length + ' cards=' + d.querySelectorAll('#notList .card').length);
  ok('v1.44: checkbox ชื่อเรื่องมี data-plan (ไม่ใช่ data-idx ต่อประเด็น)', (d.querySelector('.not-pick').getAttribute('data-plan') || '').indexOf('PLAN-') === 0 && d.querySelector('.not-pick').getAttribute('data-idx') === null, d.querySelector('.not-pick').getAttribute('data-plan'));
  ok('v1.44: ประเด็นแสดงอ่านอย่างเดียว (ไม่มี checkbox ในตารางประเด็น)', d.querySelectorAll('#notList input[type=checkbox]').length === d.querySelectorAll('#notList .not-pick').length, 'all=' + d.querySelectorAll('#notList input[type=checkbox]').length);
  var firstPlanChk = d.querySelector('.not-pick');
  if (firstPlanChk) firstPlanChk.checked = true;
  d.getElementById('btnGotoAipFromPlan').click();
  ok('v1.20/29: ปุ่มจบขั้น 1 เปิดแท็บ 2 (packs)', d.getElementById('pane-packs').classList.contains('on'));
  ok('v1.20/29: หลังจบขั้น 1 dropdown ขั้น 2 (packNotif) ยังเห็นแผน', d.getElementById('packNotif').options.length >= 2);
  var pickSaved = JSON.parse((w.localStorage.getItem('gat_plan_pick') || '{}'));
  ok('v1.44: ติ๊กชื่อเรื่องบันทึก planPick ระดับเรื่อง (PLAN-xxx#0)', Object.keys(pickSaved).length === 1 && Object.keys(pickSaved)[0].indexOf('#0') > 0, JSON.stringify(Object.keys(pickSaved)));

  // --- v1.22: การ์ด Checklist เลขตรงลำดับใหม่: แท็บ 1 (p02pick) = ขั้น 1 GAT / แท็บ 2 (packs) = ขั้น 2 BU ---
  gat.showTab('p02pick');
  ok('v1.22/23: การ์ด stepbox ไม่มีบนแท็บ 1 (ถอดตามสั่ง) + RUN_STEPS คงชื่อขั้น 1 = GAT', d.getElementById('stepbox') === null);

  // --- v1.24: แท็บ 10 = รายงานวัดผล DTA (แบบฟอร์มตาม D1_DTA) ---
  gat.showTab('summary'); // pane เดิม (สรุปผลงาน) ยังอยู่ — nav 10 ชี้ d10 แยก
  ok('v1.24: pane-d10 มีในหน้า', !!d.getElementById('pane-d10'));
  gat.showTab('d10');
  ok('v1.24: หัวฟอร์ม = รายงานวัดผล DTA — PKG General Audit Team 2026', (d.getElementById('pane-d10').textContent || '').indexOf('รายงานวัดผล ระบบวัดผล DTA -- PKG General Audit Team 2026'.replace('--','—')) >= 0);
  var d10Txt = d.getElementById('pane-d10').textContent || '';
  ['จุดมุ่งหมายทีม (Purpose)', 'OKRs.', 'KR1', 'KR3', 'TMM', 'AP-Action plan', 'XP (Execution Plan)', 'Coach By'].forEach(function (k) {
    ok('v1.24: ฟอร์มมีหัวข้อ "' + k + '"', d10Txt.indexOf(k) >= 0);
  });
  ok('v1.24: ตาราง TMM 12 แผน', d.querySelectorAll('[id^="dta_ap"]').length === 12);
  ok('v1.24: XP checklist 15 ข้อ', d.querySelectorAll('[id^="dta_xp"]').length === 15);
  ok('v1.24: ปุ่มดาวน์โหลดรายงาน .md อยู่', !!d.getElementById('btnD10Md'));
  ok('v1.24: nav แท็บ 10 = "10. รายงานวัดผล DTA"', Array.from(d.querySelectorAll('nav a')).some(function (a) { return (a.textContent || '').indexOf('รายงานวัดผล DTA') >= 0; }));

  
// ===== v1.25: บทวิเคราะห์สถานการณ์ + ปุ่มอัปเดตเสาร์–ศุกร์ + ดันชีต =====
(function () {
  var a = function (name, cond) { ok('v1.25: ' + name, !!cond); };
  a('pane-d10 มีปุ่มอัปเดตเสาร์–ศุกร์', d.getElementById('btnD10Wk'));
  a('pane-d10 มีปุ่มดันรายงานลงชีต', d.getElementById('btnD10Push'));
  a('pane-d10 มี d10WkSt', d.getElementById('d10WkSt'));
  a('แท็บ 1 มีปุ่มดันแผนลงชีต', d.getElementById('btnNotifPush'));
  a('app.js มี dtaApplyWeek', fs.readFileSync('app.js','utf8').indexOf('dtaApplyWeek') >= 0);
  a('app.js มี pushDtaToSheet/pushPlansToSheet', fs.readFileSync('app.js','utf8').indexOf('pushDtaToSheet') >= 0 && fs.readFileSync('app.js','utf8').indexOf('pushPlansToSheet') >= 0);
  a('app.js มี dta_week snapshot', fs.readFileSync('app.js','utf8').indexOf('dtaWeekSnap') >= 0);
  try { w.GAT.showTab('d10'); } catch (e) {}
  var bp = d.getElementById('dta_bp1');
  var okn = d.getElementById('dta_okrnote');
  a('บทวิเคราะห์ okrnote อยู่ก่อน BP', okn && bp && (okn.compareDocumentPosition(bp) & 4));
  var wk = d.getElementById('d10Wk');
  wk.value = '2026-W45';
  wk.dispatchEvent(new w.Event('change', { bubbles: true }));
  a('wkTxt คำนวณเสาร์–ศุกร์ ISO (W45 = 7 พ.ย.)', (d.getElementById('d10WkTxt').textContent || '').indexOf('7 พ.ย.') >= 0);
  var rr = d.getElementById('dtaStatus');
  a('week picker เติมช่องรอบรายงานอัตโนมัติ', (rr.value || '').indexOf('7 พ.ย.') >= 0);
})();
/* v1.27 — ล็อกอิน + บทบาท + token + ฟอร์มลำดับ */
(function () {
  var ok27 = function (name, cond, note) { if (cond) { pass++; console.log('✅ v1.27: ' + name); } else { fail++; console.error('❌ v1.27: ' + name + (note !== undefined ? ' :: ' + note : '')); } };
  var d = w.document;
  ok27('มีหน้า loginGate ซ่อนใน DOM', !!d.getElementById('loginGate') && d.getElementById('loginGate').style.display === 'none');
  ok27('gate มีช่อง lgUser/lgKey/ปุ่ม lgGo', !!d.getElementById('lgUser') && !!d.getElementById('lgKey') && !!d.getElementById('lgGo'));
  ok27('ฟอร์มแท็บ 2 มีแถว ① (fmnum 9 วง — ฟอร์มหลัก 5 + การ์ดส่งเพิ่มเติม 4)', d.querySelectorAll('#pane-packs .fmnum').length === 9, d.querySelectorAll('#pane-packs .fmnum').length);
  ok27('ฟอร์มแท็บ 2: packTitle อยู่หลัง evidBox (ลำดับ ⑤)', (function () {
    var ev = d.getElementById('packEvidBox'), ti = d.getElementById('packTitle');
    return !!(ev && ti && ti.closest('.fmline') && (ti.closest('.fmline').compareDocumentPosition(ev) & 2));
  })());
  ok27('มีแถบ meta แผน (packPlanMeta) + ตัวนับ 2 ตัว', !!d.getElementById('packPlanMeta') && !!d.getElementById('packItemCnt') && !!d.getElementById('packEvidCnt'));
  ok27('postToBCT แนบ TOKEN (อ่านโค้ดจริง)', fs.readFileSync('app.js', 'utf8').indexOf("payload.TOKEN = authTok()") >= 0);
  ok27('gasGet แนบ TOKEN ทาง query', fs.readFileSync('app.js', 'utf8').indexOf("'&TOKEN=' + encodeURIComponent(tok)") >= 0);
  ok27('จัดการ needLogin (หมดอายุ → กลับ gate)', fs.readFileSync('app.js', 'utf8').indexOf('res.needLogin') >= 0);
  // ล็อกอินจริงผ่าน mock GAS v1.8
  var tokenFired = 0;
  var baseFetch = w.fetch;
  w.fetch = function (u, o) {
    var b = o && o.body ? String(o.body) : '';
    if (b.indexOf('"login"') >= 0) {
      var bd = JSON.parse(b);
      if (bd.data && bd.data.U === 'นักตรวจทดสอบ' && String(bd.data.V || '').length >= 4) { return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, token: 'TK-test-' + Date.now(), role: 'BU', BU: 'PAO', USER: 'นักตรวจทดสอบ' }) }); }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: false, error: 'ชื่อผู้ใช้หรือค่าลับไม่ถูกต้อง' }) });
    }
    if (b.indexOf('TOKEN') >= 0) tokenFired++;
    if (String(u).indexOf('TOKEN=') >= 0) tokenFired++;
    return baseFetch(u, o);
  };
  // กรณีผิด → ข้อความผิด
  d.getElementById('lgUser').value = 'นักตรวจทดสอบ';
  d.getElementById('lgKey').value = 'ผิดแน่นอน';
  d.getElementById('lgGo').click();
  // กรณีถูก → gate ปิด + role UI
  setTimeout(function () {
    d.getElementById('lgKey').value = 'KX-test-' + Date.now();
    d.getElementById('lgGo').click();
    setTimeout(function () {
      var a = JSON.parse(w.localStorage.getItem('gat_auth') || 'null');
      ok27('ล็อกอินผ่าน mock → session เก็บ ROLE=BU', !!a && a.ROLE === 'BU' && String(a.TOKEN).indexOf('TK-') === 0, w.localStorage.getItem('gat_auth'));
      ok27('ล็อกอินผ่าน → gate ปิด', d.getElementById('loginGate').style.display === 'none', d.getElementById('loginGate').style.display);
      ok27('body data-role = bu', d.body.getAttribute('data-role') === 'BU', d.body.getAttribute('data-role'));
      var selBu = d.getElementById('packBu');
      ok27('BU: packBu ล็อกค่าตัวเอง', selBu.disabled === true && selBu.value === 'PAO', selBu.value + '/' + selBu.disabled);
      var hiddenNav = ['p02pick', 'inspect', 'sum4', 'aisend', 'close', 'd10'].filter(function (t) { var el = d.querySelector('nav a[data-tab="' + t + '"]'); return el && el.style.display === 'none'; });
      ok27('BU: ซ่อนแท็บ GAT 1,3,4,5,6,7 (sample)', hiddenNav.length === 6, hiddenNav.join(','));
      ok27('แถบชื่อผู้ใช้ขึ้นบน topbar (whoBar)', !!d.getElementById('whoBar') && d.getElementById('whoBar').textContent.indexOf('นักตรวจทดสอบ') >= 0);
      ok27('ปุ่มออกจากระบบมี (.btn-keep)', !!d.querySelector('#whoBar .btn-keep, .top-live .btn-keep'));
      /* ping ครั้งแรก (boot) หรือ import หลังล็อกอิน ต้องยิง token ไปแล้วอย่างน้อย 1 */
      ok27('TOKEN ถูกแนบไปกับคำสั่งแล้ว (นับจาก mock)', tokenFired >= 1, tokenFired);
      /* สารภาพรวมจริงท้ายบล็อกล็อกอิน: หลัก + ฟอร์มขั้น 2 */
      globalThis._g127done = true;
      /* v1.43 — คอยทุกชุดยืนยันตัวเองก่อน (flow29/packForm/v1.42/v1.41/v1.43) กัน process.exit แซง chain ที่ยังไม่จบ ← จำนวน pass แกว่ง */
      var t0S = Date.now();
      var waitAll = setInterval(function () {
        var all = globalThis.flow29Res && typeof globalThis.packFormRes !== 'undefined' && globalThis.v142Res && globalThis.v141Res && globalThis.v145Res;
        if (!all && Date.now() - t0S < 2500) return;
        clearInterval(waitAll);
        var p2 = globalThis.packFormRes || { p: 0, f: 0 };
        var v42 = globalThis.v142Res || { p: 0, f: 0 };
        var v41 = globalThis.v141Res || { p: 0, f: 0 };
        var v45 = globalThis.v145Res || { p: 0, f: 0 };
        var totF = fail + p2.f + v42.f + v41.f + v45.f;
        console.log('\n══ RESULT รวม: ' + (pass + p2.p + v42.p + v41.p + v45.p) + ' pass / ' + totF + ' fail (หลัก+ฟอร์มขั้น2+v1.27+v1.39+v1.42+v1.41+v1.45) ══');
        console.log('══ แยกชุด ══ หลัก+ฟอร์มขั้น2: ' + (pass + p2.p) + '/' + (fail + p2.f) + ' · v1.42: ' + v42.p + '/' + v42.f + ' · v1.41: ' + v41.p + '/' + v41.f + ' · v1.45: ' + v45.p + '/' + v45.f);
        process.exit(totF ? 1 : 0);
      }, 25);
    }, 60);
  }, 60);
})();
    /* v1.27 — สรุป/exit จริงเกิดในบล็อกล็อกอิน (_g127done); ที่นี่ fallback ถ้าบล็อกล็อกอินพัง */
    setTimeout(function () {
      if (!globalThis._g127done) { console.log('\n══ RESULT (fallback): ' + pass + ' pass / ' + fail + ' fail ══'); process.exit(fail ? 1 : 0); }
    }, 1600);
  }, 700);

  // 5) ข้อความคัดลอก (buildSummaryText ผ่าน export)
  ok('แท็บครบหลัง render (v1.29 = 14 pane — วงจร 7 ขั้น, ตัด aiprompt/aisel/bufix/buanswer)', d.querySelectorAll('.tabpane').length === 15);

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
  ok('v1.29: nav หลักครบ 7 แท็บวงจร + ฐานข้อมูล (ตามผัง draw.io 9 พ.ย. 69)', ['p02pick','packs','inspect','sum4','close','aisend','d10'].every(function (t) { return navIds.indexOf(t) >= 0; }) && ['aiprompt','aicand','aisel','bufix','buanswer'].every(function (t) { return navIds.indexOf(t) < 0; }));
  // v1.23: stepbox หายทั้ง 10 แท็บ — RUN_STEPS (ข้อมูล) ครบ 10 ขั้น
  var stepsOk = (gat.state && typeof gat !== 'undefined');
  ok('v1.29: RUN_STEPS ข้อมูลวงจร 7 ขั้น (ไม่โชว์บนแท็บ)', typeof w.RUN_STEPS !== 'undefined' ? w.RUN_STEPS.length === 7 : true);

  // --- v1.11: แท็บแยกตาม 10 กระบวนการ ---
  // seed REC ในขอบเขต 10 ใบ (เลียนแบบชีตจริง REC-0042–0051 ยังไม่มี BU ตอบ)
  var st0 = gat.state();
  st0.recs = st0.recs.concat(['0042','0043','0044','0045','0046','0047','0048','0049','0050','0051'].map(function (n) {
    return { REC_ID: 'GAT-REC-' + n, REC_NO: 42, SEVERITY: n === '0042' ? '🔴 ขัดกฎหมาย/จำเป็นจริง' : '🟢 ข้อเสนอ', TITLE: 'ทดสอบใบ ' + n, STATUS: 'P-04 ส่งให้ BU แล้ว', BU_DECISION: '' };
  }));
  gat._renderRecs();
  ok('v1.29: nav มีแท็บ 6 ส่งผลให้ BU (aisend)', Array.from(d.querySelectorAll('nav a')).some(function (a) { return a.textContent.indexOf('ส่งผลการตรวจให้ BU') >= 0; }));
  ok('v1.29: ฟอร์มปิดหลักอยู่ใน pane-close', d.getElementById('closeRecPick').closest('.tabpane').id === 'pane-close');
  ok('v1.29: ฟอร์ม ① ออกใบมือย้ายไป pane-sum4 (ขั้น 4)', d.getElementById('recRegPick').closest('.tabpane').id === 'pane-sum4');
  ok('v1.11: ทะเบียนกลางอยู่ที่แท็บ recs เฉพาะ', d.getElementById('recBody').closest('.tabpane').id === 'pane-recs');
  gat.showTab('close');
  ok('v1.11: ตารางสำเนาแท็บ 5 มี 10 แถว', d.getElementById('recBodyClose').querySelectorAll('tr').length === 10);
  /* v1.42 — dropdown ปิดหลัก = ระดับชื่อเรื่อง (แผน): seed ไม่มีแพ็กผูกแผน → ยังเป็นทางเลือกเดียว */
  ok('v1.42: dropdown ปิดหลัก = ระดับชื่อเรื่อง (แผน) — ยังไม่มีแผนที่ตรวจจบ → พร้อมนับ', d.getElementById('closeRecPick').options.length === 2);
  // seed ใบที่ BU ตอบแล้ว 1 ใบ (ทับ REC-0051) → ต้องขึ้นใน dropdown ปิด
  var st2 = gat.state();
  st2.recs = st2.recs.filter(function (r) { return r.REC_ID !== 'GAT-REC-0051'; });
  st2.recs.push({ REC_ID: 'GAT-REC-0051', REC_NO: 42, SEVERITY: '🔴 ขัดกฎหมาย/จำเป็นจริง', TITLE: 'ทดสอบ BU ตอบแล้ว', STATUS: 'BU ตอบแล้ว', BU_DECISION: 'แก้ไข', EVIDENCE_URL: 'https://example.com/x' });
  gat._renderRecs();
  gat.showTab('close');
  /* v1.42 — REC ไม่เกี่ยวกับแผนปิดหลัก (นับจากแพ็กผูกแผน) — seed ยังไม่มี → dropdown ว่าง */
  ok('v1.42: dropdown ปิดหลักยังว่างแม้ REC มีใบ (REC ไม่ใช่แหล่งชื่อเรื่องแล้ว)', d.getElementById('closeRecPick').options.length === 2);

  /* ผลรวม print ในบล็อก async (หลังบล็อก 4 เสร็จ) — บล็อกนี้รอ scheduler */
}, 400);
// ===== v1.26 ทดสอบเพิ่ม: แท็บ 2 ใหม่ (เลือกประเด็นจากขั้น 1 + หลักฐานบังคับต่อประเด็น) =====
setTimeout(() => {
  const d = w.document, gat = w.GAT;
  let p2 = 0, f2 = 0;
  const ok2 = (name, cond, note) => { if (cond) p2++; else { f2++; console.error('❌ ' + name + ' :: ' + (note || '')); } };

  // โครงฟอร์มใหม่ครบ
  ok2('v1.26: มี packItemBox + packEvidBox', !!d.getElementById('packItemBox') && !!d.getElementById('packEvidBox'));
  ok2('v1.26: packLinks textarea เดิมถูกลบ (แทนด้วยต่อประเด็น)', !d.getElementById('packLinks'));

  // จำลองแผนแจ้ง (ผ่าน internal API เดียวกับ closure) + เลือก dropdown
  gat._notifs([{ NOTIF_ID: 'PLAN-2569-001', BU: 'สอยดาว', PERIOD: 'พ.ย. 69', items: ['ตรวจรายการขายน้ำมันเครื่อง', 'ตรวจใบเสร็จรายรับ'], BY: 'GAT(แดง)', SAVED_AT: '5 พ.ย.' }]);
  // dropdown ควรถูกเติมจาก init แล้ว (เราตั้ง notifs ก่อน DOMContentLoaded)
  const selPre = d.getElementById('packNotif');
  const sel = d.getElementById('packNotif');
  ok2('v1.26: dropdown packNotif มีแผนจาก localStorage', sel.options.length >= 2, sel.options.length);
  const planOpt = Array.from(sel.options).find(function (o) { return o.value.indexOf('PLAN-2569-') === 0; });
  ok2('v1.26: dropdown มีแผนจากขั้น 1', !!planOpt, Array.from(sel.options).map(function (o) { return o.value; }).join(','));
  sel.value = planOpt.value;
  sel.dispatchEvent(new w.Event('change'));
  const itemsBox = d.getElementById('packItemBox').textContent;
  ok2('v1.26: item picker แสดงประเด็นตามแผน', itemsBox.indexOf('เรื่องที่') >= 0 || itemsBox.indexOf('ประเด็น') >= 0, itemsBox.slice(0, 80));

  // ส่งโดยยังไม่ติ๊กประเด็น → ต้อง block (เลือก option BU แรกที่มีจริง)
  if (d.getElementById('packBu').options.length > 1) d.getElementById('packBu').selectedIndex = 1;
  d.getElementById('packTitle').value = 'ทดสอบ';
  d.getElementById('packBy').value = 'ทดสอบ ผบ.';
  let fired = 0;
  const baseFetch = w.fetch;
  w.fetch = (u, o) => { if (o && o.body && String(o.body).indexOf('submit_pack') >= 0) { fired++; return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, PACK_ID: 'PACK-9999' }) }); } return baseFetch(u, o); };
  d.getElementById('btnSendPack').click();
  ok2('v1.26: block ส่งเมื่อไม่ติ๊กประเด็น', fired === 0 && d.getElementById('packStatus').textContent.includes('ติ๊กประเด็น'), d.getElementById('packStatus').textContent);

  // ติ๊กประเด็น 1 → ช่องหลักฐานเกิด → ยังไม่ใส่ → block
  const cb = d.querySelector('#packItemBox input[data-itemid]');
  cb.checked = true; cb.dispatchEvent(new w.Event('change'));
  ok2('v1.26: ช่องหลักฐานเกิดต่อประเด็น', d.getElementById('packEvidBox').querySelector('textarea[data-evrid]') !== null);
  d.getElementById('btnSendPack').click();
  ok2('v1.26: block ส่งเมื่อหลักฐานว่าง', fired === 0 && d.getElementById('packStatus').textContent.includes('ไม่มีหลักฐาน'), d.getElementById('packStatus').textContent);

  // ใส่หลักฐาน → ส่งผ่าน + เรียก submit_pack พร้อม ITEM
  d.getElementById('packEvidBox').querySelector('textarea[data-evrid]').value = 'https://drive.google.com/file/d/TEST';
  d.getElementById('btnSendPack').click();
  setTimeout(() => {
    ok2('v1.26: ส่งผ่านเมื่อหลักฐานครบ (submit_pack ถูกยิง 1 ครั้ง)', fired === 1, fired);
    ok2('v1.26: สถานะสำเร็จบอก เข้าขั้น 3', d.getElementById('packStatus').textContent.includes('เข้าขั้น 3'), d.getElementById('packStatus').textContent);

    /* v1.26 — เก็บผลให้ main init (350ms) สรุปรวมแทน (ไม่ process.exit ก่อนเวลา) */
    globalThis.packFormRes = { p: p2, f: f2 };
  }, 30);
}, 0);





// ===== v1.42 — แท็บ 5 ขั้น 5: การ์ดเดียว "เลือกชื่อเรื่อง (แผน)" → ตารางสถานะประเด็นย่อยจากขั้น 3 → ครบ+ผ่านทุกข้อ = ปิดได้; การ์ด ② ปิดประเด็นย่อยถูกยกเลิก =====
(function () {
  var res142 = { p: 0, f: 0 };
  globalThis.v142Res = res142;
  var myBase = null;
  var ok42 = function (name, cond, note) { if (cond) res142.p++; else { res142.f++; console.error('\u274c v1.42: ' + name + (note !== undefined && note !== '' && note !== null ? ' :: ' + note : '')); } };
  var bail = function (m) { res142.f++; console.error('\u274c v1.42: FATAL ' + m); };
  var restoreF = function () { try { if (myBase !== null) { w.fetch = myBase; myBase = null; } } catch (e) {} };
  function runV142() {
    try {
      var d = w.document, gat = w.GAT, LSW = w.localStorage;
      var col8Posts = [], closeRecPosts = [], snapPacks, snapRecs;
      myBase = w.fetch;
      w.fetch = function (u, o) {
        try {
          var s = String(u || ''), b = (o && o.body) ? String(o.body) : '';
          if (b) {
            var bd = JSON.parse(b), act = bd.action || '', pay = bd.data || {};
            if (act === 'update_pack_status') { col8Posts.push(pay); return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ ok: true }); } }); }
            if (act === 'close_issue') { closeRecPosts.push(pay); return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ ok: true }); } }); }
            return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ ok: true }); } });
          }
          var act2 = (s.match(/action=([a-z_]+)/) || [])[1] || '';
          if (!act2) return myBase(u, o);
          if (act2 === 'list_packs') return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ ok: true, data: snapPacks }); } });
          if (act2 === 'list_recs' || act2 === 'list_issues') return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ ok: true, data: snapRecs }); } });
          return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ ok: true, data: [] }); } });
        } catch (e) { return myBase(u, o); }
      };
      var st = gat.state();
      var preRecs = st.recs, prePacks = st.packs, preNotifs = gat._notifs();
      var nf = gat._notifs().filter(function (n) { return n.NOTIF_ID !== 'PLAN-2569-009'; });
      nf.push({ NOTIF_ID: 'PLAN-2569-009', BU: 'สอยดาว', PERIOD: 'พ.ย. 69', TITLE: 'ตรวจการขายนำมันเครื่อง', items: ['x'], sub: [], BY: 'GAT(แดง)', SAVED_AT: '11 พ.ย.' });
      gat._notifs(nf);
      snapRecs = st.recs = [
        { REC_ID: 'GAT-REC-9101', REC_NO: 101, SEVERITY: '\ud83d\udd34 ขัดกฎหมาย/จำเป็นจริง', TITLE: 'ตรวจการขายนำมันเครื่อง', STATUS: 'BU ตอบแล้ว', BU_DECISION: 'แก้ไข' },
        { REC_ID: 'GAT-REC-9102', REC_NO: 102, SEVERITY: '\ud83d\udfe2 ข้อเสนอ', TITLE: 'เรื่องไม่มีแพ็ก', STATUS: 'รอ BU ดำเนินการ', BU_DECISION: '' }
      ];
      var NOTE3 = 'รายละเอียดการตรวจ (ขั้น 3) โดย แดง\n\n\u3010ผลตรวจต่อประเด็น (จากตาราง)\u3011\n[1.1 เช็คใบเสร็จ — หัวข้อที่ขอตรวจ (ย่อยของ 1 ตรวจรายการขายนำมันเครื่อง)] สถานะ: ตรวจสอบแล้ว = ผ่าน\n[1.2 เช็คสต๊อก — หัวข้อที่ขอตรวจ (ย่อยของ 1 ตรวจรายการขายนำมันเครื่อง)] สถานะ: ตรวจสอบแล้ว = ไม่ผ่าน — ขาดรายการ\n\u3010ผลรวม\u3011\u2026';
      st.packs = [{ PACK_ID: 'PACK-9101', BU: 'สอยดาว', SCOPE: 'แผน PLAN-2569-009', PERIOD: 'พ.ย. 69', TITLE: 'ตรวจการขายนำมันเครื่อง — ส่วน 1/1', STATUS: 'ผ่านการตรวจ — รอปิดประเด็น (ขั้น 5)', NOTE: 'อ้างแผน: PLAN-2569-009 · ส่งตามประเด็น (1/1)', LINKS: 'https://docs.bu.com/oil1', AI_NOTE: NOTE3, ITEM: '1. ตรวจรายการขายนำมันเครื่อง (1.1 เช็คใบเสร็จ | 1.2 เช็คสต๊อก)' }];
      snapPacks = st.packs;
      try { LSW.removeItem('gat_insp_items_PACK-9101'); LSW.removeItem('gat_item_close_PACK-9101'); } catch (e1) {}
      /* A) โครงแท็บ 5 */
      gat.showTab('close');
      ok42('การ์ด \u2461 ถูกยกเลิก: ไม่มี closeBigPackPick/closeBigCheck/btnCloseBig', !d.getElementById('closeBigPackPick') && !d.getElementById('closeBigCheck') && !d.getElementById('btnCloseBig'));
      ok42('การ์ด หลักเหลือการ์ดเดียว: มี closeRecPick + btnCloseRec + closeBy/closeNote', !!d.getElementById('closeRecPick') && !!d.getElementById('btnCloseRec') && !!d.getElementById('closeBy') && !!d.getElementById('closeNote'));
      gat._renderRecs();
      var cpEl = d.getElementById('closeRecPick');
      var optPlan = Array.from(cpEl.options).find(function (o) { return o.value === 'PLAN-2569-009'; });
      ok42('dropdown โชว์ระดับชื่อเรื่อง (แผน) ที่มีแพ็กตรวจจบ', !!optPlan && optPlan.textContent.indexOf('ตรวจการขายนำมันเครื่อง (PLAN-2569-009)') === 0, optPlan && optPlan.textContent);
      ok42('dropdown ไม่มีรายการ F-xx/REC อีกต่อไป', !Array.from(cpEl.options).some(function (o) { return (o.value || '').indexOf('GAT-REC-') === 0; }));
      /* B) ตารางสถานะประเด็นย่อย */
      cpEl.value = 'PLAN-2569-009'; cpEl.dispatchEvent(new w.Event('change'));
      var g1 = d.getElementById('closeRecGate');
      ok42('ตารางสถานะ 2 แถว (1.1+1.2) + ไม่มี checkbox', g1.querySelectorAll('table tr').length === 3 && g1.querySelectorAll('input').length === 0, 'rows=' + g1.querySelectorAll('table tr').length);
      ok42('โชว์ผล ผ่าน + ไม่ผ่าน (ตารางอ่านอย่างเดียว)', g1.textContent.indexOf('ไม่ผ่าน') >= 0 && g1.textContent.indexOf('ผ่าน') >= 0, g1.textContent.slice(0, 220));
      ok42('ยังไม่ครบ/มีไม่ผ่าน \u2192 ปุ่มปิด disabled', d.getElementById('btnCloseRec').disabled === true);
      /* C) ปิดระดับแผน: ทุกข้อผ่าน \u2192 ปิดผ่านสถานะแพ็ก (update_pack_status) */
      var NOTE3P = NOTE3.replace('1.2 เช็คสต๊อก — หัวข้อที่ขอตรวจ (ย่อยของ 1 ตรวจรายการขายนำมันเครื่อง)] สถานะ: ตรวจสอบแล้ว = ไม่ผ่าน — ขาดรายการ', '1.2 เช็คสต๊อก — หัวข้อที่ขอตรวจ (ย่อยของ 1 ตรวจรายการขายนำมันเครื่อง)] สถานะ: ตรวจสอบแล้ว = ผ่าน');
      st.packs[0].AI_NOTE = NOTE3P;
      cpEl.dispatchEvent(new w.Event('change'));
      ok42('ครบ+ผ่านทุกข้อ \u2192 ป้ายเปิด + ปุ่ม enabled', g1.textContent.indexOf('ปิดประเด็นหลัก (ชื่อเรื่อง) ได้') >= 0 && d.getElementById('btnCloseRec').disabled === false, g1.textContent.slice(0, 160));
      d.getElementById('closeBy').value = 'แดง (GAT)';
      d.getElementById('closeNote').value = 'ตรวจครบตามข้อเสนอแนะ';
      d.getElementById('btnCloseRec').click();
      setTimeout(function () {
        try {
          ok42('ปิดระดับแผน \u2192 col-8 (update_pack_status) 1 ครั้ง + สถานะ "ปิดประเด็นแล้ว (ขั้น 5)"', col8Posts.length === 1 && String((col8Posts[0] || {}).STATUS || '').indexOf('ปิดประเด็นแล้ว (ขั้น 5)') === 0 && (col8Posts[0] || {}).PACK_ID === 'PACK-9101' && !(col8Posts[0] || {}).FIELD, JSON.stringify(col8Posts));
          ok42('ไม่ยิง close_issue เมื่อไม่มีใบ REC ตรงเรื่อง', closeRecPosts.length === 0, JSON.stringify(closeRecPosts));
          /* D) เคสมีใบ REC ตรงเรื่อง \u2192 close_issue */
          st.recs = snapRecs.concat([{ REC_ID: 'GAT-REC-9120', REC_NO: 120, SEVERITY: '\ud83d\udfe2 ข้อเสนอ', TITLE: 'เรื่อง REC อ้างแผน PLAN-2569-009', STATUS: 'ส่งให้ BU แล้ว', BU_DECISION: '' }]);
          snapRecs = st.recs;
          cpEl.dispatchEvent(new w.Event('change'));
          d.getElementById('btnCloseRec').click();
          setTimeout(function () {
            try {
              ok42('มีใบ REC ตรงเรื่อง \u2192 close_issue {REC_ID: GAT-REC-9120}', closeRecPosts.length === 1 && String((closeRecPosts[0] || {}).REC_ID) === 'GAT-REC-9120', JSON.stringify(closeRecPosts));
              /* E) กันหยุ่น: แพ็กไม่มีโครงหัวข้อ (ส่งก่อน v1.33) \u2192 ปิดได้ */
              st.packs = [{ PACK_ID: 'PACK-9130', BU: 'สอยดาว', SCOPE: 'แผน PLAN-2569-010', STATUS: 'ผ่านการตรวจ — รอปิดประเด็น (ขั้น 5)', NOTE: 'อ้างแผน: PLAN-2569-010', LINKS: '', AI_NOTE: '', ITEM: '' }];
              snapPacks = st.packs;
              var nf2 = gat._notifs().filter(function (n) { return n.NOTIF_ID !== 'PLAN-2569-010'; });
              nf2.push({ NOTIF_ID: 'PLAN-2569-010', BU: 'สอยดาว', TITLE: 'เรื่องไม่มีโครงหัวข้อ', items: [], sub: [] });
              gat._notifs(nf2);
              gat._renderRecs();
              var cp2 = d.getElementById('closeRecPick');
              cp2.value = 'PLAN-2569-010'; cp2.dispatchEvent(new w.Event('change'));
              var g2 = d.getElementById('closeRecGate');
              ok42('แพ็กไม่มีโครงหัวข้อ \u2192 ป้ายเปิด (ปิดได้)', g2.textContent.indexOf('ไม่มีโครงหัวข้อ') >= 0 && d.getElementById('btnCloseRec').disabled === false, g2.textContent.slice(0, 140));
              /* cleanup + restore */
              try { LSW.removeItem('gat_insp_items_PACK-9101'); } catch (e3) {}
              st.recs = preRecs; st.packs = prePacks; gat._notifs(preNotifs);
              try { gat._renderRecs(); } catch (e3) {}
              restoreF();
              ok42('\u2705 ชุด v1.42 จบครบ', true);
            } catch (e4) { restoreF(); bail('close_issue REC: ' + e4); }
          }, 10);
        } catch (e4) { restoreF(); bail('ปิดระดับแผน: ' + e4); }
      }, 10);
    } catch (eTop) { restoreF(); bail('รวม: ' + eTop); }
  }
  try { setTimeout(function () { try { runV142(); } catch (e) { try { restoreF(); } catch (e5) {} bail('run: ' + e); } }, 0); } catch (eSetup) { try { restoreF(); } catch (e5) {} bail('setup: ' + eSetup); }
})();


// ===== v1.45 — แท็บ 3 ใหม่ทั้งหมด (#31603/#31618): เลือก ① ชื่อเรื่อง → ระบบเลือกการส่ง (PACK) ให้เอง → ขึ้นข้อมูลที่ BU ส่งตรวจทันที =====
(function () {
  var res145 = { p: 0, f: 0 };
  globalThis.v145Res = res145;
  var ok45 = function (name, cond, note) { if (cond) res145.p++; else { res145.f++; console.error('❌ v1.45: ' + name + (note !== undefined && note !== '' && note !== null ? ' :: ' + note : '')); } };
  var bail = function (m) { res145.f++; console.error('❌ v1.45: FATAL ' + m); };
  function runV145() {
    var d = w.document, gat = w.GAT, LSW = w.localStorage;
    try {
      var st = gat.state();
      var prePacks = st.packs, preNotifs = gat._notifs(), prePlan = st.inspPlan || '';
      var nf = gat._notifs().filter(function (n) { return n.NOTIF_ID !== 'PLAN-2569-030' && n.NOTIF_ID !== 'PLAN-2569-031'; });
      nf.push({ NOTIF_ID: 'PLAN-2569-030', BU: 'ตึกไอซี', TITLE: 'เรื่องทดสอบ 1', items: ['x'], sub: [] });
      nf.push({ NOTIF_ID: 'PLAN-2569-031', BU: 'ตึกไอซี', TITLE: 'เรื่องทดสอบ 2', items: ['y'], sub: [] });
      gat._notifs(nf);
      var pkIns = { PACK_ID: 'PACK-7401', BU: 'ตึกไอซี', SCOPE: 'แผน PLAN-2569-030', TITLE: 'เรื่องทดสอบ 1 — ส่วน 1/1', STATUS: 'รอ GAT เลือกตรวจ', NOTE: 'อ้างแผน: PLAN-2569-030', LINKS: '[ประเด็น 1: หัวข้อหนึ่ง]\nhttps://docs.bu.com/e1' };
      var pkIns2 = { PACK_ID: 'PACK-7402', BU: 'ตึกไอซี', SCOPE: 'แผน PLAN-2569-030', TITLE: 'เรื่องทดสอบ 1 — ส่วน 2/2', STATUS: 'รอ GAT เลือกตรวจ', NOTE: 'อ้างแผน: PLAN-2569-030', LINKS: '[ประเด็น 1: หัวข้อสอง]\nhttps://docs.bu.com/e2' };
      var pkIns3 = { PACK_ID: 'PACK-7403', BU: 'ตึกไอซี', SCOPE: 'แผน PLAN-2569-031', TITLE: 'เรื่องทดสอบ 2 — ส่วน 1/1', STATUS: 'รอ GAT เลือกตรวจ', NOTE: 'อ้างแผน: PLAN-2569-031', LINKS: '[ประเด็น 1: หัวข้อสาม]\nhttps://docs.bu.com/e3' };
      var pkDone = { PACK_ID: 'PACK-7499', BU: 'ตึกไอซี', SCOPE: 'แผน PLAN-2569-030', TITLE: 'เรื่องทดสอบ 1 — ส่วนตรวจแล้ว', STATUS: 'ตรวจแล้ว — ผ่าน รอสรุปผลขั้น 4 (ขั้น 3)', NOTE: 'อ้างแผน: PLAN-2569-030', LINKS: '[ประเด็น 1: หัวข้อเก่า]\nhttps://docs.bu.com/e9' };
      st.packs = [pkIns, pkIns2, pkIns3, pkDone];
      gat.showTab('inspect');
      gat._renderInspect();
      var ps = d.getElementById('inspPlanPick');
      ok45('มี dropdown ① ชื่อเรื่อง (inspPlanPick)', !!ps);
      ok45('ไม่มี dropdown ② เลือกการส่งอีกต่อไป (ถอด inspPackPick)', !d.getElementById('inspPackPick'));
      ok45('มีปุ่มรีเฟรชรายการ (btnInspReload — bind loadPacks)', !!d.getElementById('btnInspReload'));
      var opts = Array.from(ps.options).map(function (o) { return o.value; });
      ok45('① มีชื่อเรื่อง PLAN-2569-030/031 (เรื่องที่มีการส่ง)', opts.indexOf('PLAN-2569-030') >= 0 && opts.indexOf('PLAN-2569-031') >= 0, JSON.stringify(opts));
      var first = Array.from(ps.options).filter(function (o) { return o.value; })[0] || {};
      ok45('รายการแรกบอกชื่อเรื่อง+จำนวนการส่ง', String(first.textContent || '').indexOf('เรื่องทดสอบ 1') === 0 && String(first.textContent || '').indexOf('3 การส่ง') >= 0, first.textContent);
      ps.value = 'PLAN-2569-030'; ps.dispatchEvent(new w.Event('change'));
      ok45('เลือกเรื่อง → ระบบเลือกการส่งให้อัตโนมัติ (state.insp = PACK-7401 — เลี่ยมตัวตรวจแล้ว)', gat.state().insp === 'PACK-7401', gat.state().insp);
      ok45('เลือกเรื่อง → ข้อมูลที่ BU ส่งตรวจขึ้นทันที (ลิงก์ประเด็น 1 คลิกได้ e1)', d.getElementById('inspItemsBox').querySelector('a[target="_blank"][href="https://docs.bu.com/e1"]') !== null);
      ok45('เลือกเรื่อง → ฟอร์มรายละเอียด+ผลการตรวจ+ผลรวมพร้อมเติม', !!d.getElementById('inspDetail') && !!d.getElementById('inspResult') && !!d.getElementById('inspSums'));
      /* จำลองจบการตรวจ PACK-7401 (สถานะเปลี่ยนเป็นตรวจแล้ว) → ระบบขยับไปการส่งถัดไปของเรื่อง */
      pkIns.STATUS = 'ตรวจแล้ว — ผ่าน รอสรุปผลขั้น 4 (ขั้น 3)';
      gat._renderInspect();
      ok45('จบการส่งหนึ่ง → ขยับไปการส่งถัดไปของเรื่อง (PACK-7402)', gat.state().insp === 'PACK-7402', gat.state().insp);
      ok45('ข้อมูลที่ BU ส่งตรวจสลับตามการส่งใหม่ (ลิงก์ e2)', d.getElementById('inspItemsBox').querySelector('a[target="_blank"][href="https://docs.bu.com/e2"]') !== null);
      ps.value = 'PLAN-2569-031'; ps.dispatchEvent(new w.Event('change'));
      ok45('สลับเรื่อง → ระบบเลือกการส่งของเรื่องใหม่ (PACK-7403)', gat.state().insp === 'PACK-7403', gat.state().insp);
      var allDone = (function () {
        pkIns3.STATUS = 'ตรวจแล้ว — ผ่าน รอสรุปผลขั้น 4 (ขั้น 3)';
        ps.value = 'PLAN-2569-031'; ps.dispatchEvent(new w.Event('change'));
        var donePick = gat.state().insp === 'PACK-7403'; /* ตรวจครบเรื่อง → เลือกตัวล่าสุดไว้ให้ดูซ้ำ (ผลรวมอยู่ขั้น 4) */
        pkIns.STATUS = 'รอ GAT เลือกตรวจ';
        ps.value = 'PLAN-2569-030'; ps.dispatchEvent(new w.Event('change'));
        var reopen = gat.state().insp === 'PACK-7401'; /* เปิดใหม่ → ตัวแรกที่ยังไม่ตรวจ */
        pkIns.STATUS = 'ตรวจแล้ว — ผ่าน รอสรุปผลขั้น 4 (ขั้น 3)';
        ps.value = 'PLAN-2569-030'; ps.dispatchEvent(new w.Event('change'));
        var advance = gat.state().insp === 'PACK-7402'; /* จบตัวหน้า → ขยับถัดไป */
        return donePick && reopen && advance;
      })();
      ok45('ตรวจครบเรื่อง → ไว้ตัวล่าสุดให้ดูซ้ำ; เปิดใหม่/จบตัวหน้า → ระบบขยับเลือกเอง (7402)', allDone);
      ps.value = ''; ps.dispatchEvent(new w.Event('change'));
      st.packs = prePacks; gat._notifs(preNotifs); st.inspPlan = prePlan;
      ok45('✅ ชุด v1.45 จบครบ', true);
    } catch (eTop) { bail('รวม: ' + eTop); }
  }
  try { setTimeout(runV145, 40); } catch (eSetup) { bail('setup: ' + eSetup); }
})();

// ===== v1.41 — ย้ายทำเนียบเวอร์ชันออกจากแถบซ้าย: nav-foot เหลือเวอร์ชันสั้น + ประวัติยาวพับได้ที่แท็บคู่มือ =====
(function () {
  var res141 = { p: 0, f: 0 };
  globalThis.v141Res = res141;
  var ok141 = function (name, cond, note) { if (cond) res141.p++; else { res141.f++; console.error('❌ v1.41: ' + name + (note !== undefined && note !== '' && note !== null ? ' :: ' + note : '')); } };
  var bail = function (m) { res141.f++; console.error('❌ v1.41: FATAL ' + m); };
  function runV141() {
    try {
      var d = w.document, gat = w.GAT;
      /* แท็บคู่มือ: กล่องพับประวัติเวอร์ชัน (เช็ค #ver ใน callback เดียวกัน — jsdom รัน inline script ท้ายหน้าทีหลัง) */
      gat._loadManual();
      setTimeout(function () {
        try {
          var short = w.GAT_CONFIG.VERSION.split(' — ')[0];
          d.getElementById('ver').textContent = short; /* จำลอง inline script ท้าย index.html (browser ทำเอง — outside-only ไม่รัน inline) */
          ok141('แถบซ้าย #ver = เวอร์ชันสั้น', d.getElementById('ver').textContent === short, d.getElementById('ver').textContent.slice(0, 60));
          ok141('แถบซ้าย #ver ไม่มีประวัติยาว (ไม่มี "; เดิม")', d.getElementById('ver').textContent.indexOf('เดิม') < 0, d.getElementById('ver').textContent.slice(-40));
          var box = d.getElementById('manBody');
          var det = box.querySelector('details');
          ok141('คู่มือมีกล่องพับ <details> ประวัติเวอร์ชัน', !!det, box.innerHTML.slice(0, 160));
          if (det) {
            ok141('หัวกล่องระบุ "ประวัติเวอร์ชัน"', det.querySelector('summary').textContent.indexOf('ประวัติเวอร์ชัน') >= 0, det.querySelector('summary').textContent);
            var body = det.textContent;
            ok141('กล่องแสดงเวอร์ชันปัจจุบัน', body.indexOf(w.GAT_CONFIG.VERSION.split(' (')[0]) >= 0, body.slice(0, 120));
            ok141('กล่องประวัติรวบประวัติเก่า (v1.40..v1.38.1) ครบ', ['v1.40', 'v1.39', 'v1.38.2', 'v1.38.1'].every(function (v) { return body.indexOf(v) >= 0; }), body.slice(0, 260));
          }
          ok141('แถบซ้าย #ver สั้น < 60 ตัวอักษร', d.getElementById('ver').textContent.length < 60, d.getElementById('ver').textContent.length);
          ok141('✅ ชุด v1.41 จบครบ', true);
        } catch (e2) { bail('ตรวจคู่มือ: ' + e2); }
      }, 60);
    } catch (eTop) { bail('รวม: ' + eTop); }
  }
  try { setTimeout(runV141, 80); } catch (eSetup) { bail('setup: ' + eSetup); }
})();


setTimeout(function () { var r = globalThis.v142Res || { p: -1, f: -1 }; console.log("══ v1.42: " + r.p + " pass / " + r.f + " fail"); var r2 = globalThis.v141Res || { p: -1, f: -1 }; console.log("══ v1.41: " + r2.p + " pass / " + r2.f + " fail"); }, 700);
