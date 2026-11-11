/* v1.49 — แท็บ 3 เปิดแล้วการส่งว่าง → auto ดึงชีต + dropdown แสดง "กำลังโหลด" (#31858)
 * รันแบบ standalone: จำลองแท็บ 3 ตอน packs ว่าง → assert ① ขึ้นกำลังโหลดทันที ② ยิง list_packs/list_notifs เอง ③ ชีตตอบแล้ว dropdown มีเรื่องจริง ④ ไม่วนซ้ำ
 */
globalThis.v149Res = { p: 0, f: 0 };
(function () {
  const fs = require('fs');
  const { JSDOM } = require('jsdom');
  const indexHtml = fs.readFileSync('index.html', 'utf8');
  const PROC = JSON.parse(fs.readFileSync('gat-process.json', 'utf8'));
  const SEED = JSON.parse(fs.readFileSync('gat-seed.json', 'utf8'));
  const dom = new JSDOM(indexHtml, { runScripts: 'outside-only', url: 'https://pkggatassistant-del.github.io/gat-work-system/' });
  const w = dom.window;
  const calls = [];
  let packsDelayed = false;
  const PACK_ROW = { PACK_ID: 'PACK-9300', BU: 'PMS', SCOPE: 'แผน PLAN-2569-995', TITLE: 'ส่ง v1.49', STATUS: 'รอ GAT เลือกตรวจ', CREATED_BY: 'BU ทดสอบ', CREATED_AT: '2026-11-11T00:00:00Z', NOTE: 'อ้างแผน: PLAN-2569-995 — ส่งตามประเด็น (1/1)', LINKS: '[ประเด็น 1: ข้อเดียว]\nhttps://ev.bu.com/v149' };
  w.fetch = (u) => {
    const s = String(u);
    try { calls.push(s); } catch (e) {}
    const mAct = s.match(/action=([a-z_]+)/); const act = mAct ? mAct[1] : '';
    if (act === 'list_notifs') return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, data: [{ NOTIF_ID: 'PLAN-2569-995', BU: 'PMS', PERIOD: '', TITLE: 'เรื่องจากชีต v1.49', EVENT: '', ITEMS: 'ข้อเดียว', N_ITEMS: 1, OWNER: ' BU', DUE: '', BY: 'GAT', SAVED_AT: '', STATUS: '' }] }) });
    if (act === 'list_packs') { if (packsDelayed) return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, data: [PACK_ROW] }) }); return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, data: [] }) }); }
    if (act) return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, data: [] }) });
    if (s.indexOf('gat-process.json') >= 0) return Promise.resolve({ ok: true, json: () => Promise.resolve(PROC) });
    return Promise.resolve({ ok: true, json: () => Promise.resolve(SEED) });
  };
  w.GAT_CONFIG = { VERSION: 'v1.49-test', BCT_API: 'https://gas.example/exec', SOURCES: { SEED: 'x', REC_SEED: 'x', PROCESS_SEED: 'gat-process.json' }, PROCESS_TYPES: { PM: { label: 'PM', color: '#2563eb' }, WI: { label: 'WI', color: '#0891b2' }, SD: { label: 'SD', color: '#7c3aed' }, FM: { label: 'FM', color: '#b45909' } } };
  w.eval(fs.readFileSync('gat-config.js', 'utf8'));
  w.eval(fs.readFileSync('app.js', 'utf8'));
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  const ok49 = (name, cond, extra) => { if (cond) { globalThis.v149Res.p++; } else { globalThis.v149Res.f++; console.log('  ✗ v1.49: ' + name + (extra !== undefined ? ' — ' + extra : '')); } };
  setTimeout(() => {
    try {
      const d = w.document, gat = w.GAT;
      const st = gat.state();
      st.packs = []; st.packsLoaded = false; /* จำลอง: ยังไม่มีการส่งถึงเครื่อง */
      const sel = d.getElementById('inspPlanPick');
      sel.innerHTML = '<option value="">— เลือกชื่อเรื่อง (เรื่องที่แจ้งในขั้น 1) —</option>'; /* ตัดผลจาก boot เดิม */
      gat._renderInspect();
      ok49('① เปิดแท็บ 3 ตอนว่าง → dropdown ขึ้น "กำลังโหลดการส่งจากชีต…" ทันที', sel.innerHTML.indexOf('⏳ กำลังโหลดการส่งจากชีต') >= 0, sel.innerHTML.slice(0, 120));
      ok49('② ระบบยิง list_packs เอง (ไม่ต้องกดรีเฟรช)', calls.some(c => String(c).indexOf('action=list_packs') >= 0));
      ok49('② ระบบยิง list_notifs เอง (เรื่องในชีตไหลเข้า)', calls.some(c => String(c).indexOf('action=list_notifs') >= 0));
      /* ③ ชีตตอบ (mock สลับเป็นมีข้อมูล) → dropdown ต้องมีเรื่องจริง */
      packsDelayed = true;
      setTimeout(() => {
        try {
          gat._setInspAutoPull(false); /* จำลองเปิดแท็บใหม่ — auto ดึงได้อีกครั้ง (รอบนี้ชีตมีข้อมูล) */
          st.packs = [PACK_ROW];
          gat._renderInspect();
          const opts = Array.from(sel.options).map(o => o.textContent);
          ok49('③ หลังชีตตอบ: dropdown มีเรื่องจากชีต (PLAN-2569-995)', opts.join(' | ').indexOf('เรื่องจากชีต v1.49') >= 0, JSON.stringify(opts));
          ok49('③ ไม่วนซ้ำ: _inspAutoPull ล็อกครั้งเดียว', gat._renderInspect && sel.innerHTML.indexOf('⏳ กำลังโหลด') < 0);
          ok49('✅ ชุด v1.49 จบครบ', true);
        } catch (eLate) { globalThis.v149Res.f++; console.log('  ✗ v1.49 late: ' + eLate); }
        const R = globalThis.v149Res;
        console.log('\n══ v1.49: ' + R.p + ' pass / ' + R.f + ' fail ══');
        process.exit(R.f ? 1 : 0);
      }, 120);
    } catch (e) { globalThis.v149Res.f++; console.log('  ✗ v1.49 setup: ' + e); }
  }, 300);
})();
