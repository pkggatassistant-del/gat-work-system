/* v1.39 patch — แท็บ 5 สองเหตุการณ์: ② ปิดประเด็นย่อยรายหัวข้อ + ① ปิดประเด็นหลัก (เรื่อง)
   กติกา: ทุก oldText ต้องเจอแบบ unique (split().length===2) ไม่งั้น abort ไม่เขียนไฟล์ */
const fs = require('fs');

function patch(file, pairs) {
  let s = fs.readFileSync(file, 'utf8');
  for (const [label, oldText, newText] of pairs) {
    if (!s.includes(oldText)) { console.error('MISS: ' + label + ' @' + file); process.exit(1); }
    const n = s.split(oldText).length;
    if (n !== 2) { console.error('NOT-UNIQUE: ' + label + ' @' + file + ' (x' + (n - 1) + ')'); process.exit(1); }
    s = s.replace(oldText, newText);
  }
  fs.writeFileSync(file, s);
  console.log('OK ' + file + ' (' + pairs.length + ' edits)');
}

/* ---------------- app.js ---------------- */
const appPairs = [
  ['APP1 loadPacks hook',
   `      if (res.ok) { state.packs = res.data || []; var nP = state.packs.length;`,
   `      if (res.ok) { state.packs = res.data || []; try { closeItemSyncFromSheet(); } catch (e) {} /* v1.39 — ดึงสถานะปิดรายหัวข้อจากชีต (สลับเครื่องได้) */ var nP = state.packs.length;`],

  ['APP2 region ขั้น 5 ทั้งชุด',
   String.raw`  /* ขั้น 5 — ปิดประเด็นย่อย (ต่อเรื่อง/PACK) — ระบบตรวจว่าปิดหลักครบ (v1.38: dropdown กรองหลวมลง ไม่ว่างง่าย + โชว์ชื่อเรื่องนำ) */
  function renderCloseBig() {
    var sel = document.getElementById('closeBigPackPick'); if (!sel) return;
    var cur = sel.value;
    var list = (state.packs || []).filter(function (x) { var s = String(x.STATUS || ''); return !(s.indexOf('ปิดประเด็นย่อยแล้ว') >= 0 || s.indexOf('ปิดประเด็นใหญ่แล้ว') >= 0 || s.indexOf('ลบ') >= 0); });
    sel.innerHTML = '<option value="">เลือกเรื่อง (PACK) ตามชื่อเรื่อง</option>' + list.map(function (x) {
      return '<option value="' + escP(x.PACK_ID) + '">' + escP(packShowName(x) + ' (' + x.PACK_ID + ')') + '</option>';
    }).join('');
    if (cur) sel.value = cur;
    var box = document.getElementById('closeBigCheck');
    if (!box) return;
    var pid = sel.value;
    var pk = (state.packs || []).filter(function (x) { return x.PACK_ID === pid; })[0];
    if (!pk) { box.innerHTML = ''; return; }
    // v1.38.2 — นับใบเปิด/ปิดจาก state.recs ตรง ๆ (ไม่กรอง REC_SCOPE — ใบนอก scope ก็ต้องนับ ไม่เช่นนั้น ปิดย่อยไม่ผ่าน)
    var openRecs = (state.recs || []).filter(function (r) { return String(r.STATUS || '').indexOf('ปิด') < 0; });
    var closedRecs = (state.recs || []).filter(function (r) { return String(r.STATUS || '').indexOf('ปิด') >= 0; });
    box.innerHTML = openRecs.length
      ? '<span style="color:#c0392b">⚠️ ยังมีใบประเด็นเปิดอยู่ ' + openRecs.length + ' ใบ (ปิดหลักให้ครบที่การ์ด ① ก่อน) — ปิดย่อยได้เมื่อ ' + (closedRecs.length + openRecs.length) + ' ใบจบหมด</span>'
      : '✅ ใบประเด็นปิดครบทั้งหมด ' + closedRecs.length + ' ใบ — ปิดย่อยได้ (หลังปิด: วงจรของเรื่องนี้จบ → สถานะ ปิดประเด็นย่อยแล้ว (ขั้น 5))';
  }
  function closeBig() {
    var pid = document.getElementById('closeBigPackPick').value;
    if (!pid) { status('⚠️ เลือกเรื่อง (PACK) ตามชื่อเรื่องก่อน'); return; }
    var openRecs = scopedRecs().filter(function (r) { return String(r.STATUS || '').indexOf('ปิด') < 0; });
    if (openRecs.length) { status('⛔ ยังปิดไม่ได้ — มีประเด็นไม่ผ่าน/เปิดอยู่ ' + openRecs.length + ' ใบ: ' + openRecs.map(function (x) { return x.REC_ID; }).join(', ')); return; }
    var by = document.getElementById('closeBigBy').value.trim() || 'GAT';
    var note = document.getElementById('closeBigNote').value.trim() || 'ตรวจครบตามข้อเสนอแนะ ทุกประเด็นผ่าน';
    postToBCT('update_pack_status', { PACK_ID: pid, STATUS: 'ปิดประเด็นย่อยแล้ว (ขั้น 5) — ' + note, BY: by }, function (res) {
      if (res.ok) { status('🔒 ปิดประเด็นย่อย ' + pid + ' แล้ว — ' + by + ' · บันทึกชีต + AuditLog'); loadPacks(); }
      else status('❌ ' + (res.error || 'ปิดไม่สำเร็จ'));
    });
  }`,
   String.raw`  /* ขั้น 5 — v1.39: ② ปิดประเด็นย่อย = ติ๊กปิดรายหัวข้อ (ทยอยได้ บันทึกชีตทันที ครบแพ็กปิดอัตโนมัติ) · ① ปิดประเด็นหลัก = ปิดชื่อเรื่อง (REC) กันหยุ่นด้วยข้อย่อย */
  function thNow() { try { return new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }); } catch (e) { return String(new Date()); } }
  function closeItemStateGet(pid) {
    try {
      var m = JSON.parse(localStorage.getItem('gat_item_close_' + pid) || '{}');
      if (!m || typeof m !== 'object') m = {};
      Object.keys(m).forEach(function (k) { if (m[k] === true) m[k] = { done: true, by: '', at: '' }; }); /* migrate รูปเก่า v1.39 รอบแรก */
      return m;
    } catch (e) { return {}; }
  }
  function closeItemStateSave(pid, m) { try { localStorage.setItem('gat_item_close_' + pid, JSON.stringify(m || {})); } catch (e) {} }
  /* v1.39 — sync จากชีต: AI_NOTE มี "[ปิดข้อ key] โดย X @ เวลา" → เติมแผนที่เฉพาะข้อที่ยังไม่ปิด (ปิดช่วยกันหลายเครื่องได้) */
  function closeItemSyncFromSheet() {
    try {
      (state.packs || []).forEach(function (pk) {
        var note = String(pk.AI_NOTE || '');
        if (!note) return;
        var re = /\[ปิดข้อ ([^\]\n@]+)\]\s*โดย ([^@\n]+) @ ([^\n]*)/g, m, changed = false;
        var map = closeItemStateGet(pk.PACK_ID);
        while ((m = re.exec(note)) !== null) {
          var k = m[1].trim();
          if (!k || (map[k] && map[k].done)) continue;
          map[k] = { done: true, by: m[2].trim(), at: m[3].trim() }; changed = true;
        }
        if (changed) closeItemStateSave(pk.PACK_ID, map);
      });
    } catch (e) {}
  }
  /* v1.39 — แยกข้อมูลขั้น 3 ต่อหัวข้อจาก AI_NOTE: บรรทัด "[label] สถานะ: ตรวจสอบแล้ว = ผ่าน/ไม่ผ่าน — เหตุผล" (บล็อก ผลตรวจต่อประเด็น แท็บ 3) */
  function closeItemNoteInfo(pk) {
    var out = {};
    try {
      String(pk.AI_NOTE || '').split('\n').forEach(function (ln) {
        var mm = ln.match(/^\[(.+?)\]\s*สถานะ:\s*(.+?)$/);
        if (!mm) return;
        var label = mm[1].trim().replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
        var rest = mm[2];
        var res = (rest.match(/=\s*(ผ่าน|ไม่ผ่าน)/) || [])[1] || '';
        out[label] = { st: esc(rest.trim()), res: res };
      });
    } catch (e) {}
    return out;
  }
  function closeItemClosedMap(pk) {
    var m = closeItemStateGet(pk.PACK_ID);
    return inspItemRows(pk).map(function (r) { return (m[r.key] && m[r.key].done) ? r.key : null; }).filter(Boolean);
  }
  /* v1.39 — ①: แพ็กที่โยงกับใบ (ชื่อเรื่องตรงกัน ผ่าน NOTE "อ้างแผน" หรือ TITLE) — ตัดแพ็กที่ปิด/ลบแล้ว */
  function packsOfRec(rec) {
    if (!rec) return [];
    var t = String(rec.TITLE || '').trim();
    if (!t) return [];
    return (state.packs || []).filter(function (x) {
      var s = String(x.STATUS || '');
      if (s.indexOf('ลบ') >= 0 || s.indexOf('ปิดประเด็นย่อยแล้ว') >= 0 || s.indexOf('ปิดประเด็นใหญ่แล้ว') >= 0) return false;
      return String(packPlanTitle(x) || String(x.TITLE || '')).trim() === t || String(x.TITLE || '').trim() === t;
    });
  }
  /* v1.39 — ①: รายการข้อย่อยที่ยังเปิดของ "ใบ" = ทุกแพ็กที่โยงกัน + ทุกหัวข้อที่ยังไม่ติ๊ก */
  function itemCloseOpenOfRec(recId) {
    var rec = (state.recs || []).filter(function (x) { return x.REC_ID === recId; })[0];
    if (!rec) return [];
    var open = [];
    packsOfRec(rec).forEach(function (pk) {
      var doneSet = {}; closeItemClosedMap(pk).forEach(function (k) { doneSet[k] = true; });
      inspItemRows(pk).forEach(function (r) { if (!doneSet[r.key]) open.push('PACK ' + pk.PACK_ID + ' ข้อ ' + r.key + ' — ' + r.label); });
    });
    return open;
  }
  /* v1.39 — ป้ายกันหยุ่นใต้ dropdown ① (ผูกกับ event change ของ #closeRecPick) */
  function recClosePickChange() {
    var g = document.getElementById('closeRecGate'); if (!g) return;
    var recId = document.getElementById('closeRecPick').value;
    if (!recId) { g.innerHTML = ''; return; }
    var rec = (state.recs || []).filter(function (x) { return x.REC_ID === recId; })[0];
    var links = packsOfRec(rec);
    if (!links.length) { g.innerHTML = '<span style="color:#8a6d3b">ℹ️ ไม่พบแพ็กที่ชื่อเรื่องตรงกับใบนี้ — ปิดประเด็นหลักได้ (ระบบจด AuditLog ให้)</span>'; return; }
    var open = itemCloseOpenOfRec(recId); /* v1.39 — fix: ประกาศ open ก่อนใช้ */
    /* v1.39 — ป้าย ① โชว์ข้อมูลขั้น 3/4 ต่อหัวข้อที่ค้าง (จาก AI_NOTE ขั้น 3 + สถานะขั้น 4) */
    if (open.length) {
      open = open.map(function (t) {
        var mm = t.match(/^PACK ([A-Z0-9-]+) ข้อ ([^\s]+) — (.*)$/);
        if (!mm) return t;
        var pk2 = (state.packs || []).filter(function (x) { return x.PACK_ID === mm[1]; })[0];
        var inf = pk2 ? (closeItemNoteInfo(pk2)[mm[2]] || {}) : {};
        var bits = [];
        if (inf.st) bits.push('ตรวจ (ขั้น 3): ' + inf.st);
        var pkst2 = pk2 ? String(pk2.STATUS || '') : '';
        if (pkst2.indexOf('ไม่ผ่าน') >= 0) bits.push('ขั้น 4: ❌ ไม่ผ่าน');
        else if (pkst2.indexOf('ผ่านการตรวจ') >= 0 || pkst2.indexOf('รอปิดประเด็น') >= 0) bits.push('ขั้น 4: ✅ ผ่าน');
        return t + (bits.length ? ' <span style="font-size:11.5px;color:#7d93b2">[' + bits.join(' · ') + ']</span>' : '');
      });
    }
    g.innerHTML = open.length
      ? '<span style="color:#c0392b">⛔ ปิดประเด็นหลักยังไม่ได้ — ต้องปิดประเด็นย่อยให้ครบก่อน (ค้าง ' + open.length + ' ข้อ): ' + open.slice(0, 6).map(function (t) { return esc(t); }).join(' · ') + (open.length > 6 ? ' · …' : '') + '</span>'
      : '<span style="color:#0e8345">✅ ประเด็นย่อยครบทุกแพ็กแล้ว — ปิดประเด็นหลัก (ชื่อเรื่อง) ได้</span>';
  }
  function renderCloseBig() {
    var sel = document.getElementById('closeBigPackPick'); if (!sel) return;
    var cur = sel.value;
    var list = (state.packs || []).filter(function (x) { var s = String(x.STATUS || ''); return !(s.indexOf('ปิดประเด็นย่อยแล้ว') >= 0 || s.indexOf('ปิดประเด็นใหญ่แล้ว') >= 0 || s.indexOf('ลบ') >= 0); });
    sel.innerHTML = '<option value="">เลือกเรื่อง (PACK) ตามชื่อเรื่อง</option>' + list.map(function (x) {
      return '<option value="' + escP(x.PACK_ID) + '">' + escP(packShowName(x) + ' (' + x.PACK_ID + ')') + '</option>';
    }).join('');
    if (cur) sel.value = cur;
    var box = document.getElementById('closeBigCheck');
    if (!box) return;
    var pid = sel.value;
    var pk = (state.packs || []).filter(function (x) { return x.PACK_ID === pid; })[0];
    if (!pk) { box.innerHTML = ''; return; }
    try { closeItemSyncFromSheet(); } catch (e) {}
    var rows = inspItemRows(pk);
    if (!rows.length) {
      box.innerHTML = '<span style="color:#8a6d3b">ℹ️ PACK นี้ไม่มีโครงหัวข้อ (ส่งก่อน v1.33) — กดปุ่ม ② ด้านล่างเพื่อปิดทั้งแพ็กตามเดิม</span>';
      return;
    }
    var m = closeItemStateGet(pk.PACK_ID);
    var doneCnt = rows.filter(function (r) { return m[r.key] && m[r.key].done; }).length;
    /* v1.39 — ข้อมูลจากขั้น 3/4: ต่อหัวข้อจาก AI_NOTE (บล็อก ผลตรวจต่อประเด็น ขั้น 3) + ผลตัดสินขั้น 4 จากสถานะของแพ็ก */
    var infoMap = closeItemNoteInfo(pk);
    var pkst = String(pk.STATUS || '');
    var step4 = pkst.indexOf('ไม่ผ่าน') >= 0 ? '<span style="color:#c0392b">❌ ไม่ผ่าน (ขั้น 4 ส่งกลับขั้น 2)</span>'
      : (pkst.indexOf('ผ่านการตรวจ') >= 0 || pkst.indexOf('รอปิดประเด็น') >= 0) ? '<span style="color:#0e8345">✅ ผ่าน (ขั้น 4)</span>'
      : '<span style="color:#7d93b2">⏳ ยังไม่ตัดสิน (ขั้น 4)</span>';
    var h = '<div style="margin-bottom:6px"><b style="color:#1a2b45">② ปิดประเด็นย่อย — ติ๊กถูก = ปิดทันที (บันทึกชีตต่อหัวข้อ)</b> <span style="color:#7d93b2;font-size:12.5px">ปิดแล้ว ' + doneCnt + '/' + rows.length + ' หัวข้อ — ครบทุกข้อ: ระบบปิดแพ็กให้เอง (ขั้น 5)</span></div>';
    h += '<div style="margin-bottom:4px;font-size:12.5px;color:#1a2b45">ผลตัดสินขั้น 4 (รายเรื่อง): ' + step4 + '</div>';
    h += '<table class="tbl" style="font-size:13px">';
    rows.forEach(function (r) {
      var s0 = m[r.key] || {};
      var isDone = !!s0.done;
      var inf = infoMap[r.key] || {};
      var st3 = inf.st || '<span style="color:#7d93b2">ยังไม่มีผลตรวจขั้น 3</span>';
      h += '<tr>' +
        '<td style="width:44px;text-align:center">' + (isDone
          ? '<span title="ปิดแล้ว" style="color:#0e8345">✅</span>'
          : '<input type="checkbox" class="cl-item" data-clk="' + escP(pk.PACK_ID + '|' + r.key) + '">') + '</td>' +
        '<td style="color:#1a2b45">' + (isDone ? '<s style="color:#7d93b2">' : '') + esc(r.label) + (isDone ? '</s>' : '') +
        (isDone && s0.by ? ' <span style="font-size:11.5px;color:#7d93b2">— ปิดโดย ' + esc(s0.by) + (s0.at ? ' @ ' + esc(s0.at) : '') + '</span>' : '') + '</td>' +
        '<td style="font-size:12px;color:#44597a">' + st3 + '</td></tr>';
    });
    h += '</table>';
    box.innerHTML = h;
  }
  /* v1.39 — ② ปิดทีละหัวข้อ: 1 ติ๊ก = 1 โพสต์ AI_NOTE (คงเนื้อหา ผลตรวจขั้น 3 + ต่อ marker "[ปิดข้อ key] โดย …") · ข้อสุดท้าย → packCloseIf ปิดแพ็ก */
  function closeOneItem(pk, key, by, note) {
    var rows = inspItemRows(pk);
    var total = rows.length;
    var doneList = closeItemClosedMap(pk);
    var doneSet = {}; doneList.forEach(function (k) { doneSet[k] = true; });
    var doneCnt = doneList.length + (doneSet[key] ? 0 : 1);
    var who = (by || '').trim() || 'GAT';
    var prev = String(pk.AI_NOTE || '');
    var hdr = '— ขั้น 5 ปิดประเด็นย่อย (v1.39) —';
    var head, tail;
    var hIdx = prev.indexOf(hdr);
    if (hIdx >= 0) { head = prev.slice(0, hIdx) + hdr; tail = prev.slice(hIdx + hdr.length).replace(/^\n+/, ''); }
    else { head = prev ? prev + '\n' + hdr : hdr; tail = ''; }
    var lines = tail.split('\n').filter(function (l) { return l.trim() && l.indexOf('[ปิดข้อ ' + key + '] โดย ') !== 0; });
    lines.push('[ปิดข้อ ' + key + '] โดย ' + who + ' @ ' + thNow() + (note ? ' — ' + note : ''));
    var merged = head + '\n' + lines.join('\n');
    status('กำลังปิดหัวข้อ ' + esc(key) + ' — บันทึกลงชีต…');
    postToBCT('update_pack_status', { PACK_ID: pk.PACK_ID, STATUS: '', FIELD: 'AI_NOTE', NOTE: merged, BY: who }, function (res) {
      if (!res.ok) { status('❌ ' + (res.error || 'ปิดหัวข้อไม่สำเร็จ') + ' — ติ๊กในเครื่องนี้ไว้แล้ว แต่ชีตยังไม่บันทึก'); return; }
      var map = closeItemStateGet(pk.PACK_ID);
      map[key] = { done: true, by: who, at: thNow(), note: note || '' };
      closeItemStateSave(pk.PACK_ID, map);
      pk.AI_NOTE = merged;
      if (doneCnt >= total) packCloseIf(pk, who, total, (note || '').trim());
      status('✅ ปิดหัวข้อ ' + esc(key) + ' แล้ว (' + doneCnt + '/' + total + ') — บันทึกชีต + AuditLog');
      try { renderCloseBig(); renderRecs(); } catch (e) {}
    });
  }
  /* v1.39 — ปิดแพ็ก (เมื่อข้อย่อยครบ หรือแพ็กไม่มีโครงข้อ): สถานะคอลัมน์ 8 = ปิดประเด็นย่อยแล้ว (ขั้น 5) */
  function packCloseIf(pk, by, total, note) {
    var stTxt = 'ปิดประเด็นย่อยแล้ว (ขั้น 5) — ' + packShowName(pk) + ' — ปิดรายประเด็นครบ ' + total + '/' + total + ' รายการ' + (note ? ' · ' + note : '') + ' · โดย ' + (by || 'GAT');
    postToBCT('update_pack_status', { PACK_ID: pk.PACK_ID, STATUS: stTxt, BY: by || 'GAT' }, function (res) {
      if (res.ok) { pk.STATUS = stTxt; loadPacks(); }
    });
  }
  function closeBig() {
    var pid = document.getElementById('closeBigPackPick').value;
    if (!pid) { status('⚠️ เลือกเรื่อง (PACK) ตามชื่อเรื่องก่อน'); return; }
    var pk = (state.packs || []).filter(function (x) { return x.PACK_ID === pid; })[0];
    if (!pk) { status('❌ ไม่พบข้อมูลแพ็ก — กด "กดโหลดสถานะ" ใหม่'); return; }
    var rows = inspItemRows(pk);
    if (rows.length) {
      var open = rows.filter(function (r) { return closeItemClosedMap(pk).indexOf(r.key) < 0; });
      if (open.length) { status('⛔ ปิดรวมยังไม่ได้ — ติ๊กปิดรายหัวข้อด้านบนให้ครบก่อน (ค้าง ' + open.length + '/' + rows.length + ' หัวข้อ: ' + open.map(function (r) { return r.key; }).join(', ') + ')'); return; }
      packCloseIf(pk, document.getElementById('closeBigBy').value.trim() || 'GAT', rows.length, document.getElementById('closeBigNote').value.trim());
      status('🔒 ปิดประเด็นย่อยทั้งแพ็ก ' + pid + ' — ส่งบันทึกลงชีต (ขั้น 5)');
      return;
    }
    /* v1.39 — PACK ไม่มีโครงหัวข้อ (ส่งก่อน v1.33): กดปุ่ม = ปิดทั้งแพ็กโดยตรง (โมเดลใหม่: ไม่ติดประตู "ใบเปิดครบ" อีกต่อไป) */
    var by2 = document.getElementById('closeBigBy').value.trim() || 'GAT';
    var note2 = document.getElementById('closeBigNote').value.trim() || 'ตรวจครบตามข้อเสนอแนะ ทุกประเด็นผ่าน';
    postToBCT('update_pack_status', { PACK_ID: pid, STATUS: 'ปิดประเด็นย่อยแล้ว (ขั้น 5) — ' + note2, BY: by2 }, function (res) {
      if (res.ok) { status('🔒 ปิดประเด็นย่อย ' + pid + ' แล้ว — ' + by2 + ' · บันทึกชีต + AuditLog'); loadPacks(); }
      else status('❌ ' + (res.error || 'ปิดไม่สำเร็จ'));
    });
  }`],

  ['APP3 importBCT hook',
   `        state.packs = (res[3] && res[3].ok ? res[3].data : state.packs || []);`,
   `        state.packs = (res[3] && res[3].ok ? res[3].data : state.packs || []);
        try { closeItemSyncFromSheet(); } catch (e) {} /* v1.39 — ดึงสถานะปิดรายหัวข้อจากชีต */`],

  ['APP4 renderRecs dropdown ① + ป้าย',
   `      // v1.38.2 — ไม่กรอง REC_SCOPE แล้ว (scope ใช้กับตารางโชว์เท่านั้น) — ใบจริงทั้งหมดต้องเลือกได้
      cp.innerHTML = '<option value="">— เลือกใบที่ตรวจจบแล้ว (ปิดย่อย) —</option>' + (state.recs || []).filter(function (x) {
        var st = String(x.STATUS || '');
        return st.indexOf('ปิด') < 0 && st.indexOf('ทดสอบ') < 0;
      }).map(function (x) {
        return '<option value="' + esc(x.REC_ID) + '">' + esc(x.REC_ID) + ' · ' + esc(String(x.TITLE || '').slice(0, 40)) + ' · ' + esc(String(x.STATUS || '')) + '</option>';
      }).join('');
      cp.value = curc;
    }`,
   `      // v1.39 — ① ปิดประเด็นหลัก: โชว์ "ชื่อเรื่อง (REC_ID) · สถานะ" นำ (เดิม v1.38.2: ไม่กรอง REC_SCOPE — คงเดิม)
      cp.innerHTML = '<option value="">— เลือกประเด็นหลัก (ชื่อเรื่อง) ที่ตรวจจบแล้ว —</option>' + (state.recs || []).filter(function (x) {
        var st = String(x.STATUS || '');
        return st.indexOf('ปิด') < 0 && st.indexOf('ทดสอบ') < 0;
      }).map(function (x) {
        var ttl = String(x.TITLE || '').slice(0, 48);
        return '<option value="' + esc(x.REC_ID) + '">' + esc(ttl || x.REC_ID) + ' (' + esc(x.REC_ID) + ') · ' + esc(String(x.STATUS || '')) + '</option>';
      }).join('');
      cp.value = curc;
    }
    try { recClosePickChange(); } catch (e) {} /* v1.39 — ป้ายกันหยุ่น ① ตามใบที่เลือกไว้ */`],

  ['APP5 boot b7 ① กันหยุ่น',
   `    // v1.9 — ปิดใบ (GAT ยืนยัน)
    var b7 = id('btnCloseRec');
    if (b7) b7.addEventListener('click', function () {
      var recId = id('closeRecPick').value;
      var st = function (t) { status(t); };
      if (!recId) { st('⚠️ เลือกใบที่ตรวจจบแล้วก่อน (ปิดย่อยเฉพาะใบที่ตรวจผ่านตามข้อเสนอแนะ)'); return; }
      var by = id('closeBy').value.trim() || 'GAT';
      postToBCT('close_issue', { REC_ID: recId, BY: by }, function (res) {
        if (res.ok) { st('🔒 ปิดใบ ' + recId + ' แล้ว — บันทึกชีต + AuditLog'); importBCT(true); }
        else st('❌ ' + (res.error || 'ปิดไม่สำเร็จ'));
      });
    });`,
   `    /* v1.9 — ปิดใบ · v1.39 ① ปิดประเด็นหลัก (ชื่อเรื่อง) — กันหยุ่น: ต้องปิดประเด็นย่อยครบทุกแพ็กที่โยงกันก่อน */
    var b7 = id('btnCloseRec');
    if (b7) b7.addEventListener('click', function () {
      var recId = id('closeRecPick').value;
      var st = function (t) { status(t); };
      if (!recId) { st('⚠️ เลือกประเด็นหลัก (ชื่อเรื่อง) ที่จะปิดก่อน'); return; }
      var open = itemCloseOpenOfRec(recId);
      if (open.length) { st('⛔ ปิดประเด็นหลักยังไม่ได้ — ต้องปิดประเด็นย่อยให้ครบก่อน (ค้าง ' + open.length + ' ข้อ): ' + open.slice(0, 4).join(' · ')); return; }
      var by = id('closeBy').value.trim() || 'GAT';
      postToBCT('close_issue', { REC_ID: recId, BY: by }, function (res) {
        if (res.ok) { st('🔒 ปิดประเด็นหลัก (เรื่อง) ' + recId + ' แล้ว — บันทึกชีต + AuditLog'); importBCT(true); }
        else st('❌ ' + (res.error || 'ปิดไม่สำเร็จ'));
      });
    });`],

  ['APP6 wiring ทิก② + ป้าย①',
   `    /* ขั้น 5 — ปิดใหญ่ */
    var cbp = id('closeBigPackPick'); if (cbp) cbp.addEventListener('change', renderCloseBig);
    var cbb = id('btnCloseBig'); if (cbb) cbb.addEventListener('click', closeBig);`,
   `    /* ขั้น 5 — v1.39: ② ติ๊กรายหัวข้อ (delegated change บน #closeBigCheck) · ① dropdown ปิดเรื่อง */
    var cbp = id('closeBigPackPick'); if (cbp) cbp.addEventListener('change', renderCloseBig);
    var cbb = id('btnCloseBig'); if (cbb) cbb.addEventListener('click', closeBig);
    var crp = id('closeRecPick'); if (crp) crp.addEventListener('change', recClosePickChange);
    var cbx = id('closeBigCheck');
    if (cbx) cbx.addEventListener('change', function (ev) {
      var t = ev.target;
      if (!t || !t.classList || !t.classList.contains('cl-item')) return;
      var pv = String(t.getAttribute('data-clk') || '').split('|');
      if (pv.length < 2) return;
      var pk = (state.packs || []).filter(function (x) { return x.PACK_ID === pv[0]; })[0];
      if (!pk) { status('❌ ไม่พบแพ็ก ' + pv[0] + ' — กด "กดโหลดสถานะ" ใหม่'); return; }
      if (!t.checked) { t.checked = false; return; }
      closeOneItem(pk, pv[1], id('closeBigBy').value.trim() || 'GAT', id('closeBigNote').value.trim());
    });`],

  ['APP7 TAB_NAMES',
   `close: '5. ปิดประเด็น (หลัก+ย่อย)'`,
   `close: '5. ปิดประเด็น (① หลัก=เรื่อง · ② ย่อย=รายหัวข้อ)'`],

  ['APP8 RUN_STEPS ขั้น 5',
   `    { id: '5', name: 'ทีม GAT ปิดประเด็น (หลักต่อหัวข้อที่ตรวจจบ + ปิดย่อยเมื่อครบทุกประเด็น)', sla: 'ปิดย่อยได้เมื่อตรวจครบ — มีประเด็นไม่ผ่าน = ยังไม่ปิด', check: ['ปิดหลัก: ใบ/หัวข้อที่ตรวจจบตามข้อเสนอแนะที่ร้องขอ', 'ปิดย่อย: ตรวจครบทุกประเด็นของเรื่อง (ระบบตรวจนับใบเปิด)', 'ถ้ามีประเด็นไม่ผ่าน = งานยังไม่ปิด — รอวนขั้น 2→3→4'], tab: 'close', tabNote: 'ทำที่แท็บ 5 (ปิดประเด็น)', act: 'close', actLabel: 'ไปแท็บ 5 — ปิดประเด็น' },`,
   `    { id: '5', name: 'ทีม GAT ปิดประเด็น (② ย่อย = ติ๊กปิดรายหัวข้อ ทยอยได้ · ① หลัก = ปิดชื่อเรื่อง)', sla: 'ปิดย่อย: บันทึกชีตทันทีต่อหัวข้อ ครบแพ็ก = สถานะ ขั้น 5 อัตโนมัติ · ปิดหลักได้เมื่อข้อย่อยครบทุกแพ็ก', check: ['② ปิดประเด็นย่อย: เลือกเรื่อง (PACK) → ติ๊กปิดรายหัวข้อ ทยอยได้ (ครบทุกข้อ = แพ็กปิดอัตโนมัติ ขั้น 5)', '① ปิดประเด็นหลัก: เลือกชื่อเรื่อง → ระบบกันให้ปิดได้เมื่อหัวข้อย่อยของทุกแพ็กครบ', 'ถ้ามีประเด็นไม่ผ่าน = ยังติ๊กปิดไม่ได้ — รอวนขั้น 2→3→4'], tab: 'close', tabNote: 'ทำที่แท็บ 5 (ปิดประเด็น: ② ติ๊กย่อย · ① ปิดเรื่อง)', act: 'close', actLabel: 'ไปแท็บ 5 — ปิดประเด็น' },`],

  ['APP9 exports',
   `_renderCloseBig: renderCloseBig, _closeBig: closeBig, _fillInspectPack: fillInspectPack, _importBCT: importBCT };`,
   `_renderCloseBig: renderCloseBig, _closeBig: closeBig, _closeOneItem: closeOneItem, _packCloseIf: packCloseIf, _packsOfRec: packsOfRec, _itemCloseOpenOfRec: itemCloseOpenOfRec, _closeItemStateGet: closeItemStateGet, _closeItemStateSave: closeItemStateSave, _closeItemSyncFromSheet: closeItemSyncFromSheet, _closeItemNoteInfo: closeItemNoteInfo, _recCloseGateChange: recClosePickChange, _fillInspectPack: fillInspectPack, _importBCT: importBCT }`],

  ['APP10 boot bind-once (กัน DOMContentLoaded dispatch ซ้ำ → listener ผูก 2 ชั้น → post ซ้ำ)',
   `document.addEventListener('DOMContentLoaded', boot);`,
   `/* v1.39 — boot ครั้งเดียวจริง ๆ: กัน dispatch DOMContentLoaded ซ้ำ (jsdom/test) และยิงทันทีถ้า DOM พร้อมแล้ว */
var __gatBootOnce = function () { if (window.__gatBooted) return; window.__gatBooted = true; try { boot(); } catch (e) { console.error('boot error:', e); } };
document.addEventListener('DOMContentLoaded', __gatBootOnce);
if (document.readyState !== 'loading') __gatBootOnce();`],
];

