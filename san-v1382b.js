// sanity v1.38.2b: importBCT ดึง list_notifs → merge เข้า localStorage gat_notifs → dropdown แท็บ 1/2 มีแผนจากชีต
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8');
const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://pkggatassistant-del.github.io/gat-work-system/' });
const w = dom.window;
const SEED = JSON.parse(fs.readFileSync('gat-seed.json', 'utf8'));
let calls = [];
w.fetch = (u, opt) => {
  const s = String(u);
  let body = {};
  try { body = JSON.parse((opt && opt.body) || '{}'); } catch (e) {}
  const act = body.action || (s.match(/action=([a-z_]+)/) || [])[1] || '';
  calls.push(act);
  const json = (x) => Promise.resolve({ ok: true, json: () => Promise.resolve(x) });
  if (act === 'list_registers' || act === 'list_entries') return json({ ok: true, data: [] });
  if (act === 'list_recs' || act === 'list_issues' || act === 'list_packs') return json({ ok: true, data: [] });
  if (act === 'list_notifs') return json({ ok: true, data: [
    { NOTIF_ID: 'TEST-SHEET-001', BU: 'สอยดาว', PERIOD: 'พ.ย. 69', TITLE: 'แผนจากชีต', EVENT: 'ทดสอบ', ITEMS: 'ประเด็น A ⏎ ประเด็น B', N_ITEMS: 2, OWNER: 'GAT', BY: 'GAT', SAVED_AT: 'x', STATUS: 'แจ้งแล้ว' }
  ]});
  if (s.indexOf('gat-seed') >= 0) return json(SEED);
  if (s.indexOf('gat-rec-migration') >= 0) return json([]);
  return json([]);
};
w.GAT_CONFIG = { VERSION: 'v1.38.2-test', BCT_API: 'https://script.example/exec', SOURCES: { SEED: 'x', REC_SEED: 'x', PROCESS_SEED: 'gat-process.json' }, PROCESS_TYPES: { PM: { label: 'PM', color: '#2563eb' }, WI: { label: 'WI', color: '#0891b2' }, SD: { label: 'SD', color: '#7c3aed' }, FM: { label: 'FM', color: '#b45309' } } };
w.eval(fs.readFileSync('gat-config.js', 'utf8'));
w.eval(fs.readFileSync('app.js', 'utf8'));
w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
setTimeout(() => {
  w.GAT._importBCT();
  setTimeout(() => {
  let pass = 0, fail = 0;
  const ok = (n, c) => { if (c) pass++; else { fail++; console.error('❌ FAIL ' + n); } };
  const gat = w.GAT;
  ok('v1.38.2b: importBCT เรียก list_notifs (จาก fetch log)', calls.indexOf('list_notifs') >= 0);
  const notifs = JSON.parse(w.localStorage.getItem('gat_notifs') || '[]');
  const n = notifs.filter(x => x.NOTIF_ID === 'TEST-SHEET-001')[0];
  ok('v1.38.2b: แผนจากชีตลง localStorage gat_notifs', !!n);
  ok('v1.38.2b: items แตกจาก ⏎ (2 ประเด็น)', n && Array.isArray(n.items) && n.items.length === 2);
  ok('v1.38.2b: dropdown แท็บ 2 (packNotif) มีแผนจากชีต', w.document.getElementById('packNotif').innerHTML.indexOf('TEST-SHEET-001') >= 0);
  console.log('san v1.38.2b: ' + pass + ' pass / ' + fail + ' fail');
  process.exit(fail ? 1 : 0);
}, 600);
}, 700);
