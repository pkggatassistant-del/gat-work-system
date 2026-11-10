// sanity v1.38.2: dropdown ปิดหลัก/นับใบ ไม่กรอง REC_SCOPE (ใบนอก scope ต้องเลือกได้)
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8');
const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://pkggatassistant-del.github.io/gat-work-system/' });
const w = dom.window;
const SEED = JSON.parse(fs.readFileSync('gat-seed.json', 'utf8'));
w.fetch = (u) => {
  const s = String(u);
  if (s.indexOf('gat-seed') >= 0) return Promise.resolve({ ok: true, json: () => Promise.resolve(SEED) });
  if (s.indexOf('gat-process') >= 0) return Promise.resolve({ ok: true, json: () => Promise.resolve(JSON.parse(fs.readFileSync('gat-process.json', 'utf8'))) });
  if (s.indexOf('gat-rec-migration') >= 0) return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
  return Promise.resolve({ ok: true, json: () => Promise.resolve([]), text: () => Promise.resolve('') });
};
w.GAT_CONFIG = { VERSION: 'v1.38.2-test', BCT_API: '', SOURCES: { SEED: 'x', REC_SEED: 'x', PROCESS_SEED: 'gat-process.json' }, PROCESS_TYPES: { PM: { label: 'PM', color: '#2563eb' }, WI: { label: 'WI', color: '#0891b2' }, SD: { label: 'SD', color: '#7c3aed' }, FM: { label: 'FM', color: '#b45309' } } };
w.eval(fs.readFileSync('gat-config.js', 'utf8'));
w.eval(fs.readFileSync('app.js', 'utf8'));
w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
setTimeout(() => {
  let pass = 0, fail = 0;
  const ok = (n, c) => { if (c) pass++; else { fail++; console.error('❌ FAIL ' + n); } };
  const gat = w.GAT, d = w.document;
  const st = gat.state();
  st.recs = st.recs.concat([
    { REC_ID: 'GAT-REC-0052', REC_NO: 52, TITLE: 'ใบนอก scope (จำลองของหนึ่ง)', STATUS: 'P-04 ขั้น ④ (ตาม WI-02)', BU_DECISION: '' },
    { REC_ID: 'GAT-REC-0042', REC_NO: 42, TITLE: 'ใบใน scope', STATUS: 'ส่งให้ BU แล้ว', BU_DECISION: '' },
    { REC_ID: 'GAT-REC-0099', REC_NO: 99, TITLE: 'ใบปิดแล้ว', STATUS: 'ปิดประเด็นย่อยแล้ว (ขั้น 5)', BU_DECISION: '' }
  ]);
  gat._renderRecs(); gat.showTab('close');
  const opts = Array.from(d.getElementById('closeRecPick').options).map(o => o.value);
  ok('v1.38.2: ใบนอก scope (0052) อยู่ใน dropdown ปิดหลัก', opts.indexOf('GAT-REC-0052') >= 0);
  ok('v1.38.2: ใบใน scope (0042) ยังอยู่', opts.indexOf('GAT-REC-0042') >= 0);
  ok('v1.38.2: ใบปิดแล้ว (0099) ถูกกรองทิ้ง', opts.indexOf('GAT-REC-0099') < 0);
  // ตารางโชว์ยังกรอง scope (ได้แค่ใบใน scope = 0042 + ใบ seed ใด ๆ ที่อยู่ scope)
  const tbl = d.getElementById('recBody').textContent;
  ok('v1.38.2: ตารางแท็บ recs ยังกรองตาม scope (ไม่มี 0052)', tbl.indexOf('GAT-REC-0052') < 0);
  console.log('san v1.38.2: ' + pass + ' pass / ' + fail + ' fail');
  process.exit(fail ? 1 : 0);
}, 400);