/* ---------------- index.html (แท็บ 5) ---------------- */
const htmlPairs = [
  ['IA การ์ดหัวแท็บ 5',
   `      <div class="card-hd"><b>🔒 ขั้น 5 — GAT ปิดประเด็น (ตามผัง: ปิดได้เมื่อตรวจผ่านตามข้อเสนอแนะที่ร้องขอ)</b></div>
      <p class="desc">ปิดได้ 2 เหตุการณ์: <b>① ปิดประเด็นหลัก</b> — ประเด็น/หัวข้อหนึ่งตรวจจบแล้ว (ตรวจครบตามข้อเสนอแนะที่ร้องขอ) ปิดเฉพาะหัวข้อนั้น · <b>② ปิดประเด็นย่อย</b> — ตรวจครบทุกประเด็นของเรื่อง (เหลือประเด็นไม่ผ่านอยู่ = ยังปิดไม่ได้) · ระบบตรวจให้: ปิดประเด็นย่อยได้เมื่อปิดหลักครบทุกใบเปิด</p>`,
   `      <div class="card-hd"><b>🔒 ขั้น 5 — GAT ปิดประเด็น (v1.39: ② ติ๊กปิดรายหัวข้อที่การ์ด ② · ① ปิดชื่อเรื่องที่การ์ด ①)</b></div>
      <p class="desc">ปิดได้ 2 เหตุการณ์: <b>② ปิดประเด็นย่อย</b> — ติ๊กปิดรายหัวข้อในการ์ด ② ได้ทยอยทีละข้อ (บันทึกลงชีตทันทีต่อหัวข้อ · ครบทุกข้อของแพ็ก = สถานะ "ปิดประเด็นย่อยแล้ว (ขั้น 5)" อัตโนมัติ) · <b>① ปิดประเด็นหลัก</b> — ปิดชื่อเรื่อง (REC) ได้เมื่อประเด็นย่อยของทุกแพ็กที่โยงกับเรื่องนั้นปิดครบ — ระบบกันหยุ่นให้</p>`],

  ['IB การ์ด ①',
   `      <div class="card-hd"><b>🔒 ① ปิดประเด็นหลัก (ต่อใบ/ต่อประเด็น)</b></div>
      <p class="desc">เลือกใบ REC ที่ตรวจจบแล้ว (ผ่านตามข้อเสนอแนะที่ร้องขอ) → ปิดรายใบ — จด AuditLog "close_issue"</p>
      <div class="filters"><select id="closeRecPick" style="flex:1;min-width:300px"><option value="">— เลือกใบที่ตรวจจบแล้ว —</option></select></div>`,
   `      <div class="card-hd"><b>🔒 ① ปิดประเด็นหลัก (ปิดชื่อเรื่อง · REC — ปิดได้เมื่อหัวข้อย่อยครบ)</b></div>
      <p class="desc">เลือกชื่อเรื่องที่ตรวจจบแล้ว → ระบบตรวจว่า "ประเด็นย่อย" ของทุกแพ็กในเรื่องนั้นปิดครบ (ผ่านการ์ด ②) → ก่อนอนุญาตให้ปิด — จด AuditLog "close_issue"</p>
      <div class="filters"><select id="closeRecPick" style="flex:1;min-width:300px"><option value="">— เลือกประเด็นหลัก (ชื่อเรื่อง) ที่ตรวจจบแล้ว —</option></select></div>
      <div id="closeRecGate" class="desc" style="margin-top:4px"></div>`],

  ['IC ปุ่ม ①',
   `<button id="btnCloseRec" class="gold">🔒 ปิดประเด็นหลัก (GAT ยืนยัน)</button>`,
   `<button id="btnCloseRec" class="gold">🔒 ปิดประเด็นหลัก (GAT ยืนยัน — ระบบเช็คข้อย่อยก่อน)</button>`],

  ['ID การ์ด ②',
   `      <div class="card-hd"><b>🔒 ② ปิดประเด็นย่อย (ต่อเรื่อง/PACK — ปิดได้เมื่อครบทุกประเด็น)</b></div>
      <div class="filters"><select id="closeBigPackPick" style="flex:1;min-width:320px"><option value="">เลือกเรื่อง (PACK) ตามชื่อเรื่อง</option></select>
      <input id="closeBigBy" placeholder="ชื่อ-ตำแหน่งผู้ปิด (GAT)" style="width:240px"></div>
      <div id="closeBigCheck" class="desc" style="margin-top:6px"></div>
      <div class="filters">
        <input id="closeBigNote" placeholder="บันทึกการปิด (เช่น ตรวจครบตามข้อเสนอแนะ ทุกประเด็นผ่าน)" style="flex:1;min-width:280px">
        <button id="btnCloseBig" class="gold">🔒 ปิดประเด็นย่อย (เมื่อครบทุกประเด็น)</button>
      </div>`,
   `      <div class="card-hd"><b>🔒 ② ปิดประเด็นย่อย (ติ๊กปิดรายหัวข้อ — ทยอยได้ ครบแพ็กปิดอัตโนมัติ)</b></div>
      <p class="desc">เลือกเรื่อง (PACK) → ตารางหัวข้อโชว์ด้านล่าง → ติ๊กถูกทีละข้อ = ปิดทันที (บันทึกชีต AI_NOTE รายหัวข้อ · ปิดช่วยกันหลายเครื่องได้) · ครบทุกข้อ: ระบบปิดแพ็กให้เอง (ขั้น 5) · แพ็กที่ไม่มีโครงหัวข้อ (ส่งก่อน v1.33): กดปุ่มด้านล่างปิดทั้งแพ็กได้เลย</p>
      <div class="filters"><select id="closeBigPackPick" style="flex:1;min-width:320px"><option value="">เลือกเรื่อง (PACK) ตามชื่อเรื่อง</option></select>
      <input id="closeBigBy" placeholder="ชื่อ-ตำแหน่งผู้ปิด (GAT)" style="width:240px"></div>
      <div id="closeBigCheck" class="desc" style="margin-top:6px"></div>
      <div class="filters">
        <input id="closeBigNote" placeholder="บันทึกการปิด (เช่น ตรวจครบตามข้อเสนอแนะ ทุกประเด็นผ่าน — ใส่เมื่อปิดข้อสุดท้าย)" style="flex:1;min-width:280px">
        <button id="btnCloseBig" class="gold">🔒 ปิดรวมทั้งแพ็ก (เฉพาะแพ็กไม่มีโครงหัวข้อ / ติ๊กครบแล้ว)</button>
      </div>`]
];

