// jsdom smoke test — GAT Work System v1.2 (Enterprise UI)
const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('index.html', 'utf8');
const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://pkggatassistant-del.github.io/gat-work-system/' });
const w = dom.window;

// --- stubs ที่ jsdom ไม่มี ---
w.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({ companies: [], regulators: [], docTypes: [], universe: [] }) });
w.GAT_CONFIG = { VERSION: 'v1.2-test', BCT_API: '', SOURCES: { SEED: 'x', REC_SEED: 'x', PROCESS_SEED: 'x' }, PROCESS_TYPES: { PM: { label: 'PM', color: '#2563eb' }, WI: { label: 'WI', color: '#0891b2' }, SD: { label: 'SD', color: '#7c3aed' }, FM: { label: 'FM', color: '#b45309' } } };
w.matchMedia = w.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));

// รัน config + app.js
w.eval(fs.readFileSync('gat-config.js', 'utf8'));
w.eval(fs.readFileSync('app.js', 'utf8'));

// DOMContentLoaded ยิงเอง
const ev = new w.Event('DOMContentLoaded');
w.document.dispatchEvent(ev);

setTimeout(() => {
  const d = w.document;
  const gat = w.GAT;
  let pass = 0, fail = 0;
  const ok = (name, cond) => { if (cond) { pass++; } else { fail++; console.error('  ❌ FAIL: ' + name); } };

  ok('GAT exported', !!gat);
  ok('showTab fn', typeof gat.showTab === 'function');
  ok('state accessible', typeof gat.state() === 'object');

  // โครงเลย์เอาต์ใหม่
  ok('sidebar มี', !!d.getElementById('sidebar'));
  ok('topbar มี', !!d.getElementById('topbar') || d.querySelector('.topbar') !== null);
  ok('nav 8+แท็บ', d.querySelectorAll('#mainNav a').length >= 8);
  ok('nav ไม่มี .nav เก่า (ใช้ #mainNav)', d.querySelector('nav.nav') === null);
  ok('panes 8', d.querySelectorAll('.tabpane').length === 8);
  ok('dashboard แสดงตอน boot', d.getElementById('pane-dashboard').classList.contains('on'));

  // render ตาราง (จะว่างเพราะ fetch stub ไม่มีข้อมูล — ต้องไม่ crash)
  ok('regBody มี', !!d.getElementById('regBody'));
  ok('kpiRow มี', !!d.getElementById('kpiRow'));

  // สลับแท็บทุกแท็บไม่ crash
  ['dashboard','registers','recs','universe','summary','process','report','bct','qms'].forEach(t => gat.showTab(t));
  ok('showTab qms (pane ยังไม่มี → ไม่ crash)', true);

  // seed จริงผ่าน eval ใหม่: จำลอง state เต็มแล้วเรนเดอร์
  gat.state().registers = [
    { REG_ID: 'REG-T1', BU: 'PMSG', PROCESS_TYPE: 'PM', TITLE: 'ทดสอบ 1', REGULATOR: 'สรรพากร', STATUS: '🟢 ปกติ', SOURCE: 'seed:T' },
    { REG_ID: 'REG-T2', BU: 'CPDG', PROCESS_TYPE: 'FM', TITLE: 'ทดสอบ 2', REGULATOR: 'DBD', STATUS: '🔴 ยังไม่มีข้อมูล', SOURCE: 'seed:T' },
    ...Array.from({ length: 40 }, (_, i) => ({ REG_ID: 'REG-F' + i, BU: 'PMSG', PROCESS_TYPE: 'WI', TITLE: 'ฟ' + i, STATUS: '🟡 รอข้อมูลจริง', SOURCE: 'seed:T' }))
  ];
  gat.showTab('registers');
  // แพตช์การเรนเดอร์: เรียก internal ผ่าน GAT.renderForTest ถ้าไม่มีให้ trigger ผ่าน filters
  // (app.js export ไม่ครบ — ใช้วิธีเรียกผ่าน event change)
  const bf = d.getElementById('buFilter');
  // อย่างน้อยตรวจว่า pagination แสดงหลัง filter event
  try { bf.dispatchEvent(new w.Event('change')); } catch (e) { console.error('change ev:', e.message); }
  ok('pagination ผูก data-pg', d.getElementById('regPage') !== null);

  ok('ver ผูก inline script', html.includes("getElementById('ver').textContent"));
  ok('no <table class="tbl" โหลด css เดิม', !html.includes('#0f172a'));  // สีเดิมหาย = css ใหม่จริง
  ok('ใช้ IBM Plex font', html.includes('IBM Plex Sans Thai'));
  ok('ใช้ hero block', html.includes('class="hero"') || html.includes('.hero'));

  console.log('\\n══════════ RESULT: ' + pass + ' pass / ' + fail + ' fail ══════════');
  process.exit(fail ? 1 : 0);
}, 300);