/* ---------------- gat-config VERSION ---------------- */
const cfgPairs = [
  ['CFG VERSION',
   `  VERSION: 'v1.38.2 (10 พ.ย. 69) — แท็บ 5: dropdown ปิดประเด็นหลัก/ย่อย + การนับใบเปิด-ปิด = ไม่กรอง REC_SCOPE อีกต่อไป (โหมด scope ใช้กับตารางโชว์เท่านั้น — ใบจริงทุกใบเลือกได้ แม้เลขเกิน 0051); เดิม v1.38.1:`,
   `  VERSION: 'v1.39 (10 พ.ย. 69) — แท็บ 5 สองเหตุการณ์: ② ปิดประเด็นย่อย = ติ๊กปิดรายหัวข้อในการ์ด ② ทยอยได้ (บันทึกชีต AI_NOTE ทันทีต่อหัวข้อ · ครบทุกข้อ = สถานะ "ปิดประเด็นย่อยแล้ว (ขั้น 5)" อัตโนมัติ · sync จากชีต ปิดช่วยกันหลายเครื่องได้) · ① ปิดประเด็นหลัก = ปิดชื่อเรื่อง (REC) ได้เมื่อหัวข้อย่อยของทุกแพ็กครบ (ป้ายกันหยุ่นใต้ dropdown ①); เดิม v1.38.2: แท็บ 5: dropdown ปิดประเด็นหลัก/ย่อย + การนับใบเปิด-ปิด = ไม่กรอง REC_SCOPE อีกต่อไป (โหมด scope ใช้กับตารางโชว์เท่านั้น — ใบจริงทุกใบเลือกได้ แม้เลขเกิน 0051); เดิม v1.38.1:`]
];

/* ---------------- test-ui.js ---------------- */
const testPairs = [
  ['T1 ปรับเหตุผล assert v1.29 ปิดรวม (โมเดลใหม่)',
   `            d.getElementById('btnCloseBig').click();
            ok('v1.29: ปิดย่อยถูกบล็อกเพราะมีใบเปิด', bcFired === 0, bcFired);`,
   `            d.getElementById('btnCloseBig').click();
            /* v1.39 — PACK-9992 ไม่มีโครงหัวข้อ → โมเดลใหม่ ②: กดปุ่มปิดรวมตรง (ไม่ติดประตู "ใบเปิดครบ" อีกต่อไป) */
            ok('v1.29/39: ปิดรวมแพ็กไม่มีโครงข้อ ไม่ถูกบล็อกด้วยใบเปิด (โมเดลใหม่ ②)', bcFired >= 1, bcFired);`],

  ['T2 RESULT รวม + exit รวม v1.39',
   String.raw`      globalThis._g127done = true;
      var p2 = (typeof packFormRes !== 'undefined' && packFormRes) ? packFormRes : { p: 0, f: 0 };
      console.log('\n══ RESULT รวม: ' + (pass + p2.p) + ' pass / ' + (fail + p2.f) + ' fail (หลัก+ฟอร์มขั้น2+v1.27) ══');
      process.exit((fail + p2.f) ? 1 : 0);`,
   String.raw`      globalThis._g127done = true;
      var p2 = (typeof packFormRes !== 'undefined' && packFormRes) ? packFormRes : { p: 0, f: 0 };
      var v3 = globalThis.v139Res || { p: 0, f: 0 };
      console.log('\n══ RESULT รวม: ' + (pass + p2.p + v3.p) + ' pass / ' + (fail + p2.f + v3.f) + ' fail (หลัก+ฟอร์มขั้น2+v1.27+v1.39) ══');
      process.exit((fail + p2.f + v3.f) ? 1 : 0);`]
];

/* v1.39 test block — append ท้ายไฟล์ */
const TEST39 = String.raw`
// ===== v1.39 — แท็บ 5 ใหม่: ② ติ๊กปิดรายหัวข้อ (AI_NOTE ทันที ครบ→col-8 อัตโนมัติ) + ① ปิดประเด็นหลักกันหยุ่น =====
(function () {
  var res139 = { p: 0, f: 0 };
  globalThis.v139Res = res139;
  var myBase = null;
  var ok39 = function (name, cond, note) { if (cond) res139.p++; else { res139.f++; console.error('❌ v1.39: ' + name + (note !== undefined && note !== '' && note !== null ? ' :: ' + note : '')); } };
  var bail = function (m) { res139.f++; console.error('❌ v1.39: FATAL ' + m); };
  var restoreF = function () { try { if (myBase !== null) { w.fetch = myBase; myBase = null; } } catch (e) {} };
  function runV139() {
    try {
      var d = w.document, gat = w.GAT;
      var aiPosts = [], col8Posts = [], closeRecPosts = [], snapPacks, snapRecs;
      myBase = w.fetch;
      w.fetch = function (u, o) {
        try {
          var s = String(u || ''), b = (o && o.body) ? String(o.body) : '';
          if (b) {
            var bd = JSON.parse(b), act = bd.action || '', pay = bd.data || {};
            if (act === 'update_pack_status' && pay.FIELD === 'AI_NOTE') { aiPosts.push(pay); return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ ok: true }); } }); }
            if (act === 'update_pack_status') { col8Posts.push(pay); return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ ok: true }); } }); }
            if (act === 'close_issue') { closeRecPosts.push(pay); return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ ok: true }); } }); }
            return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ ok: true }); } });
          }
          var act2 = (s.match(/action=([a-z_]+)/) || [])[1] || '';
          if (!act2) return myBase(u, o); /* v1.39 fix: ไม่ใช่ GAS action → ผ่านไป base (gat-process.json ฯลฯ) กันทับ state */
          if (act2 === 'list_packs') return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ ok: true, data: snapPacks }); } });
          if (act2 === 'list_recs' || act2 === 'list_issues') return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ ok: true, data: snapRecs }); } });
          return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ ok: true, data: [] }); } });
        } catch (e) { return myBase(u, o); }
      };
      var st = gat.state();
      var preRecs = st.recs, prePacks = st.packs, preNotifs = gat._notifs(); /* v1.39 — restore หลังจบ */
      var nf = gat._notifs().filter(function (n) { return n.NOTIF_ID !== 'PLAN-2569-009'; });
      nf.push({ NOTIF_ID: 'PLAN-2569-009', BU: 'สอยดาว', PERIOD: 'พ.ย. 69', TITLE: 'ตรวจการขายน้ำมันเครื่อง', items: ['x'], sub: [], BY: 'GAT(แดง)', SAVED_AT: '10 พ.ย.' });
      gat._notifs(nf);
      st.recs = [
        { REC_ID: 'GAT-REC-9101', REC_NO: 101, SEVERITY: '🔴 ขัดกฎหมาย/จำเป็นจริง', TITLE: 'ตรวจการขายน้ำมันเครื่อง', STATUS: 'BU ตอบแล้ว', BU_DECISION: 'แก้ไข' },
        { REC_ID: 'GAT-REC-9102', REC_NO: 102, SEVERITY: '🟢 ข้อเสนอ', TITLE: 'เรื่องไม่มีแพ็ก', STATUS: 'รอ BU ดำเนินการ', BU_DECISION: '' }
      ];
      snapRecs = st.recs;
      st.packs = [{ PACK_ID: 'PACK-9101', BU: 'สอยดาว', SCOPE: 'แผน PLAN-2569-009', PERIOD: 'พ.ย. 69', TITLE: 'ตรวจการขายน้ำมันเครื่อง — ส่วน 1/1', STATUS: 'ผ่านการตรวจ — รอปิดประเด็น (ขั้น 5)', NOTE: 'อ้างแผน: PLAN-2569-009 · ส่งตามประเด็น (1/1)', LINKS: 'https://docs.bu.com/oil1', AI_NOTE: 'ผลตรวจขั้น 3: ผ่าน 2 รายการ', ITEM: '1. ตรวจรายการขายน้ำมันเครื่อง (1.1 เช็คใบเสร็จ | 1.2 เช็คสต๊อก)' }];
      snapPacks = st.packs;
      try { localStorage.removeItem('gat_item_close_PACK-9101'); } catch (e1) {}
      d.getElementById('closeBigBy').value = 'แดง (GAT)';
      d.getElementById('closeBigNote').value = 'ตรวจครบตามข้อเสนอแนะ';
      // --- seed/dropdown asserts ---
      gat._renderRecs();
      var cpEl = d.getElementById('closeRecPick');
      var opt101 = Array.from(cpEl.options).find(function (o) { return o.value === 'GAT-REC-9101'; });
      ok39('① dropdown โชว์ "ชื่อเรื่อง (REC_ID)" นำ', !!opt101 && opt101.textContent.indexOf('ตรวจการขายน้ำมันเครื่อง (GAT-REC-9101)') === 0, opt101 && opt101.textContent);
      gat.showTab('close');
      var cbSel = d.getElementById('closeBigPackPick');
      ok39('② dropdown โชว์ "ชื่อเรื่อง (PACK)"', Array.from(cbSel.options).some(function (o) { return o.textContent.indexOf('ตรวจการขายน้ำมันเครื่อง (PACK-9101)') === 0; }));
      ok39('② แผนที่ปิดยังว่าง', Object.keys(gat._closeItemStateGet('PACK-9101')).length === 0);
      cbSel.value = 'PACK-9101'; cbSel.dispatchEvent(new w.Event('change'));
      ok39('② ตารางหัวข้อ 2 แถว (โครง ITEM ขั้น 1)', d.getElementById('closeBigCheck').querySelectorAll('input.cl-item').length === 2, d.getElementById('closeBigCheck').textContent.slice(0, 140));
      ok39('② นับเริ่ม 0/2', d.getElementById('closeBigCheck').textContent.indexOf('0/2') >= 0);
      // --- ① กันหยุ่น (ยังไม่ติ๊กเลย) ---
      cpEl.value = 'GAT-REC-9101'; cpEl.dispatchEvent(new w.Event('change'));
      ok39('① ป้ายค้าง 2 ข้อ', d.getElementById('closeRecGate').textContent.indexOf('ค้าง 2 ข้อ') >= 0, d.getElementById('closeRecGate').textContent.slice(0, 110));
      d.getElementById('btnCloseRec').click();
      ok39('① ยังไม่ยิง close_issue (ประเด็นย่อยไม่ครบ)', closeRecPosts.length === 0, closeRecPosts.length);
      // --- ② ติ๊ก 1.1 ---
      var c1 = d.getElementById('closeBigCheck').querySelector('input[data-clk="PACK-9101|1.1"]');
      if (!c1) { restoreF(); bail('ไม่พบ checkbox 1.1'); return; }
      c1.checked = true; c1.dispatchEvent(new w.Event('change', { bubbles: true }));
      setTimeout(function () {
        try {
          var p1 = aiPosts.filter(function (p) { return p.PACK_ID === 'PACK-9101'; })[0];
          ok39('② ติ๊ก 1.1 → โพสต์ AI_NOTE 1 ครั้ง', aiPosts.length === 1, aiPosts.length);
          ok39('② โพสต์มี [ปิดข้อ 1.1] + คงเนื้อหา ผลตรวจขั้น 3', !!p1 && String(p1.NOTE || '').indexOf('[ปิดข้อ 1.1]') >= 0 && String(p1.NOTE || '').indexOf('ผลตรวจขั้น 3') >= 0, p1 && String(p1.NOTE).slice(0, 180));
          ok39('② แผนที่จำ 1.1', !!(gat._closeItemStateGet('PACK-9101')['1.1'] || {}).done);
          gat._renderCloseBig(); gat._renderRecs();
          ok39('② เหลือให้ติ๊ก 1 หัวข้อ + นับ 1/2', d.getElementById('closeBigCheck').querySelectorAll('input.cl-item').length === 1 && d.getElementById('closeBigCheck').textContent.indexOf('1/2') >= 0, d.getElementById('closeBigCheck').textContent.slice(0, 140));
          ok39('① ป้ายค้าง 1 ข้อ', d.getElementById('closeRecGate').textContent.indexOf('ค้าง 1 ข้อ') >= 0, d.getElementById('closeRecGate').textContent.slice(0, 110));
          var c2 = d.getElementById('closeBigCheck').querySelector('input[data-clk="PACK-9101|1.2"]');
          if (!c2) { restoreF(); bail('ไม่พบ checkbox 1.2'); return; }
          c2.checked = true; c2.dispatchEvent(new w.Event('change', { bubbles: true }));
          setTimeout(function () {
            try {
              ok39('② ติ๊ก 1.2 (ข้อสุดท้าย) → AI_NOTE รวม 2 โพสต์', aiPosts.length === 2, aiPosts.length);
              var p2x = aiPosts[1] || {};
              ok39('② โพสต์ล่าสุดรวม marker 1.1+1.2', String(p2x.NOTE || '').indexOf('[ปิดข้อ 1.1]') >= 0 && String(p2x.NOTE || '').indexOf('[ปิดข้อ 1.2]') >= 0);
              ok39('② ครบ → ปิดแพ็กอัตโนมัติ (col-8 โพสต์เดียว)', col8Posts.length === 1, col8Posts.length);
              var pc = col8Posts[0] || {};
              ok39('② col-8 = "ปิดประเด็นย่อยแล้ว (ขั้น 5) — ชื่อเรื่อง" นำ', String(pc.STATUS || '').indexOf('ปิดประเด็นย่อยแล้ว (ขั้น 5) — ตรวจการขายน้ำมันเครื่อง') === 0, String(pc.STATUS || '').slice(0, 140));
              ok39('② col-8 ไม่มี FIELD (เขาคอลัมน์ 8)', !pc.FIELD);
              ok39('② แผนที่ครบ 2 ข้อ (1.2.done)', Object.keys(gat._closeItemStateGet('PACK-9101')).length === 2 && !!(gat._closeItemStateGet('PACK-9101')['1.2'] || {}).done);
              // --- ① ปิดได้แล้ว ---
              gat._renderRecs();
              ok39('① ป้ายไม่บล็อกแล้ว', d.getElementById('closeRecGate').textContent.indexOf('ต้องปิดประเด็นย่อยให้ครบ') < 0, d.getElementById('closeRecGate').textContent.slice(0, 110));
              d.getElementById('btnCloseRec').click();
              setTimeout(function () {
                try {
                  ok39('① ยิง close_issue {REC_ID: GAT-REC-9101} 1 ครั้ง', closeRecPosts.length === 1 && String((closeRecPosts[0] || {}).REC_ID) === 'GAT-REC-9101', JSON.stringify(closeRecPosts));
                  // --- ① เรื่องที่ไม่มีแพ็กโยง → ปิดได้ ---
                  cpEl.value = 'GAT-REC-9102'; cpEl.dispatchEvent(new w.Event('change'));
                  d.getElementById('btnCloseRec').click();
                  setTimeout(function () {
                    try {
                      ok39('① เรื่องไม่มีแพ็ก → close_issue ครบ 2', closeRecPosts.length === 2 && String((closeRecPosts[1] || {}).REC_ID) === 'GAT-REC-9102', JSON.stringify(closeRecPosts));
                      // --- sync จากชีต (markers ใน AI_NOTE ของอีกเครื่อง) ---
                      try {
                        st.packs.push({ PACK_ID: 'PACK-9102', BU: 'สอยดาว', TITLE: 'เรื่องชีต', SCOPE: 'แผน PLAN-2569-009', NOTE: 'อ้างแผน: PLAN-2569-009', STATUS: 'ผ่านการตรวจ — รอปิดประเด็น (ขั้น 5)', LINKS: 'https://docs.bu.com/b1', AI_NOTE: '[ปิดข้อ 1] โดย คนชีต @ 10 พ.ย. — ผ่าน', ITEM: '' });
                        st.recs.push({ REC_ID: 'GAT-REC-9200', REC_NO: 200, TITLE: 'เรื่องชีต', STATUS: 'รอ BU ดำเนินการ', BU_DECISION: '' });
                      } catch (e2) { bail('seed ชีต-sync: ' + e2); }
                      gat._closeItemSyncFromSheet();
                      var m12 = gat._closeItemStateGet('PACK-9102');
                      ok39('sync: [ปิดข้อ 1] โดย คนชีต → แผนที่', (m12['1'] || {}).done === true && (m12['1'] || {}).by === 'คนชีต', JSON.stringify(m12));
                      ok39('packsOfRec: จับคู่ชื่อเรื่องได้ 1 แพ็ก', gat._packsOfRec({ REC_ID: 'GAT-REC-9200', TITLE: 'เรื่องชีต' }).length === 1, gat._packsOfRec({ REC_ID: 'GAT-REC-9200', TITLE: 'เรื่องชีต' }).length);
                      ok39('itemCloseOpenOfRec: ปิดทางชีตแล้ว → ค้าง 0', gat._itemCloseOpenOfRec('GAT-REC-9200').length === 0, gat._itemCloseOpenOfRec('GAT-REC-9200').length);
                      try { localStorage.removeItem('gat_item_close_PACK-9101'); } catch (e3) {}
                      try { localStorage.removeItem('gat_item_close_PACK-9102'); } catch (e3) {}
                      /* v1.39 — restore state เดิมกันพาดไปบล็อกเทสอื่น */
                      st.recs = preRecs; st.packs = prePacks; gat._notifs(preNotifs);
                      try { gat._renderRecs(); } catch (e3) {}
                      restoreF();
                      ok39('✅ ชุด v1.39 จบครบ', true);
                    } catch (e4) { restoreF(); bail('ขั้นสุดท้าย: ' + e4); }
                  }, 10);
                } catch (e4) { restoreF(); bail('close_issue 9101: ' + e4); }
              }, 10);
            } catch (e3) { restoreF(); bail('หลังติ๊ก 1.2: ' + e3); }
          }, 10);
        } catch (e2) { restoreF(); bail('หลังติ๊ก 1.1: ' + e2); }
      }, 12);
    } catch (eTop) { restoreF(); bail('รวม: ' + eTop); }
  }
  try { setTimeout(function () { try { runV139(); } catch (e) { try { restoreF(); } catch (e5) {} bail('run: ' + e); } }, 0); } catch (eSetup) { try { restoreF(); } catch (e5) {} bail('setup: ' + eSetup); }
})();
`;

patch('app.js', appPairs);
patch('index.html', htmlPairs);
patch('gat-config.js', cfgPairs);
patch('test-ui.js', testPairs);
fs.appendFileSync('test-ui.js', TEST39);
console.log('OK test-ui.js append v1.39 block');
