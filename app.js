/* ============================================================
 * GAT Work System — แอปหลัก (Dashboard + Registers + BCT)
 * โครงสร้าง: 7 แท็บ
 *  1) 📊 Dashboard   — ภาพรวม + KPI + overdue + ประเด็นร้อน
 *  2) 🗂 Registers   — Master Register (seed + BCT) กรองตาม BU/ประเภท
 *  3) 📥 BCT Import  — ดึงข้อมูลจาก Google Sheet BCT (GAS API) + เทียบ seed
 *  4) 🧾 ใบประเด็น   — Issue cards (ตาม SOP F-xx/IS-xx) + สถานะตอบกลับจาก BU
 *  5) 🔁 กระบวนการ   — PM/WI/SD/FM 5 ขั้น ต่อ BU + สถานะความครบ
 *  6) 📤 รายงาน      — สรุปผู้บริหาร (ตัวเลขจริง) + ส่งออก CSV/JSON กลับเข้า BCT
 * ============================================================ */

var GAT = (function () {
  var state = {
    seed: null,           // {companies, regulators, docTypes, universe}
    registers: [],        // รวม seed+ BCT
    entries: [],
    issues: [],
    recs: [],
    registersBCT: [], packs: [], packsLoaded: false,
    lastImport: null,
    filter: { bu: '', type: '', q: '' },
    page: 1
  };

  /* ---------- util ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function id(n) { return document.getElementById(n); }
  function csv(rows) {
    return rows.map(function (r) {
      return r.map(function (v) {
        v = String(v == null ? '' : v);
        return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
      }).join(',');
    }).join('\n');
  }
  function download(name, text, mime) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\ufeff' + text], { type: mime || 'text/csv;charset=utf-8' }));
    a.download = name; a.click();
  }
  function fmt(n) { return (n || 0).toLocaleString('th-TH'); }

  /* ---------- seed ---------- */
  function loadSeed() {
    return fetch(window.GAT_CONFIG.SOURCES.SEED + '?v=' + Date.now())
      .then(function (r) { if (!r.ok) throw new Error('โหลด seed ไม่ได้ ' + r.status); return r.json(); })
      .then(function (j) {
        state.seed = j;
        state.registers = seedToRegisters(j);
        // โหลดข้อเสนอแนะชุดแรก (F-01–F-15) ถ้ายังไม่มีข้อมูลจาก BCT
        return fetch(window.GAT_CONFIG.SOURCES.REC_SEED + '?v=' + Date.now())
          .then(function (r2) { return r2.ok ? r2.json() : null; })
          .then(function (jr) {
            if (jr && jr.recs && !state.recs.length) {
              state.recs = jr.recs;
              state.issues = state.recs;
            }
            renderAll();
          });
      });
  }
  /* แปลง seed xlsx → register rows (PM/WI/SD/FM ตามกลุ่มธุรกิจ) */
  function seedToRegisters(j) {
    var out = [];
    var ptypeOf = { 'รายเดือน': 'FM', 'รายปี': 'SD' }; // default mapping ตามพฤติกรรมกำกับ
    (j.universe || []).forEach(function (u) {
      (u.entities || []).forEach(function (en) {
        (en.requirements || []).forEach(function (q, k) {
          out.push({
            REG_ID: 'REG-' + u.bu + '-' + (en.entity || 'X') + '-' + (k + 1),
            BU: u.bu,
            PROCESS_TYPE: (q.frequency && ptypeOf[q.frequency]) ? ptypeOf[q.frequency] : 'PM',
            PROCESS_CODE: '',
            TITLE: (q.req || '') + (en.entity ? ' — ' + en.entity : ''),
            REGULATOR: q.regulator || '',
            LAW_RULE: q.law || '',
            REQUIREMENT: q.req || '',
            DOCUMENT: q.reports || '',
            DUE_DATE: '',
            FREQUENCY: q.frequency || '',
            OWNER: q.owner || '',
            COMPLIANCE_REVIEWER: q.resp || '',
            LEGAL: '',
            SIGNATORY: q.signatory || '',
            STATUS: '🟡 รอข้อมูลจริง',
            EVIDENCE: '',
            SOURCE: 'seed:Step2'
          });
        });
      });
    });
    (j.regulators || []).forEach(function (r) {
      out.push({
        REG_ID: 'REG-PMSG-' + r.no,
        BU: 'PMSG(กลาง)',
        PROCESS_TYPE: 'PM',
        PROCESS_CODE: '',
        TITLE: 'กำกับโดย ' + r.agency,
        REGULATOR: r.agency,
        LAW_RULE: r.domain,
        REQUIREMENT: (r.actions || []).map(function (a) { return a.action; }).join(' / ') || '',
        DOCUMENT: (r.docs || []).join(' / ') || '',
        DUE_DATE: '',
        FREQUENCY: (r.actions || []).map(function (a) { return a.frequency; }).filter(Boolean)[0] || '',
        OWNER: (r.owners || []).join(' / ') || '',
        COMPLIANCE_REVIEWER: '',
        LEGAL: '',
        SIGNATORY: '',
        STATUS: '🟡 รอข้อมูลจริง',
        EVIDENCE: '',
        SOURCE: 'seed:PMSG',
        AUDIT_POINT: (r.auditPoints || []).join(' | ')
      });
    });
    (j.companies || []).forEach(function (c) {
      out.push({
        REG_ID: 'REG-' + c.code,
        BU: c.group,
        PROCESS_TYPE: 'FM',
        PROCESS_CODE: '',
        TITLE: 'ภาษี/ยื่นรายการของ ' + c.name + ' [' + c.code + ']',
        REGULATOR: 'สรรพากร/DBD/ปปง. (ตามประเภท)',
        LAW_RULE: 'ประมวลรัษฎากร / บัญชี และกฎหมาย DBD',
        REQUIREMENT: (c.taxes || []).join(', ') || '(ยังไม่ระบุ — ชีท List TAX_BU ไม่มีเครื่องหมาย)',
        DOCUMENT: (c.taxes || []).join(', '),
        DUE_DATE: 'งบ ภ.ง.ด.50: ' + (c.cit50DueMonth || '?') + ' / รอบบัญชี ' + (c.accountingStart || '?') + '–' + (c.accountingEnd || '?'),
        FREQUENCY: 'รายเดือน (WHT/ภ.พ.30) + รายปี',
        OWNER: c.owner || '',
        COMPLIANCE_REVIEWER: c.auditor || '',
        LEGAL: '',
        SIGNATORY: 'กรรมการ',
        STATUS: (c.taxes && c.taxes.length) ? '🟢 ปกติ' : '🔴 ยังไม่มีข้อมูล TG',
        EVIDENCE: '',
        SOURCE: 'seed:ListTAX_BU'
      });
    });
    (j.docTypes || []).forEach(function (d) {
      out.push({
        REG_ID: 'REG-DOC-' + d.no,
        BU: 'PKG(กลาง)',
        PROCESS_TYPE: 'SD',
        PROCESS_CODE: '',
        TITLE: 'ประเภทเอกสาร ' + d.no + ': ' + d.type,
        REGULATOR: 'ตามประเภทเอกสาร',
        LAW_RULE: 'No Review → No Sign (การตรวจสอบเอกสาร xlsx)',
        REQUIREMENT: 'จัดทำ→ตรวจ→อนุมัติ→ลงนาม→ส่ง',
        DOCUMENT: d.type,
        DUE_DATE: '',
        FREQUENCY: d.mode || '',
        OWNER: d.preparer || '',
        COMPLIANCE_REVIEWER: d.reviewer || '',
        LEGAL: '',
        SIGNATORY: d.signer || '',
        STATUS: '🟢 ปกติ',
        EVIDENCE: '',
        SOURCE: 'seed:ประเภทเอกสาร'
      });
    });
    // WI-01..09: กระบวนการนำส่ง 9 ขั้น (ชีท "การตรวจสอบเอกสาร" — Regulatory Submission Control)
    var steps9 = ['Regulatory Requirement Identified', 'BU Prepare', 'BU Review', 'Compliance Check', 'Legal Consult', 'Authorized Director / Committee Approve & Sign', 'Submit', 'Evidence Archive', 'Compliance Dashboard'];
    steps9.forEach(function (s, i) {
      out.push({
        REG_ID: 'REG-WI-9STEP-' + (i + 1),
        BU: 'PKG(กลาง)',
        PROCESS_TYPE: 'WI',
        PROCESS_CODE: 'WI-0' + (i + 1),
        TITLE: 'ขั้นที่ ' + (i + 1) + ': ' + s,
        REGULATOR: '(ภายใน)',
        LAW_RULE: 'Regulatory Submission Control — ประกาศ PKG (16 ก.ย. 69)',
        REQUIREMENT: 'เอกสารทุกชนิดที่ส่งหน่วยงานราชการต้องผ่านขั้น 1–' + (i + 1) + ' ก่อนเสมอ',
        DOCUMENT: '-',
        DUE_DATE: '',
        FREQUENCY: 'ทุกครั้งที่มีการนำส่ง',
        OWNER: (i === 0 ? 'Compliance' : (i === 1 || i === 2) ? 'BU/ADM BU' : (i === 3) ? 'Compliance' : (i === 4) ? 'Legal' : (i === 5) ? 'กรรมการ/ผู้มีอำนาจ' : (i === 6) ? 'BU/ผู้ได้รับมอบหมาย' : (i === 7) ? 'Compliance' : 'GAT/OAC'),
        COMPLIANCE_REVIEWER: 'Compliance',
        LEGAL: (i === 4 ? 'Legal (มีประเด็นกฎหมาย)' : ''),
        SIGNATORY: (i === 5 ? 'ผู้มีอำนาจตาม DOA' : ''),
        STATUS: '🟢 ปกติ',
        EVIDENCE: '',
        SOURCE: 'seed:การตรวจสอบเอกสาร(9 ขั้น)'
      });
    });
    // PM-FV1..7: การฝ่าฝืนร้ายแรง 7 ข้อ (ชีท "การฝ่าฝืน")
    var fv7 = [
      ['นำส่งเอกสารโดยไม่ผ่านการตรวจสอบและอนุมัติ', 'ขั้น 3–5/7 ถูกข้าม'],
      ['นำส่งเอกสารโดยไม่มีผู้มีอำนาจลงนาม', 'ขั้น 6 ลงนามไม่ครบตาม DOA'],
      ['ให้ข้อมูลอันเป็นเท็จหรือทำให้เข้าใจผิด', 'ขั้น 2–4 ตรวจสอบความถูกต้อง'],
      ['ปกปิด Compliance Breach', 'ไม่รายงาน Incident (ขั้น 1/9)'],
      ['ทำลาย/ปกปิดหลักฐาน', 'ขั้น 8 Evidence Archive'],
      ['ไม่ดำเนินการแก้ไขตาม Corrective Action', 'ติดตามหลัง Dashboard/ประเด็น'],
      ['สร้างความเสี่ยงร้ายแรงต่อใบอนุญาต/ชื่อเสียง/การเงิน', 'รายงาน OAC ทันที']
    ];
    fv7.forEach(function (f, i) {
      out.push({
        REG_ID: 'REG-FV-' + (i + 1),
        BU: 'PKG(กลาง)',
        PROCESS_TYPE: 'PM',
        PROCESS_CODE: 'PM-FV' + (i + 1),
        TITLE: 'ห้ามฝ่าฝืนร้ายแรง ' + (i + 1) + '/7: ' + f[0],
        REGULATOR: '(ภายใน)',
        LAW_RULE: 'การฝ่าฝืนระเบียบระดับร้ายแรง (xlsx การฝ่าฝืน 2.' + (i + 1) + ')',
        REQUIREMENT: f[0] + ' — จุดควบคุม: ' + f[1],
        DOCUMENT: 'หลักฐานกระบวนการ 9 ขั้น',
        DUE_DATE: '',
        FREQUENCY: 'ตรวจทุกครั้งที่มีเหตุ',
        OWNER: 'BU Owner',
        COMPLIANCE_REVIEWER: 'Compliance',
        LEGAL: 'Legal',
        SIGNATORY: 'ผู้มีอำนาจ',
        STATUS: '🟢 ปกติ',
        EVIDENCE: '',
        SOURCE: 'seed:การฝ่าฝืน(7 ข้อ)'
      });
    });
    return out;
  }

  /* ---------- BCT ---------- */
  function apiURL() {
    var u = (id('bctApiUrl') && id('bctApiUrl').value || '').trim();
    if (u) { window.GAT_CONFIG.BCT_API = u; localStorage.setItem('gat_bct_api', u); }
    return window.GAT_CONFIG.BCT_API;
  }
  function gasGet(action) {
    var base = apiURL();
    if (!base) { alert('ใส่ Web app URL ของ GAS (จาก Google Sheet BCT) ก่อน — ดูคู่มือในแท็บ BCT Import'); return Promise.reject('no url'); }
    return fetch(base + '?action=' + action).then(function (r) { return r.json(); });
  }
  function importBCT() {
    status('กำลังดึงข้อมูลจาก BCT…');
    Promise.all([gasGet('list_registers'), gasGet('list_entries'), gasGet('list_recs').catch(function(){return gasGet('list_issues');}), gasGet('list_packs').catch(function(){return {ok:false};})])
      .then(function (res) {
        state.registersBCT = (res[0].ok ? res[0].data : []);
        state.entries = (res[1].ok ? res[1].data : []);
        state.packs = (res[3] && res[3].ok ? res[3].data : state.packs || []);
        try { renderPacks(); fillPackSelectors(); renderAiCandidates(); } catch (e) {}
        state.recs = (res[2].ok ? res[2].data : []);
        state.issues = state.recs;
        state.registers = seedToRegisters(state.seed)
          .filter(function (r) {
            // ถ้ามี register จาก BCT ทับ seed รหัสเดียวกัน ให้ใช้ BCT
            return !state.registersBCT.some(function (b) { return b.REG_ID === r.REG_ID; });
          }).concat(state.registersBCT.map(function (b) {
            b.SOURCE = 'BCT'; return b;
          }));
        state.lastImport = new Date();
        status('✅ นำเข้าจาก BCT แล้ว — Registers ' + state.registersBCT.length + ' / Entries ' + state.entries.length + ' / ข้อเสนอแนะ ' + state.recs.length);
        renderAll();
      })
      .catch(function (e) { status('❌ ผิดพลาด: ' + e); });
  }

  /* ---------- GAT issue (โครงตาม SOP) ---------- */
  function draftIssue(i, sev) {
    var r = state.registers[i];
    if (!r) return;
    var text = [
      'ใบประเด็น (โครงตาม gat-workflow-sop.md)',
      'ป้าย: ' + sev,
      '', 'ชี้จุด: ' + r.TITLE,
      'ขอบเขต: BU=' + r.BU + ' / Regulator=' + (r.REGULATOR || '-') + ' / ความถี่=' + (r.FREQUENCY || '-'),
      'อ้างอิง: ' + r.REG_ID + ' (SOURCE: ' + (r.SOURCE || '-') + ')',
      '', 'กฎเหล็ก: ข้อค้นพบอ้างชีท+แถวไฟล์ต้นฉบับ — ห้ามเดา; ไม่พบในไฟล์ให้เขียน "ไม่พบในไฟล์"',
      '', 'คำถาม BU 3 ข้อ:',
      '1) ข้อเท็จจริงเป็นอย่างไร (เอกสาร/หลักฐานประกอบ)',
      '2) จะแก้หรือไม่แก้ — พร้อมวันที่/เหตุผล',
      '3) ใครเป็นผู้รับผิดชอบลงมือ'
    ].join('\n');
    download('gat-issue-' + r.REG_ID + '.txt', text, 'text/plain;charset=utf-8');
    status('คัดลอกโครงใบประเด็นแล้ว (ดาวน์โหลด .txt) — นำไปวางบนชีท Issues ของ BCT');
  }

  /* ---------- renders ---------- */
  function status(msg) { id('statusBar').innerHTML = '<span class="ok">' + esc(msg) + '</span>'; }
  function renderAll() {
    renderDash(); renderRegisters(); renderUniverse(); renderRecs(); renderSummary(); renderBctStatus(); loadProcess(); renderRunner();
    try { renderPacks(); fillPackSelectors(); } catch (e) {}
  }
  function copyText(t, msg) {
    var ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); status(msg || ('📋 คัดลอกแล้ว: ' + t)); } catch (e) { status('คัดลอกไม่ได้: ' + t); }
    document.body.removeChild(ta);
  }

  /* ---------- แท็บกระบวนการทีม GAT (PM/WI/SD/FM ของทีมเอง) ---------- */
  function loadProcess() {
    var box = id('procBody'); if (!box) return;
    fetch(window.GAT_CONFIG.SOURCES.PROCESS_SEED + '?v=' + Date.now())
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j) { box.innerHTML = '<div class="empty">โหลด gat-process.json ไม่ได้</div>'; return; }
        state.process = j; // เก็บใน state — ใช้นับจำนวน PM/WI/SD/FM ในหน้าสรุป
        var h = [];
        h.push('<div class="hero"><div class="goldlbl">ระบบเอกสาร 4 ประเภท · PM / WI / SD / FM</div><h2>⚙ ' + esc(j.meta.title) + ' — ' + esc(String(j.meta.version).split('—')[0]) + '</h2><p>' + esc(j.meta.owner) + ' · PM=ภาพการไหลของงาน · WI=คำสั่งติดตำแหน่ง · SD=เอกสารสนับสนุน · FM=แบบฟอร์มบันทึกผล — ผูกกฎบัตร GAT v1.4 — SLA 3/5/7 วัน · อุทธรณ์ OAC · สถานะ 5 ระดับ 🟢🟡🟠🔴⚫ · เอกสารฉบับเต็ม: GAT-QMS-001 v1.0</p></div>');
        // แผนภาพ: ความสัมพันธ์ของเอกสารข้อกำหนด (ลำดับชั้นเอกสารแบบ ISO) — ตามภาพจริงที่พี่หนึ่งส่ง (หน้าขาว + การ์ดเทาอ่อน)
        if (j.meta.hierarchy && j.meta.hierarchy.length) {
          var H = j.meta.hierarchy;
          var arrow = '<div style="text-align:center;font-size:20px;color:#94a3b8;line-height:1;margin:6px 0">↓</div>';
          function hBox(x) {
            var dark = x.output;
            return '<div style="border-radius:12px;padding:14px 18px;background:' + x.color + ';color:' + x.text + (dark ? ';box-shadow:0 4px 14px rgba(29,53,87,.35)' : '') + '">' +
              '<div style="font-weight:700;font-size:' + (dark ? '16px' : '17px') + ';letter-spacing:.02em">' + esc(x.title) + '</div>' +
              '<div style="font-size:13.5px;margin-top:4px;opacity:' + (dark ? '.92' : '.85') + '">' + esc(x.sub) + '</div></div>';
          }
          var pair = H.filter(function (x) { return x.half; });
          var flow = '';
          H.forEach(function (x, i) {
            if (x.half) return; // จับคู่ SD+FM แยก
            if (x.half !== true && !x.output && i > 0 && !H[i - 1].half) flow += arrow;
            flow += hBox(x);
            if (pair.length && i === 1) { // หลัง WI: แถวคู่ SD | FM
              flow += arrow;
              flow += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' + pair.map(hBox).join('') + '</div>';
              flow += arrow;
            }
          });
          h.push('<div class="card" style="background:#f0f2f4;border:1px solid #e2e6ea;margin-bottom:16px"><h3 style="color:#1d2939">🧭 ' + esc(j.meta.hierarchy_title || 'ความสัมพันธ์ของเอกสารข้อกำหนด') + '</h3>' + flow + '</div>');
        }
        h.push('<div class="card"><h3>👥 ทีม GAT</h3><table class="tbl"><tr><th>สมาชิก</th><th>ด้านที่รับผิดชอบ</th><th>หมายเหตุ</th></tr>');
        (j.TEAM || []).forEach(function (t) { h.push('<tr><td><b>' + t.who + '</b></td><td>' + t.side + '</td><td>' + (t.note || '') + '</td></tr>'); });
        h.push('</table></div>');
        ['PM', 'WI', 'SD', 'FM'].forEach(function (k) {
          if (k === 'SD' && j.meta.SD_GROUPS && j.meta.SD_GROUPS.length) return; // SD แสดงในการ์ดมาตรฐานแยกด้านล่าง (กลุ่ม + register ครบ 5 ฟิลด์)
          var p = j[k]; if (!p) return;
          h.push('<div class="card"><h3>' + p.code + ' — ' + p.name + ' (' + p.items.length + ' หัวข้อ)</h3><table class="tbl">');
          h.push('<tr><th style="width:90px">รหัส</th><th>หัวข้อ</th><th>เนื้อหา</th></tr>');
          p.items.forEach(function (it) {
            h.push('<tr><td><b>' + it.id + '</b></td><td>' + it.title + '</td><td style="font-size:13px">' + it.detail + '</td></tr>');
          });
          h.push('</table></div>');
        });
        if (j.meta.PM_TEMPLATE && j.meta.PM_TEMPLATE.length) { // แม่แบบ PM 18 หัวข้อ (มาตรฐานกลาง)
          var T = j.meta.PM_TEMPLATE;
          h.push('<div class="card"><h3>📐 แม่แบบ PM — เอกสารกระบวนการ 18 หัวข้อ (มาตรฐานกลาง ใช้เขียน PM ของทุกกระบวนการ)</h3><table class="tbl"><tr><th style="width:48px">ลำดับ</th><th style="width:210px">หัวข้อ</th><th>รายละเอียด</th></tr>');
          T.forEach(function (tt) { h.push('<tr><td><b>' + tt.no + '</b></td><td><b>' + esc(tt.topic) + '</b></td><td>' + esc(tt.desc) + '</td></tr>'); });
          h.push('</table><div class="note">PM = เอกสารหลักที่อธิบายว่ากระบวนการหนึ่ง ๆ ทำงานอย่างไร ตั้งแต่เริ่มต้นจนสิ้นสุด (ระดับกระบวนการ) — ลงรายการเขียนจริง: PM ของ P-01..P-10 ตามแม่แบบนี้</div></div>');
        }
        if (j.meta.WI_TEMPLATE && j.meta.WI_TEMPLATE.length) { // แม่แบบ WI 15 หัวข้อ (มาตรฐานกลาง — WI แตกจาก PM)
          var WT = j.meta.WI_TEMPLATE;
          h.push('<div class="card"><h3>📏 แม่แบบ WI — คำสั่งปฏิบัติ 15 หัวข้อ (WI ต้องแตกจากขั้นตอนของ PM ไม่เขียนแยก)</h3><table class="tbl"><tr><th style="width:48px">ลำดับ</th><th style="width:260px">หัวข้อ</th><th>รายละเอียด</th></tr>');
          WT.forEach(function (tw) { h.push('<tr><td><b>' + tw.no + '</b></td><td><b>' + esc(tw.topic) + '</b></td><td>' + esc(tw.desc) + '</td></tr>'); });
          h.push('</table><div class="note">กฎหลัก: <b>WI ต้องแตกออกมาจากแต่ละขั้นตอนของ PM (หัวข้อ 9 Process Flow)</b> — 1 ขั้นตอน = 1+ WI อ้างกลับ Reference PM ทุกใบ<br>หลักเกณฑ์: <b>ผู้ปฏิบัติงานต้องอ่านแล้วทำตามได้จริง</b> — ใคร ทำอะไร ทำอย่างไร ใช้ข้อมูลใด ตรวจสอบอะไร เมื่อใดจึงถือว่าเสร็จ</div></div>');
        }
        if (j.meta.SD_GROUPS && j.meta.SD_GROUPS.length) { // มาตรฐาน SD 6 กลุ่ม + ข้อมูลบังคับ 4 ช่อง
          h.push('<div class="card"><h3>📚 มาตรฐาน SD — Supporting Document 6 กลุ่ม + ข้อมูลบังคับ 4 ช่อง</h3><div style="font-size:13.5px;margin-bottom:8px">' + esc(j.meta.SD_DEFINITION || '') + ' — ทุกรายการต้องมี: <b>' + (j.meta.SD_FIELDS || []).map(esc).join(' · ') + '</b></div><table class="tbl"><tr><th style="width:130px">ประเภท</th><th>ตัวอย่าง</th></tr>');
          j.meta.SD_GROUPS.forEach(function (sg) { h.push('<tr><td><b>' + esc(sg.type) + '</b></td><td>' + esc(sg.ex) + '</td></tr>'); });
          h.push('</table></div>');
          // SD register เรียงตามกลุ่ม — ใส่ 5 ฟิลด์บังคับ ต่อรายการ
          var SDD = j.SD || {};
          if (SDD.items) {
            var gOrder = {}; (j.meta.SD_GROUPS || []).forEach(function (g, ix) { gOrder[g.type] = ix; });
            var sdSorted = SDD.items.slice().sort(function (a, b) { return (gOrder[a.group] ?? 99) - (gOrder[b.group] ?? 99); });
            h.push('<div class="card"><h3>' + SDD.code + ' — ' + SDD.name + ' (จัดตามกลุ่มมาตรฐาน)</h3><table class="tbl"><tr><th style="width:74px">รหัส</th><th style="width:110px">กลุ่ม</th><th>หัวข้อ</th><th style="width:140px">เจ้าของ</th><th style="width:170px">แหล่งที่มา</th><th style="width:120px">บังคับใช้</th><th style="width:170px">สถานะทบทวน</th></tr>');
            sdSorted.forEach(function (it) {
              h.push('<tr><td><b>' + esc(it.id) + '</b></td><td>' + esc(it.group || '—') + '</td><td>' + it.title + '</td><td style="font-size:12.5px">' + esc(it.owner || '—') + '</td><td style="font-size:12.5px">' + esc(it.source || '—') + '</td><td style="font-size:12.5px">' + esc(it.effective || '—') + '</td><td style="font-size:12.5px">' + esc(it.review || '—') + '</td></tr>');
            });
            h.push('</table>' + (SDD.meta_note ? '<div class="note">' + esc(SDD.meta_note) + '</div>' : '') + '</div>');
          }
        }
        if (j.meta.FM_FIELDS && j.meta.FM_FIELDS.length) { // มาตรฐาน FM 11 ช่อง (เช็คครอบคลุมทีละช่อง)
          h.push('<div class="card"><h3>🧾 มาตรฐาน FM — แบบฟอร์มบันทึกผล 11 ช่อง (เช็คครอบคลุมของฟอร์มจริงทีละช่อง)</h3><div style="font-size:13.5px;margin-bottom:8px">' + esc(j.meta.FM_DEFINITION || '') + '</div><table class="tbl"><tr><th>ข้อมูลมาตรฐาน</th><th style="width:56%">ครอบคลุมแล้วที่ไหน</th><th style="width:44px">✓</th></tr>');
          j.meta.FM_FIELDS.forEach(function (ff) {
            h.push('<tr><td><b>' + esc(ff.field) + '</b></td><td style="font-size:12.5px">' + esc(ff.where) + '</td><td style="text-align:center">' + (ff.ok ? '✅' : '🟡') + '</td></tr>');
          });
          h.push('</table><div class="note">หลักการ: <b>' + esc(j.meta.FM_PRINCIPLE || '') + '</b> — ฟอร์มที่มีอยู่: FM-01 ครอบคลุม 9/11 (🟡 เพิ่มคอลัมน์ REF_PM_WI + ผู้อนุมัติ) · FM-02 ครบ 11/11 · FM-03 ครบ (สร้างจากข้อมูลสด) · FM-04 บอร์ดสถานะ · FM-05 กำลังจะมี (ออกแบบครบ 11 ช่อง)</div></div>');
        }
        if (j.ROLES && j.ROLES.length) { // หลักการแบ่งหน้าที่ 7 หน่วยงาน (กำหนดโดยพี่หนึ่ง)
          h.push('<div class="card"><h3>🏛 หลักการแบ่งหน้าที่ — 7 หน่วยงาน</h3><table class="tbl"><tr><th style="width:170px">หน่วยงาน</th><th>ความรับผิดชอบ</th></tr>');
          j.ROLES.forEach(function (rr) { h.push('<tr><td><b>' + esc(rr.role) + '</b></td><td>' + esc(rr.scope) + '</td></tr>'); });
          h.push('</table><div class="note">ข้อสำคัญ: <b>GAT กำหนดมาตรฐานและให้ข้อเสนอแนะได้ แต่เจ้าของกระบวนการ (Process Owner) ต้องเป็นผู้จัดทำและรับผิดชอบการปฏิบัติงานจริง</b></div></div>');
        }
        if (j.CORE && j.CORE.length) { // กระบวนการที่จำเป็น 10 (P-01..P-10) — GAT-PROCESS-SET.md
          var slaMap = {};
          j.CORE.forEach(function (c) { if (c.sla) slaMap[c.id] = c.sla; });
          h.push('<div class="card"><h3>🧩 กระบวนการที่จำเป็น 10 — CORE (P-01..P-10 · ฉบับเต็ม GAT-PROCESS-SET.md)</h3><table class="tbl"><tr><th style="width:56px">รหัส</th><th>กระบวนการ</th><th>PM — ภาพการไหล (อะไร/ใคร/เมื่อไร)</th><th>WI — จุดติดตำแหน่ง</th><th>FM ที่บันทึก</th><th>Evidence / KPI</th></tr>');
          j.CORE.forEach(function (c) {
            h.push('<tr><td><b>' + esc(c.id) + '</b></td><td><b>' + esc(c.name) + '</b>' + (c.sla ? '<div style="font-size:12px;color:#b48a3c">' + esc(c.sla) + '</div>' : '') + '</td><td style="font-size:13px">' + esc(c.pm) + '</td><td style="font-size:13px">' + ((c.wi || []).length ? c.wi.map(esc).join('<br>') : '—') + '</td><td style="font-size:13px">' + (c.fm || []).map(esc).join('<br>') + '</td><td style="font-size:13px">' + esc(c.output) + '</td></tr>');
          });
          h.push('</table><div class="note">SLA รวม: ข้อมูล 3ว (ด่วน LCT 24ชม.) · ชี้แจง 5ว · อุทธรณ์ 7ว · รายงานก่อนวันที่ 5 · ถดถอย 30/60/90ว — ทุกกระบวนการมี Evidence บน GAT_AuditLog</div></div>');
        }
        if (j.meta.PM_DOCS && j.meta.PM_DOCS.length) { // เอกสาร PM ฉบับเต็ม 10 ชุด × 18 หัวข้อ (จาก add-docs)
          h.push('<div id="pmdocs" class="card"><h3>📋 เอกสาร PM ฉบับเต็ม (10 กระบวนการ × 18 หัวข้อจากแม่แบบ)</h3><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin-bottom:10px">' +
            j.meta.PM_DOCS.map(function (p, i) { return '<button class="rb-act" data-pmdoc="' + i + '" style="padding:8px 10px">' + esc(p.id) + ' ' + esc(p.name) + '</button>'; }).join('') + '</div><div id="pmdocBox"></div></div>');
        }
        if (j.meta.WI_DOCS && j.meta.WI_DOCS.length) { // WI ฉบับเต็ม 7 ใบ × 15 หัวข้อ
          h.push('<div id="widocs" class="card"><h3>📎 เอกสาร WI ฉบับเต็ม (7 ใบ × 15 หัวข้อจากแม่แบบ — แตกจากขั้นของ PM ตาม WI_RULE)</h3><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin-bottom:10px">' +
            j.meta.WI_DOCS.map(function (p, i) { return '<button class="rb-act" data-widoc="' + i + '" style="padding:8px 10px">' + esc(p.code) + ' ' + esc(p.name) + '</button>'; }).join('') + '</div><div id="widocBox"></div></div>');
        }
        box.innerHTML = h.join('');
        bindDocButtons(j);
      })
      .catch(function () { box.innerHTML = '<div class="empty">โหลดกระบวนการล้มเหลว</div>'; });
  }
  function renderPmDoc(j, i) {
    var p = j.meta.PM_DOCS[i]; if (!p) return;
    var rows = [['Process Code', p.id], ['Process Name', p.name], ['Objective', p.objective], ['Scope', p.scope], ['Process Owner', p.owner], ['Related Parties', p.related], ['Input', p.input], ['Trigger', p.trigger],
      ['Process Flow', (p.flow || []).map(function (s) { return '· ' + s; }).join('<br>')], ['Responsibility', p.responsibility], ['Decision Point', p.decision], ['Output', p.output], ['SLA', p.sla], ['KPI', p.kpi], ['Risk', p.risk], ['Control', p.control], ['Related Documents', (p.docs || []).join(', ')], ['Records & Evidence', (p.records || []).join(', ')]];
    var t = '<table class="tbl">' + rows.map(function (r, ix) { return '<tr><th style="width:160px;text-align:left">' + (ix + 1) + '. ' + esc(r[0]) + '</th><td style="font-size:13.5px">' + r[1] + '</td></tr>'; }).join('') + '</table>';
    var b = id('pmdocBox'); if (b) b.innerHTML = '<div style="border:1px solid #dbe2ea;border-radius:10px;padding:12px;margin-top:6px"><b>' + esc(p.id) + ' — ' + esc(p.name) + '</b> <span style="font-size:12px;color:#8b4a12">18/18 หัวข้อ</span>' + t + '</div>';
  }
  function renderWiDoc(j, i) {
    var p = j.meta.WI_DOCS[i]; if (!p) return;
    var rows = [['WI Code', p.code], ['WI Name', p.name], ['Reference PM', p.ref_pm], ['Objective', p.objective], ['Scope', p.scope], ['Responsible Person', p.responsible], ['Preconditions', p.pre], ['Required Information / Tools', p.tools],
      ['Step-by-Step Instructions', (p.steps || []).map(function (s) { return '· ' + s; }).join('<br>')], ['Quality Control Point', p.qc], ['Approval Requirements', p.approval], ['Exception Handling', p.exception], ['Error Correction', p.error], ['Evidence / Records', p.evidence], ['Completion Criteria', p.completion]];
    var t = '<table class="tbl">' + rows.map(function (r, ix) { return '<tr><th style="width:180px;text-align:left">' + (ix + 1) + '. ' + esc(r[0]) + '</th><td style="font-size:13.5px">' + r[1] + '</td></tr>'; }).join('') + '</table>';
    var b = id('widocBox'); if (b) b.innerHTML = '<div style="border:1px solid #dbe2ea;border-radius:10px;padding:12px;margin-top:6px"><b>' + esc(p.code) + ' — ' + esc(p.name) + '</b> <span style="font-size:12px;color:#8b4a12">15/15 หัวข้อ</span><div style="font-size:12.5px;color:#7c6a3c">PM ต้นทาง: ' + esc(p.ref_pm) + '</div>' + t + '</div>';
  }
  function bindDocButtons(j) {
    document.querySelectorAll('[data-pmdoc]').forEach(function (btn) {
      btn.addEventListener('click', function () { renderPmDoc(j, parseInt(btn.getAttribute('data-pmdoc'), 10)); });
    });
    document.querySelectorAll('[data-widoc]').forEach(function (btn) {
      btn.addEventListener('click', function () { renderWiDoc(j, parseInt(btn.getAttribute('data-widoc'), 10)); });
    });
  }

  /* ---------- Packs (BU ส่งข้อมูล) + AI Review — v1.8 ตามวงจร 10 ขั้นของพี่หนึ่ง 4 พ.ย. 69 ---------- */
  function escP(t){return String(t||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function renderPacks() {
    var tb = document.querySelector('#packTable tbody'); if (!tb) return;
    var packs = state.packs || [];
    if (!packs.length) { tb.innerHTML = '<tr><td colspan="7" class="empty">ยังไม่มีการส่งข้อมูล — BU กรอกฟอร์มด้านบน</td></tr>'; return; }
    tb.innerHTML = packs.map(function (x) {
      var st = String(x.STATUS || 'รอ GAT เลือกตรวจ');
      var links = String(x.LINKS || '').split('\n').filter(Boolean);
      var linkHtml = links.length ? links.map(function (l, i) { return '<a href="' + escP(l.trim()) + '" target="_blank" rel="noopener">ลิงก์' + (i + 1) + '</a>'; }).join(' · ') : '—';
      return '<tr><td class="mono"><b>' + escP(x.PACK_ID || '') + '</b></td>' +
        '<td>' + escP(x.BU || '') + '</td>' +
        '<td>' + escP(x.SCOPE || '') + '</td>' +
        '<td>' + escP(x.TITLE || '') + '</td>' +
        '<td>' + linkHtml + '</td>' +
        '<td>' + escP(st) + '</td>' +
        '<td class="mono">' + escP(x.CREATED_AT || '') + '</td></tr>';
    }).join('');
  }
  function loadPacks() {
    var st = document.getElementById('packStatus'); if (st) st.textContent = 'กำลังดึงสถานะจากชีต…';
    gasGet('list_packs').then(function (res) {
      if (res.ok) { state.packs = res.data; renderPacks(); fillPackSelectors(); if (st) st.textContent = '✅ โหลด ' + res.data.length + ' รายการจากชีตจริง'; }
      else if (st) st.textContent = '❌ GAS ยังไม่รองรับ list_packs — ต้อง deploy โค้ด v1.5 (ส่งให้พี่หนึ่งแล้ว)';
    }).catch(function (e) { if (st) st.textContent = '❌ ' + e; });
  }
  function sendPack() {
    var st = document.getElementById('packStatus');
    var bu = document.getElementById('packBu').value;
    var scope = document.getElementById('packScope').value;
    var title = document.getElementById('packTitle').value.trim();
    var links = document.getElementById('packLinks').value.trim();
    var note = document.getElementById('packNote').value.trim();
    var by = document.getElementById('packBy').value.trim() || 'BU';
    if (!bu) { if (st) st.textContent = '⚠️ เลือก BU ก่อน'; return; }
    if (!title) { if (st) st.textContent = '⚠️ กรอกหัวเรื่องการส่งก่อน'; return; }
    if (!links) { if (st) st.textContent = '⚠️ ต้องแนบลิงก์หลักฐานอย่างน้อย 1 ลิงก์ (Drive/ชีต/ภาพ)'; return; }
    if (st) st.textContent = 'กำลังส่ง…';
    postToBCT('submit_pack', { BU: bu, SCOPE: scope, PERIOD: document.getElementById('packPeriod').value.trim(), TITLE: title, LINKS: links, NOTE: note, BY: by }, function (res) {
      if (res.ok) {
        if (st) st.textContent = '✅ รันเลขสำเร็จ: ' + res.PACK_ID + ' — บันทึกชีต + AuditLog แล้ว — รอ GAT เลือกตรวจ';
        document.getElementById('packTitle').value = ''; document.getElementById('packLinks').value = ''; document.getElementById('packNote').value = '';
        loadPacks();
      } else if (st) st.textContent = '❌ ' + (res.error || 'ส่งไม่สำเร็จ — ตรวจว่า GAS เป็น v1.5');
    });
  }
  function fillPackSelectors() {
    var sel = document.getElementById('packBu');
    if (sel && !sel.options.length > 1) {
      var bus = (state.seed && state.seed.companies || []).map(function (c) { return c.BU || c.name || c; }).filter(Boolean);
      (bus.length ? bus : ['AAMG', 'PMSG', 'CPDG', 'LDC', 'TNR']).forEach(function (b) {
        var o = document.createElement('option'); o.value = b; o.textContent = b; sel.appendChild(o);
      });
    }
    var scopes = ['ระเบียบการเงิน PKG 2567 — เงินสดย่อย/นำฝาก', 'ระเบียบการเงิน PKG 2567 — ตัดชำระโอน/QR', 'ระเบียบการเงิน PKG 2567 — สำรองจ่าย/เอกสาร 3', 'สวัสดิการพนักงาน (ลา/ทำหมัน/IPD)', 'เอกสารกระบวนการ PM/WI/SD/FM', 'อื่น ๆ (ระบุในหัวเรื่อง)'];
    var sel2 = document.getElementById('packScope');
    if (sel2 && sel2.options.length <= 1) scopes.forEach(function (sc) { var o = document.createElement('option'); o.value = sc; o.textContent = sc; sel2.appendChild(o); });
    var sel3 = document.getElementById('aiPackPick');
    if (sel3) {
      var cur = sel3.value;
      sel3.innerHTML = '<option value="">— เลือก Pack ที่ BU ส่ง —</option>' + (state.packs || []).filter(function (x) { return String(x.STATUS || '').indexOf('ตรวจแล้ว') < 0; }).map(function (x) {
        return '<option value="' + escP(x.PACK_ID) + '">' + escP(x.PACK_ID + ' · ' + x.BU + ' · ' + String(x.TITLE || '').slice(0, 48)) + '</option>';
      }).join('');
      if (cur) sel3.value = cur;
    }
  }
  /* ---------- AI Review ---------- */
  function aiBuildPrompt(pid) {
    var pk = (state.packs || []).filter(function (x) { return x.PACK_ID === pid; })[0];
    if (!pk) { alert('เลือก Pack ก่อน'); return; }
    var prompt = [
      'คุณคือ AI ผู้ช่วยตรวจสอบของ ทีม GAT (General Audit Team) PKG — สอดคลุมกฎบัตร v1.4',
      'ขอบเขตการตรวจ: ' + (pk.SCOPE || '-') + ' / รอบ: ' + (pk.PERIOD || '-') ,
      'ข้อเท็จจริงจาก BU: ' + (pk.TITLE || ''),
      'ลิงก์หลักฐานที่ต้องวิเคราะห์ (เข้าอ่านโดย AI ผู้ตรวจ):',
      String(pk.LINKS || '').split('\n').filter(Boolean).map(function (l, i) { return (i + 1) + '. ' + l.trim(); }).join('\n'),
      pk.NOTE ? 'หมายเหตุ: ' + pk.NOTE : '',
      '',
      'กติกาเหล็กของ GAT:',
      '1. ทุกข้อค้นพบต้องอ้างหลักฐาน+ตำแหน่ง (ชีท#แถว ลิงก์) — ห้ามเดา ไม่พบให้เขียน "ไม่พบในไฟล์"',
      '2. วิเคราะห์ตามแกน 5 เส้าการเงิน: สรุปหน้างาน = ใบเสร็จ = สลิปฝาก = Statement/BCT = ยอดเข้าจริงแบงก์',
      '3. ให้คะแนนแต่ละใบ: 🔴 ขัดกฎหมาย/จำเป็นจริง · 🟢 ข้อเสนอ/ปรับปรุง',
      '4. ตอบกลับ 1 ใบต่อ 1 บล็อก ใช้รูปแบบ [ใบ: หัวข้อ | ระดับ 🔴/🟢 | ประเด็น | ข้อเสนอ | หลักฐาน/ชีต+แถว]',
      '5. 1 ใบ = 1 ประเด็น — ห้ามรวมหลายประเด็นในใบเดียว (มาตรฐาน FM-01)',
      '6. พิจารณาด้วยวาทกรรม: "ตรวจเส้นทางการเงินตั้งแต่ต้นทางถึงปลายทาง (End-to-End Financial Traceability)"'
    ].filter(Boolean).join('\n');
    document.getElementById('aiPrompt').value = prompt;
    aiStatus('✅ สร้างชุดคำสั่งจาก ' + pid + ' แล้ว — กดคัดลอกไปวางใน AI ตัวที่ใช้ตรวจ');
  }
  function aiStatus(t) { var el = document.getElementById('aiStatus'); if (el) el.textContent = t; }
  function aiParse() {
    var t = String(document.getElementById('aiResult').value || '').trim();
    if (!t) { aiStatus('⚠️ วางคำตอบ AI ในช่องด้านบนก่อน'); return; }
    // แยกใบจากบล็อค [ใบ: …] หรือ บล็อกที่เริ่มด้วย "ใบ/ประเด็น/ข้อ" ขึ้นบล็อกใหม่
    var blocks = [];
    if (t.indexOf('[ใบ:') >= 0) {
      blocks = t.split(/\n?(?=\[ใบ:)/).filter(Boolean).map(function (b) { return b.replace(/^\[(?=ใบ:)/, '').replace(/\]$/, '').trim(); });
    } else {
      blocks = t.split(/\n{2,}/).map(function (b) { return b.trim(); }).filter(Boolean);
    }
    var cands = blocks.map(function (b) {
      var m = b.match(/ระดับ\s*([🔴🟢🟡🟠])/u);
      return { txt: b, sev: m ? m[1] : '🟢', checked: (m ? m[1] : '🟢') === '🔴' };
    });
    state.aiCands = cands;
    renderAiCandidates(cands);
    aiStatus('✂️ ตัดได้ ' + cands.length + ' บล็อก — ติ๊กเลือกเฉพาะใบจะออกเป็น REC (🔴 เลือกให้อัตโนมัติ)');
  }
  function renderAiCandidates(cands) {
    var box = document.getElementById('aiCandidates'); if (!box) return;
    cands = cands || state.aiCands || [];
    if (!cands.length) { box.innerHTML = ''; return; }
    box.innerHTML = '<div class="card" style="margin-top:8px"><b>ใบที่ AI เสนอ (' + cands.length + ') — ติ๊กเลือก → ออก REC</b>' +
      cands.map(function (c, i) {
        return '<div class="filters" style="align-items:flex-start"><input type="checkbox" id="aiC' + i + '" ' + (c.checked ? 'checked' : '') + ' style="width:auto;margin-top:4px">' +
          '<div style="flex:1;font-size:13px;line-height:1.5">' + escP(c.txt).replace(/\n/g, '<br>') + '</div></div>';
      }).join('') + '</div>';
  }
  function aiEmit() {
    var cands = state.aiCands || [];
    var picked = [];
    cands.forEach(function (c, i) {
      var cb = document.getElementById('aiC' + i);
      if (cb && cb.checked) picked.push(c);
    });
    if (!picked.length) { aiStatus('⚠️ ยังไม่ได้ติ๊กเลือกใบใด ๆ'); return; }
    var by = document.getElementById('aiBy').value.trim() || 'GAT';
    var regs = state.registers || [];
    var r = regs[0] || {};
    var doNext = function (idx) {
      if (idx >= picked.length) { aiStatus('✅ ออกใบครบ ' + picked.length + ' ใบ — รันเลขจากชีตสำเร็จ (ละเอียดปลายแถวด้านบน)'); importBCT(true); return; }
      var c = picked[idx];
      var sevFull = (c.sev === '🔴' ? '🔴 ขัดกฎหมาย/จำเป็นจริง' : '🟢 ข้อเสนอ');
      var title = (c.txt.match(/\[?ใบ:\s*([^|\n]+)/) || [null, c.txt.slice(0, 80)])[1];
      var post = {
        REG_ID: r.REG_ID || '',
        PROCESS_TYPE: r.PROCESS_TYPE || 'PM',
        PROCESS_CODE: r.PROCESS_CODE || 'GAT-AI-REVIEW',
        SEVERITY: sevFull,
        TITLE: title.trim(),
        DETAIL: c.txt,
        SHEET_REF: 'AI Review (ผู้คัดเลือก: ' + by + ')',
        REF_PM_WI: 'P-04 ขั้น ④ (AI วิเคราะห์ คัดโดย GAT)',
        APPROVER: by,
        BY: by
      };
      postToBCT('open_issue', post, function (res) {
        if (res.ok) { postToBCT('respond_issue', { REC_ID: res.REC_ID, BU_DECISION: 'ส่งข้อเสนอแนะที่ GAT คัดเลือกให้ BU พิจารณา', BY: 'GAT(ระบบ AI Review)' }, function () { doNext(idx + 1); }); }
        else { aiStatus('❌ ' + (res.error || 'ส่งไม่สำเร็จ — เช็ค GAS v1.5') + ' (หยุดที่ใบที่ ' + (idx + 1) + ')'); }
      });
    };
    doNext(0);
  }

/* group ใบ REC เป็นชุดตามรหัสหน้า TITLE (F-xx = สวัสดิการ, FIN-Rx = ระเบียบการเงิน, ที่เหลือ = อื่นๆ) — v1.7 */
  function escHtml(t) {
    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function recGroups() {
    var recs = state.recs || [];
    var g = { wel: [], fin: [], other: [] };
    var SCOPE_ONLY = (window.GAT_CONFIG.REC_SCOPE && window.GAT_CONFIG.REC_SCOPE.length) ? window.GAT_CONFIG.REC_SCOPE : null; // v1.10: โหมดทดสอบเรื่องเดียว (ซ่อนชุดอื่นจากเว็บ ไม่ลบข้อมูลชีต)
    recs.forEach(function (x) {
      var t = String(x.TITLE || '');
      var rid = String(x.REC_ID || '');
      // ใบทดสอบ (ปิดแล้ว) ไม่แสดงหัวข้อรายใบ
      var isTest = t.indexOf('ทดสอบ') >= 0 || t.indexOf('RT-') >= 0;
      if (isTest) return;
      if (SCOPE_ONLY && SCOPE_ONLY.indexOf(rid) < 0) return; // ซ่อนใบที่ไม่อยู่ขอบเขต (v1.10)
      if (t.indexOf('F-') === 0 || t.indexOf(' F-') >= 0 && rid <= 'GAT-REC-0015') g.wel.push(x);
      else if (t.indexOf('FIN-R') >= 0) g.fin.push(x);
      else g.other.push(x);
    });
    var out = [];
    if (g.wel.length) out.push({ label: '🏥 ชุด 1: สวัสดิการพื้นฐาน (F-01–F-15 — ตรวจ 29 ต.ค. 69)', items: g.wel });
    if (g.fin.length) out.push({ label: '💰 ชุด 2: ระเบียบการเงิน PKG 2567 (FIN-R1–R7 — ตรวจ 3 พ.ย. 69)', items: g.fin });
    if (g.other.length) out.push({ label: '📋 ประกาศสวัสดิการพื้นฐานสมาชิก PKG — ประเทศไทย (GA-LC)', items: g.other });
    return out;
  }

  function scopedRecs() {
    // v1.10 — รายการ REC ที่โชว์บนเว็บทุกแท็บ: ถ้าตั้ง REC_SCOPE = เฉพาะเลขในขอบเขต (โหมดทดสอบเรื่องเดียว) ไม่ตั้ง = ทั้งหมด
    var recs = state.recs || [];
    var SCOPE_ONLY = (window.GAT_CONFIG.REC_SCOPE && window.GAT_CONFIG.REC_SCOPE.length) ? window.GAT_CONFIG.REC_SCOPE : null;
    if (!SCOPE_ONLY) return recs;
    return recs.filter(function (x) { return SCOPE_ONLY.indexOf(String(x.REC_ID || '')) >= 0; });
  }

/* ---------- แท็บสรุปผลงาน GAT (สร้างข้อความสดจาก state) ---------- */
  function renderSummary() {
    var box = id('summaryBody'); if (!box) return;
    var regs = state.registers || [];
    var recs = state.recs || [];
    var entries = state.entries || [];
    var byStat = { '🟢': 0, '🟡': 0, '🔴': 0 };
    regs.forEach(function (r) { var s = String(r.STATUS || '🟡 รอข้อมูลจริง').slice(0, 2); if (byStat[s] !== undefined) byStat[s]++; });
    // โครงสร้างกำกับ (ไม่ใช่ข้อมูลจริง): ขั้นนำส่ง 9 + ฝ่าฝืนร้ายแรง 7 + ประเภทเอกสาร 16
    var CTRL = regs.filter(function (r) { var s = String(r.SOURCE || ''); return s.indexOf('9 ขั้น') >= 0 || s.indexOf('การฝ่าฝืน') >= 0 || s.indexOf('ประเภทเอกสาร') >= 0; }).length;
    var TAX = regs.filter(function (r) { return String(r.SOURCE || '').indexOf('ListTAX_BU') >= 0; }).length;
    var UNIV = regs.filter(function (r) { return String(r.SOURCE || '').indexOf('Step2') >= 0; }).length;
    var SEEDR = regs.filter(function (r) { return String(r.SOURCE || '').indexOf('seed') >= 0; }).length;
    var BCTR = state.registersBCT.length;
    // ระบบเอกสาร 4 ประเภท (นิยามพี่หนึ่ง 2 พ.ย. 69): PM=Process Management · WI=Work Instruction · SD=Supporting Document · FM=Form/Format
    var teamProc = { PM: 0, WI: 0, SD: 0, FM: 0 };
    ['PM', 'WI', 'SD', 'FM'].forEach(function (k) {
      var boxp = (state.process || {})[k];
      if (boxp && boxp.items && boxp.items.length) teamProc[k] = boxp.items.length; else teamProc[k] = { PM: 6, WI: 7, SD: 6, FM: 5 }[k];
    });
    var recOpen = recs.filter(function (x) { return String(x.STATUS).indexOf('ปิด') < 0; });
    var recRed = recs.filter(function (x) { return String(x.SEVERITY || '').indexOf('🔴') >= 0; });
    var recNoFix = recs.filter(function (x) { return String(x.BU_DECISION || '').indexOf('ไม่แก้') >= 0; });
    var recFixed = recs.filter(function (x) { return String(x.BU_DECISION || '').indexOf('แก้') >= 0 && String(x.BU_DECISION).indexOf('ไม่') < 0; });
    var recClosed = recs.filter(function (x) { return String(x.STATUS).indexOf('ปิด') >= 0; });

    var h = [];
    h.push('<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px;margin-bottom:18px">');
    h.push(kpiHTML('รายการตรวจ (Registers)', fmt(regs.length), 'n'));
    h.push(kpiHTML('ข้อมูลจริง / รอเก็บข้อมูล', (byStat['🟢'] + byStat['🔴']) + ' / ' + byStat['🟡'], byStat['🔴'] > 0 ? 'r' : 'g'));
    h.push(kpiHTML('โครงสร้างกำกับ (9 ขั้น + 7 ข้อ + เอกสาร 16)', fmt(CTRL), 'v'));
    h.push(kpiHTML('ข้อเสนอแนะ GAT-REC', fmt(recs.length) + '<div style="font-size:12px;color:#7d93b2;font-weight:600">เปิด ' + recOpen.length + ' · ปิด ' + recClosed.length + '</div>', 'a'));
    h.push('</div>');

    h.push('<h3>1) ทะเบียนงานตรวจ (Registers)</h3>');
    h.push('<div style="font-size:14px;line-height:1.7">' +
      '• รวม <b>' + regs.length + '</b> รายการ (seed ' + SEEDR + ' + live BCT ' + BCTR + ') — เป็นข้อมูล "ที่ต้องตรวจ" แยกจากเอกสาร PM/WI/SD/FM ของทีม (หมายเลข 3 ด้านล่าง)<br>' +
      '&nbsp;&nbsp;◦ ข้อมูลจริงรายบริษัท/หน่วยงาน: <b>' + fmt(TAX + UNIV) + '</b> (รายการภาษี TAX_BU ' + fmt(TAX) + ' + Regulatory Universe ' + fmt(UNIV) + ') · สถานะจริง: 🟢 ' + byStat['🟢'] + ' · 🟡 รอข้อมูล ' + byStat['🟡'] + ' · 🔴 ยังไม่มีข้อมูล TG ' + byStat['🔴'] + '<br>' +
      '&nbsp;&nbsp;◦ โครงสร้างกำกับ: ' + fmt(CTRL) + ' (ขั้นนำส่ง 9 · ฝ่าฝืนร้ายแรง 7 · ประเภทเอกสาร 16)<br>' +
      '• บันทึกผลจาก BU (GAT_Entries): <b>' + entries.length + '</b> รายการ</div>');

    h.push('<h3>2) ข้อเสนอแนะรันเลข (GAT-REC)</h3>');
    h.push('<div style="font-size:14px;line-height:1.7">' +
      '• รวม <b>' + recs.length + '</b> ใบ — 🔴 ขัดกฎหมาย/จำเป็นจริง: <b>' + recRed.length + '</b> ใบ · 🟢 ข้อเสนอ: ' + (recs.length - recRed.length) + ' ใบ · ปิดสมบูรณ์: <b>' + recClosed.length + '</b> ใบ<br>' +
      '• BU ตอบ: แก้แล้ว ' + recFixed.length + ' · ไม่แก้ ' + recNoFix.length + ' · ยังไม่ตอบ ' + (recOpen.length - recFixed.length - recNoFix.length) + ' — วงจรเต็มอยู่ในชีท GAT_Issues + GAT_AuditLog (GAS v1.4)</div>');
    // แสดงรายใบแยกชุด (v1.7 ตามคำขอพี่หนึ่ง 3 พ.ย. 69)
    var groups = recGroups();
    groups.forEach(function (g) {
      h.push('<div style="margin-top:10px"><b style="font-size:13.5px">' + g.label + '</b> <span style="color:#7d93b2;font-size:12px">(' + g.items.length + ' ใบ)</span></div>');
      h.push('<table style="width:100%;border-collapse:collapse;font-size:12.5px;">');
      h.push('<tr style="color:#7d93b2;text-align:left"><th style="padding:6px 8px">เลขใบ</th><th>ระดับ</th><th>หัวข้อ</th><th>สถานะ</th></tr>');
      g.items.forEach(function (x) {
        var sev = String(x.SEVERITY || ''); var mark = sev.indexOf('🔴') >= 0 ? '🔴' : '🟢';
        h.push('<tr><td style="padding:5px 8px;white-space:nowrap"><b>' + (x.REC_ID || '-') + '</b></td><td>' + mark + '</td><td>' + escHtml(String(x.TITLE || '')) + ' <span style="color:#7d93b2">' + escHtml(String(x.SHEET_REF || '')) + '</span></td><td style="white-space:nowrap">' + escHtml(String(x.STATUS || '')) + '</td></tr>');
      });
      h.push('</table>');
    });

    h.push('<h3>3) ระบบเอกสาร 4 ประเภท (PM/WI/SD/FM — นิยามของพี่หนึ่ง)</h3>');
    h.push('<div style="font-size:14px;line-height:1.7">' +
      '• PM Process Management (ภาพการไหลของงาน) <b>' + teamProc.PM + '</b> หัวข้อ · WI Work Instruction (คำสั่งติดตำแหน่ง) <b>' + teamProc.WI + '</b> · SD Supporting Document (เอกสารสนับสนุน) <b>' + teamProc.SD + '</b> · FM Form/Format (แบบฟอร์มบันทึกผล) <b>' + teamProc.FM + '</b> — รวม <b>' + (teamProc.PM + teamProc.WI + teamProc.SD + teamProc.FM) + ' หัวข้อ</b><br>' +
      '• แหล่ง: แท็บ "⚙ กระบวนการทีม GAT" + gat-process.json v2.0 (ผูกกฎบัตร GAT v1.4 — SLA 3ว/5ว/7ว · อุทธรณ์ OAC · สถานะ 5 ระดับ) · เอกสาร QMS ฉบับเต็ม GAT-QMS-001 v1.0 ครบ 8 ส่วน</div>');

    h.push('<h3>4) ระบบ/โครงสร้างที่สร้างเสร็จ</h3>');
    h.push('<div style="font-size:14px;line-height:1.7">' +
      '• เว็บ: 7 แท็บ (Dashboard / Registers / BCT / ข้อเสนอแนะ / สรุป / Universe / รายงาน)<br>' +
      '• ชีท BCT กลาง: GAT_Registers + GAT_Entries + GAT_Issues + GAT_AuditLog (GAS ทำงานจริง — ทดสอบวงจร open→respond→close ผ่าน)<br>' +
      '• เทมเพลต bct-template.xlsx: ติดตั้งฐานใหม่ได้ใน 4 ขั้น<br>' +
      '• เอกสาร QMS: <b>GAT-QMS-001 v1.0</b> ครบ 8 ส่วน (แม่แบบของพี่หนึ่ง) + gat-process.json v2.0 ผูกกฎบัตร v1.4<br>' +
      '• ความปลอดภัย: รันเลขอยู่ฝั่งชีท (LockService) · POST text/plain เลี่ยง CORS · ไฟล์ต้นฉบับ BU ไม่ถูกแก้</div>');

    h.push('<h3>5) งานค้าง/ถัดไป (roadmap)</h3>');
    h.push('<div style="font-size:14px;line-height:1.7">' +
      '• ล้างแถวทดสอบ REC-0016–0019 ในชีท<br>' +
      '• v1.2: โครง 2 ฐาน (BCT กลาง + BCT บริษัท) <br>' +
      '• v1.3: Google Form ให้ BU + แจ้งเตือนเลยกำหนด (Telegram)<br>' +
      '• v2.0: Compliance Calendar "วันนี้มีอะไรต้องส่ง" + รายงานรายเดือนอัตโนมัติ</div>');

    box.innerHTML = h.join('');

    // ปุ่มคัดลอก/ดาวน์โหลด
    var txt = buildSummaryText();
    var act = document.createElement('div');
    act.style.marginTop = '14px';
    var b1 = document.createElement('button'); b1.textContent = '📄 คัดลอกเป็นข้อความ';
    b1.onclick = function () { copyText(txt, 'คัดลอกสรุปแล้ว'); };
    var b2 = document.createElement('button'); b2.textContent = '⬇ ดาวน์โหลด .md'; b2.style.marginLeft = '8px';
    b2.onclick = function () { download('GAT-สรุปผลงาน-' + new Date().toISOString().slice(0, 10) + '.md', txt); };
    act.appendChild(b1); act.appendChild(b2); box.appendChild(act);
  }

  function kpiHTML(label, val, cls) {
    return '<div class="kpi' + (cls ? ' ' + cls : '') + '"><div class="l">' + label + '</div><div class="b">' + val + '</div></div>';
  }

  function buildSummaryText() {
    var regs = state.registers || [], recs = state.recs || [], entries = state.entries || [];
    var byStat = { '🟢': 0, '🟡': 0, '🔴': 0 };
    regs.forEach(function (r) { var s = String(r.STATUS || '🟡 รอข้อมูลจริง').slice(0, 2); if (byStat[s] !== undefined) byStat[s]++; });
    var CTRL = regs.filter(function (r) { var s = String(r.SOURCE || ''); return s.indexOf('9 ขั้น') >= 0 || s.indexOf('การฝ่าฝืน') >= 0 || s.indexOf('ประเภทเอกสาร') >= 0; }).length;
    var TAX = regs.filter(function (r) { return String(r.SOURCE || '').indexOf('ListTAX_BU') >= 0; }).length;
    var UNIV = regs.filter(function (r) { return String(r.SOURCE || '').indexOf('Step2') >= 0; }).length;
    var SEEDR = regs.filter(function (r) { return String(r.SOURCE || '').indexOf('seed') >= 0; }).length;
    var BCTR = state.registersBCT.length;
    var teamProc = { PM: 0, WI: 0, SD: 0, FM: 0 };
    ['PM', 'WI', 'SD', 'FM'].forEach(function (k) {
      var boxp = (state.process || {})[k];
      if (boxp && boxp.items && boxp.items.length) teamProc[k] = boxp.items.length; else teamProc[k] = { PM: 6, WI: 7, SD: 6, FM: 5 }[k];
    });
    var recOpen = recs.filter(function (x) { return String(x.STATUS).indexOf('ปิด') < 0; });
    var recRed = recs.filter(function (x) { return String(x.SEVERITY || '').indexOf('🔴') >= 0; });
    var recNoFix = recs.filter(function (x) { return String(x.BU_DECISION || '').indexOf('ไม่แก้') >= 0; });
    var recClosed = recs.filter(function (x) { return String(x.STATUS).indexOf('ปิด') >= 0; });
    var L = [];
    L.push('# สรุปผลงาน GAT — ' + new Date().toLocaleString('th-TH'));
    L.push('');
    L.push('## 1) ทะเบียนงานตรวจ (ข้อมูลที่ต้องตรวจ — ต่างจากเอกสาร PM/WI/SD/FM ของทีม)');
    L.push('- Registers ' + regs.length + ' รายการ (seed ' + SEEDR + ' + BCT ' + BCTR + ') — ข้อมูลจริง ' + (TAX + UNIV) + ' + โครงสร้างกำกับ ' + CTRL + ' (นำส่ง 9 ขั้น/ฝ่าฝืน 7 ข้อ/ประเภทเอกสาร 16)');
    L.push('- สถานะ: 🟢 ' + byStat['🟢'] + ' · 🟡 ' + byStat['🟡'] + ' · 🔴 ' + byStat['🔴'] + ' (🔴 = ยังไม่มีข้อมูล TG)');
    L.push('- บันทึกผลจาก BU: ' + entries.length + ' รายการ');
    L.push('');
    L.push('## 2) ข้อเสนอแนะรันเลข — รายใบแยกชุด');
    L.push('- รวม ' + recs.length + ' ใบ · ปิดสมบูรณ์ ' + recClosed.length + ' · เปิด ' + recOpen.length);
    recGroups().forEach(function (g) {
      L.push('');
      L.push('### ' + g.label + ' — ' + g.items.length + ' ใบ');
      g.items.forEach(function (x, i) {
        var sev = String(x.SEVERITY || ''); var mark = sev.indexOf('🔴') >= 0 ? '🔴' : '🟢';
        L.push((i + 1) + '. ' + mark + ' **' + (x.REC_ID || '-') + '** ' + String(x.TITLE || '') + ' — _' + String(x.STATUS || '') + '_' + (x.SHEET_REF ? ' (อ้าง: ' + x.SHEET_REF + ')' : ''));
      });
    });
    L.push('- 🔴 ' + recRed.length + ' · 🟢 ' + (recs.length - recRed.length) + ' · เปิดอยู่ ' + recOpen.length + ' · ปิด ' + recClosed.length + ' · ไม่แก้ ' + recNoFix.length);
    L.push('- วงจร: ออกใบ (รันเลขในชีท) → BU ตอบ (แก้=หลักฐาน / ไม่แก้=เหตุผล+ผู้รับผิดชอบ) → GAT ยืนยัน/ปิด');
    L.push('');
    L.push('## 3) ระบบเอกสาร 4 ประเภท (PM/WI/SD/FM)');
    L.push('- PM ' + teamProc.PM + ' · WI ' + teamProc.WI + ' · SD ' + teamProc.SD + ' · FM ' + teamProc.FM + ' (รวม ' + (teamProc.PM + teamProc.WI + teamProc.SD + teamProc.FM) + ' หัวข้อ) — gat-process.json v2.0 ผูกกฎบัตร GAT v1.4 · QMS: GAT-QMS-001 v1.0 ครบ 8 ส่วน');
    L.push('');
    L.push('## 4) โครงสร้างที่สร้างเสร็จ');
    L.push('- แท็บ 8 (Dashboard/Registers/BCT/ข้อเสนอแนะ/สรุป/Universe/กระบวนการ/รายงาน) — UI Enterprise v1.2');
    L.push('- ชีท BCT: GAT_Registers/GAT_Entries/GAT_Issues/GAT_AuditLog + GAS (LockService รันเลข)');
    L.push('- เทมเพลต bct-template.xlsx ติดตั้งฐานใหม่ 4 ขั้น');
    L.push('');
    L.push('## 5) ค้าง/ถัดไป');
    L.push('- ล้างแถวทดสอบ REC-0016–0019 · v1.2 โครง 2 ฐาน · v1.3 Google Form + แจ้งเตือน · v2.0 Calendar + รายงานรายเดือน');
    return L.join('\n');
  }

  function filtered() {
    return state.registers.filter(function (r) {
      if (state.filter.bu && r.BU !== state.filter.bu) return false;
      if (state.filter.type && r.PROCESS_TYPE !== state.filter.type) return false;
      if (state.filter.q) {
        var hay = JSON.stringify(r).toLowerCase();
        if (hay.indexOf(state.filter.q.toLowerCase()) < 0) return false;
      }
      return true;
    });
  }

  function renderDash() {
    var regs = filtered();
    var byStat = { '🟢': 0, '🟡': 0, '🔴': 0 };
    regs.forEach(function (r) {
      var s = String(r.STATUS || '🟡 รอข้อมูลจริง').slice(0, 2);
      if (byStat[s] !== undefined) byStat[s]++;
    });
    var byType = { PM: 0, WI: 0, SD: 0, FM: 0 };
    regs.forEach(function (r) { if (byType[r.PROCESS_TYPE] !== undefined) byType[r.PROCESS_TYPE]++; });
    var buby = {};
    var buby = {};
    regs.forEach(function (r) { buby[r.BU] = (buby[r.BU] || 0) + 1; });
    var buRows = Object.keys(buby).sort().map(function (bu) {
      return '<tr><td><a class="lnk" data-bu="' + esc(bu) + '">' + esc(bu) + '</a></td><td>' + buby[bu] + '</td></tr>';
    }).join('');
    // ระบบเอกสาร 4 ประเภท (นิยามใหม่) — แยกจากทะเบียนข้อมูลตรวจ 184
    var teamCount = { PM: 6, WI: 7, SD: 6, FM: 5 };
    ['PM', 'WI', 'SD', 'FM'].forEach(function (k) {
      var p = (state.process || {})[k];
      if (p && p.items && p.items.length) teamCount[k] = p.items.length;
    });
    var teamTotal = teamCount.PM + teamCount.WI + teamCount.SD + teamCount.FM;
    id('kpiRow').innerHTML =
      kpi('รายการตรวจ (Registers)', fmt(regs.length), 'ข้อมูลจริง+โครงสร้าง') +
      kpi('ระบบเอกสาร (PM/WI/SD/FM)', teamCount.PM + '·' + teamCount.WI + '·' + teamCount.SD + '·' + teamCount.FM, 'รวม ' + teamTotal + ' หัวข้อ — แยกจากทะเบียนตรวจ') +
      kpi('🟢 ปกติ', fmt(byStat['🟢']), 'มีข้อมูล/ผ่าน') +
      kpi('🟡 รอข้อมูลจริง', fmt(byStat['🟡']), 'ต้องติดตาม BU') +
      kpi('🔴 ช่องว่าง', fmt(byStat['🔴']), 'ยังไม่มีระบบ/ข้อมูล') +
      kpi('รายการบันทึก (BCT Entries)', fmt(state.entries.length), 'live จากชีท') +
      kpi('ข้อเสนอแนะเปิดอยู่', fmt(state.recs.filter(function (x) { return String(x.STATUS).indexOf('ปิด') < 0; }).length), 'รันเลข GAT-REC-xxxx') +
      kpi('BU ไม่แก้ไข (รอ GAT ยืนยัน)', fmt(state.recs.filter(function (x) { return String(x.STATUS || '').indexOf('ไม่แก้') >= 0 && String(x.STATUS).indexOf('ปิด') < 0; }).length), 'ต้องยืนยันกลับตาม SOP ⑤');
    // แยกแหล่งข้อมูล (นิยามใหม่: 184 = ข้อมูลที่ต้องตรวจ — PM/WI/SD/FM เป็นเอกสารกระบวนการทีม ไม่ใช่หมวดนับข้อมูล)
    var bySrc = {};
    regs.forEach(function (r) { var s = String(r.SOURCE || 'อื่น ๆ'); var key = s.indexOf('Step2') >= 0 ? 'universe' : s.indexOf('ListTAX') >= 0 ? 'taxbu' : s.indexOf('9 ขั้น') >= 0 ? 'wi9' : s.indexOf('การฝ่าฝืน') >= 0 ? 'fv7' : s.indexOf('ประเภทเอกสาร') >= 0 ? 'doc16' : s.indexOf('PMSG') >= 0 ? 'pmsgreg' : s.indexOf('BCT') >= 0 ? 'bct' : 'other'; bySrc[key] = (bySrc[key] || 0) + 1; });
    var srcMeta = {
      universe: { label: 'Regulatory Universe (ข้อกำกับหน่วยงาน)', color: '#175cd3' },
      taxbu: { label: 'ภาษีรายบริษัท (TAX_BU)', color: '#0e8345' },
      wi9: { label: 'ขั้นนำส่ง 9 ขั้น (Submission Control)', color: '#0c7d95' },
      fv7: { label: 'ฝ่าฝืนร้ายแรง 7 ข้อ', color: '#c0231b' },
      doc16: { label: 'ประเภทเอกสาร 16', color: '#6d3fc0' },
      pmsgreg: { label: 'หน่วยงานกำกับ PMSG', color: '#c47c0a' },
      bct: { label: 'Live จาก BCT', color: '#16304f' },
      other: { label: 'อื่น ๆ', color: '#7d93b2' }
    };
    id('dashBody').innerHTML =
      '<div class="cols2">' +
      '<div class="card"><h3>ตามแหล่งข้อมูล</h3>' + barChart(bySrc, srcMeta) + '</div>' +
      '<div class="card"><h3>ตาม BU (กดเพื่อกรอง)</h3><table class="tbl"><thead><tr><th>BU/กลุ่ม</th><th>รายการ</th></tr></thead><tbody>' + buRows + '</tbody></table></div>' +
      '</div>' +
      '<div class="card"><h3>กระบวนการ 9 ขั้น (Regulatory Submission Control)</h3>' +
      '<ol class="flow">' + ['Requirement Identified', 'BU Prepare', 'BU Review', 'Compliance Check', 'Legal Consult', 'Approve & Sign', 'Submit', 'Evidence Archive', 'Dashboard'].map(function (s, i) {
        return '<li><b>' + (i + 1) + '. ' + s + '</b></li>';
      }).join('<li class="arw">→</li>') + '</ol>' +
      '<div class="note">หลักการ: <b>No Review → No Sign → No Submission</b> — ทุกรายการใน Registers เดินตามกระบวนการนี้บน BCT ก่อนขึ้น Dashboard</div></div>';
  }
  function kpi(label, big, sub, cls) {
    return '<div class="kpi ' + (cls || '') + '"><div class="l">' + esc(label) + '</div><div class="b">' + big + '</div><div class="s">' + esc(sub) + '</div></div>';
  }
  function barChart(byType, meta) {
    var max = Math.max(1, Object.keys(byType).reduce(function (a, k) { return Math.max(a, byType[k]); }, 0));
    return '<table class="tbl">' + Object.keys(byType).map(function (k) {
      var w = Math.round(100 * byType[k] / max);
      var m = meta[k] || {};
      return '<tr><td class="lbl" style="color:' + (m.color || '#334') + '">' + k + ' — ' + esc(m.label || '') + '</td>' +
        '<td><div class="barbox"><div class="bar" style="width:' + w + '%;background:' + (m.color || '#2563eb') + '"></div><span>' + byType[k] + '</span></div></td></tr>';
    }).join('') + '</table>';
  }

  var PAGE_SIZE = 25;
  function renderRegisters() {
    var all = filtered();
    var totalPages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
    if (state.page > totalPages) state.page = totalPages;
    if (state.page < 1) state.page = 1;
    var regs = all.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);
    var opts = uniqueCol('BU').map(function (b) {
      return '<option' + (state.filter.bu === b ? ' selected' : '') + '>' + esc(b) + '</option>';
    }).join('');
    id('buFilter').innerHTML = '<option value="">— BU ทั้งหมด —</option>' + opts;
    id('buFilter').value = state.filter.bu;
    id('regBody').innerHTML = regs.map(function (r) {
      return '<tr><td class="mono"><span class="copy-id" data-rid="' + esc(r.REG_ID) + '" title="กดเพื่อคัดลอกรหัส">' + esc(r.REG_ID) + '</span></td><td>' + esc(r.BU) +
        '</td><td><span class="chip" data-tp="' + esc(r.PROCESS_TYPE) + '">' + esc(r.PROCESS_TYPE) + '</span></td><td>' + esc(r.TITLE) +
        '</td><td>' + esc(r.REGULATOR || '') + '</td><td>' + esc(r.FREQUENCY || '') +
        '</td><td>' + esc((r.OWNER || '') + (r.SIGNATORY ? ' · ลงนาม: ' + r.SIGNATORY : '')) +
        '</td><td class="stat">' + esc(r.STATUS || '') + '</td><td class="mono src">' + esc(r.SOURCE || '') + '</td></tr>';
    }).join('') || '<tr><td colspan="9" class="empty">ไม่มีข้อมูลตรงเงื่อนไข</td></tr>';
    id('regCount').textContent = 'จากทั้งหมด ' + fmt(all.length) + ' รายการ';
    var pg = id('regPage');
    if (pg) {
      var from = all.length ? (state.page - 1) * PAGE_SIZE + 1 : 0;
      var to = Math.min(all.length, state.page * PAGE_SIZE);
      var btn = function (p, lbl, dis) { return '<button class="button-lite" data-pg="' + p + '"' + (dis ? ' disabled' : '') + ' style="padding:6px 12px;margin:0 4px">' + lbl + '</button>'; };
      pg.innerHTML = 'แสดง ' + from + '–' + to + ' จาก ' + fmt(all.length) + ' · หน้า ' + state.page + '/' + totalPages + ' ' +
        btn(1, '« หน้าแรก', state.page <= 1) + btn(state.page - 1, '‹ ก่อนหน้า', state.page <= 1) +
        btn(state.page + 1, 'ถัดไป ›', state.page >= totalPages) + btn(totalPages, 'ท้ายสุด »', state.page >= totalPages);
    }
  }
  function renderBctStatus() {
    var pairs = [
      ['stApi', (window.GAT_CONFIG.BCT_API ? String(window.GAT_CONFIG.BCT_API).slice(0, 58) + '…' : 'ยังไม่ตั้งค่า (วาง URL ในช่องด้านบน)')],
      ['stSeed', fmt(state.registers.filter(function (r) { return String(r.SOURCE || '').indexOf('seed') >= 0; }).length) + ' รายการ'],
      ['stBct', fmt(state.registersBCT.length) + ' รายการ'],
      ['stEntries', fmt(state.entries.length) + ' รายการ'],
      ['stIssues', fmt(state.recs.length) + ' ใบ (เปิด ' + fmt(state.recs.filter(function (x) { return String(x.STATUS).indexOf('ปิด') < 0; }).length) + ')']
    ];
    pairs.forEach(function (p) { if (id(p[0])) id(p[0]).textContent = p[1]; });
  }
  function uniqueCol(col) {
    var set = {};
    state.registers.forEach(function (r) { if (r[col]) set[r[col]] = 1; });
    return Object.keys(set);
  }

  function renderUniverse() {
    if (!state.seed) { id('uniBody').innerHTML = ''; return; }
    id('uniBody').innerHTML = (state.seed.universe || []).map(function (u) {
      return '<div class="card"><h3>' + esc(u.bu) + ' — ' + esc(u.biz || '') + '</h3>' +
        '<table class="tbl"><thead><tr><th>นิติบุคคล/หน่วย</th><th>ต้องสำรวจ</th><th>หน่วยงานกำกับ</th><th>ความถี่/ลงนาม</th></tr></thead><tbody>' +
        (u.entities || []).map(function (en) {
          return (en.requirements || []).map(function (q) {
            return '<tr><td class="mono">' + esc(en.entity) + '</td><td>' + esc(q.req || '') + '</td><td>' + esc(q.regulator || '') + '</td><td>' + esc(q.frequency || '') + (q.signatory ? ' · ' + esc(q.signatory) : '') + '</td></tr>';
          }).join('');
        }).join('') + '</tbody></table></div>';
    }).join('');
  }

  /* ---------- report ---------- */
  function buildReport() {
    var regs = filtered();
    var byStat = { '🟢': 0, '🟡': 0, '🔴': 0 };
    regs.forEach(function (r) { var s = String(r.STATUS || '🟡 รอข้อมูลจริง').slice(0, 2); if (byStat[s] !== undefined) byStat[s]++; });
    var recs = state.recs;
    var recOpen = recs.filter(function (x) { return String(x.STATUS).indexOf('ปิด') < 0; });
    var recFixed = recs.filter(function (x) { return String(x.BU_DECISION || '').indexOf('แก้') >= 0 && String(x.BU_DECISION).indexOf('ไม่') < 0; });
    var recNo = recs.filter(function (x) { return String(x.BU_DECISION || '').indexOf('ไม่แก้') >= 0; });
    var lines = [
      'รายงาน GAT Work System — สรุปผู้บริหาร',
      'วันที่รายงาน: ' + new Date().toLocaleString('th-TH'),
      'แหล่งข้อมูล: seed xlsx (26 ชีท) + BCT (Google Sheet) — BCT_API: ' + (window.GAT_CONFIG.BCT_API ? 'ตั้งค่าแล้ว ✅' : 'ยังไม่ตั้งค่า'),
      '', '1) ขนาดระบบ: Registers ' + regs.length + ' รายการ (PM ' + regs.filter(function (r) { return r.PROCESS_TYPE === 'PM'; }).length +
      ' / WI ' + regs.filter(function (r) { return r.PROCESS_TYPE === 'WI'; }).length +
      ' / SD ' + regs.filter(function (r) { return r.PROCESS_TYPE === 'SD'; }).length +
      ' / FM ' + regs.filter(function (r) { return r.PROCESS_TYPE === 'FM'; }).length + ')',
      '2) สถานะ: 🟢 ' + byStat['🟢'] + ' · 🟡 ' + byStat['🟡'] + ' · 🔴 ' + byStat['🔴'],
      '3) โครง 9 ขั้น: No Review → No Sign → No Submission',
      '4) ช่องว่างสำคัญที่ seed เผย: บางนิติบุคคลยังไม่มีสถานะระบบ TG (WHT/ภ.พ.30/บอจ.5) — ต้องติดตามกับทีมบัญชี',
      '5) ข้อเสนอแนะ: รวม ' + recs.length + ' · เปิดอยู่ ' + recOpen.length + ' · BU แก้แล้ว ' + recFixed.length + ' · BU ไม่แก้ ' + recNo.length +
        (recNo.length ? ' ⚠️ รายการที่ BU ไม่แก้: ' + recNo.map(function (x) { return x.REC_ID || x.ISSUE_ID; }).join(', ') : '')
    ].join('\n');
    id('reportOut').textContent = lines;
  }

  /* ---------- หน้า RECS: dropdown + ตารางข้อเสนอแนะ ---------- */
  function renderRecs() {
    // dropdown เลือกต้นเรื่องจาก registers (เติมเมื่อยังไม่มีตัวเลือกรายการจริง)
    var pick = id('recRegPick');
    if (pick && pick.options.length < 2) {
      pick.innerHTML = '<option value="">— เลือกรายการจาก Registers (ต้นเรื่อง) —</option>';
      state.registers.forEach(function (r, i) {
        var o = document.createElement('option');
        o.value = String(i);
        o.textContent = r.REG_ID + ' · ' + (r.TITLE || '').slice(0, 60);
        pick.appendChild(o);
      });
    }
    // dropdown เลือกเลขที่ตอบ
    var rp = id('respRecPick');
    var cur = rp.value;
    var rpRecs = scopedRecs(); // v1.10
    rp.innerHTML = '<option value="">— เลือกเลขข้อเสนอแนะ —</option>' + rpRecs.map(function (x) {
      return '<option value="' + esc(x.REC_ID) + '">' + esc(x.REC_ID) + (x.REC_NO ? ' (#' + esc(x.REC_NO) + ')' : '') + ' · ' + esc(String(x.TITLE || '').slice(0, 40)) + '</option>';
    }).join('');
    rp.value = cur;
    // v1.9 — dropdown ปิดใบ (เฉพาะใบที่ BU ตอบแล้ว + ยังไม่ปิด)
    var cp = id('closeRecPick');
    if (cp) {
      var curc = cp.value;
      cp.innerHTML = '<option value="">— เลือกใบที่ BU ตอบแล้ว —</option>' + scopedRecs().filter(function (x) {
        var st = String(x.STATUS || '');
        return String(x.BU_DECISION || '').trim() && st.indexOf('ปิด') < 0 && st.indexOf('ทดสอบ') < 0;
      }).map(function (x) {
        return '<option value="' + esc(x.REC_ID) + '">' + esc(x.REC_ID) + ' · ' + esc(String(x.TITLE || '').slice(0, 40)) + ' · BU: ' + esc(String(x.BU_DECISION || '')) + '</option>';
      }).join('');
      cp.value = curc;
    }
    var list = scopedRecs(); // v1.10 — ขอบเขตโชว์
    id('recCount').textContent = list.length ? ('รวม ' + list.length + ' รายการ') : '';
    id('recBody').innerHTML = list.map(function (x) {
      var sev = String(x.SEVERITY || '').indexOf('🔴') >= 0 ? 'sev-red' : 'sev-grn';
      var tail = [];
      if (x.EVIDENCE_URL) tail.push('📎 <a href="' + esc(x.EVIDENCE_URL) + '" target="_blank" rel="noopener">หลักฐาน</a>');
      if (x.NO_FIX_REASON) tail.push('เหตุผล: ' + esc(x.NO_FIX_REASON));
      if (x.RESPONSIBLE) tail.push('ผู้รับผิดชอบ: <b>' + esc(x.RESPONSIBLE) + '</b>');
      return '<tr><td class="mono"><b>' + esc(x.REC_ID || x.ISSUE_ID || '') + '</b>' + (x.REC_NO ? '<br>#' + esc(x.REC_NO) : '') + '</td>' +
        '<td><span class="' + sev + '">' + esc(x.SEVERITY || '') + '</span></td>' +
        '<td>' + esc(x.TITLE || '') + (x.DETAIL ? '<div class="detl">' + esc(String(x.DETAIL).slice(0, 140)) + '</div>' : '') + '</td>' +
        '<td class="mono">' + esc(x.SHEET_REF || '') + '</td>' +
        '<td>' + esc(x.STATUS || '') + '</td>' +
        '<td>' + esc(x.BU_DECISION || '') + '</td>' +
        '<td>' + (tail.join('<br>') || '—') + '</td></tr>';
    }).join('') || '<tr><td colspan="7" class="empty">ยังไม่มีข้อเสนอแนะ — ออกข้อเสนอแนะแรกได้จากฟอร์มด้านบน (ต้องตั้ง BCT API ก่อน เพื่อให้รันเลขบนชีท)</td></tr>';
  }

  function openRec() {
    var i = parseInt(id('recRegPick').value, 10);
    var r = (!isNaN(i) && state.registers[i]) ? state.registers[i] : null;
    var title = id('recTitle').value.trim();
    var detail = id('recDetail').value.trim();
    if (!title) { status('⚠️ กรอกหัวข้อข้อเสนอแนะก่อน'); return; }
    var payload = {
      REG_ID: r ? r.REG_ID : '',
      PROCESS_TYPE: r ? r.PROCESS_TYPE : '',
      PROCESS_CODE: r ? r.PROCESS_CODE : '',
      SEVERITY: id('recSev').value,
      TITLE: title,
      DETAIL: detail,
      SHEET_REF: r ? (r.SOURCE || '') : '',
      REF_PM_WI: id('recRefPmWi').value.trim() || 'P-04 ขั้น ④ (ตาม WI-02)',
      APPROVER: id('recApprover').value.trim(),
      BY: id('recBy').value.trim() || 'GAT'
    };
    postToBCT('open_issue', payload, function (res) {
      if (res.ok) {
        status('✅ รันเลขแล้ว: ' + res.REC_ID + ' (#' + res.REC_NO + ') — ส่งเข้าชีท ' + (window.GAT_CONFIG.SHEETS ? window.GAT_CONFIG.SHEETS.RECS : 'GAT_Issues') + ' บน BCT เรียบร้อย');
        id('recTitle').value = ''; id('recDetail').value = ''; id('recRefPmWi').value = ''; id('recApprover').value = '';
        importBCT(true);
      } else { status('❌ ' + (res.error || 'ส่งไม่สำเร็จ')); }
    });
  }

  function respondIssue(data) { /* เก็บชื่อเดิมเผื่อเรียกจากที่อื่น */ return respondRec(data); }

  function respondRec() {
    var recId = id('respRecPick').value;
    if (!recId) { status('⚠️ เลือกเลขข้อเสนอแนะก่อน'); return; }
    var decision = id('respDecision').value;
    var payload = {
      REC_ID: recId,
      BU_DECISION: decision,
      EVIDENCE_URL: id('respEvidence').value.trim(),
      NO_FIX_REASON: id('respReason').value.trim(),
      RESPONSIBLE: id('respResponsible').value.trim(),
      BY: id('respBy').value.trim() || 'BU'
    };
    if (decision === 'ไม่แก้ไข' && (!payload.NO_FIX_REASON || !payload.RESPONSIBLE)) {
      status('⚠️ ไม่แก้ไขต้องใส่เหตุผล + ชื่อผู้รับผิดชอบ ตามคำสั่งพี่หนึ่ง'); return;
    }
    if (decision === 'แก้ไข' && !payload.EVIDENCE_URL) {
      var ok = confirm('ยังไม่ได้ใส่ลิงก์หลักฐานการแก้ไข — จะส่งโดยไม่มีหลักฐานหรือไม่?');
      if (!ok) return;
    }
    postToBCT('respond_issue', payload, function (res) {
      if (res.ok) { status('✅ บันทึกคำตอบของ BU แล้ว (' + recId + ' → ' + decision + ')'); importBCT(true); }
      else status('❌ ' + (res.error || 'ส่งไม่สำเร็จ'));
    });
  }

  /* GAS รับได้ทั้ง text/plain (เลี่ยง preflight) — ส่งตรงถึง doPost */
  function postToBCT(action, payload, cb) {
    var base = apiURL();
    if (!base) { alert('ตั้งค่า BCT API URL ก่อน (แท็บ BCT Import/Export)'); return; }
    status('กำลังส่งเข้า BCT…');
    fetch(base, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: action, data: payload })
    }).then(function (r) { return r.json(); }).then(cb)
      .catch(function (e) { status('❌ ผิดพลาด: ' + e); });
  }

  /* ---------- แท็บคู่มือ (โหลด GAT-MANUAL.md) ---------- */
  function mdLite(md) {
    var t = esc(md);
    t = t.replace(/^### (.*)$/gm, '<h4 style="margin:14px 0 6px;color:#1d3557">$1</h4>');
    t = t.replace(/^## (.*)$/gm, '<h3 style="margin:18px 0 8px;color:#13294b">$1</h3>');
    t = t.replace(/^# (.*)$/gm, '<h2 style="margin:8px 0 12px;color:#13294b">$1</h2>');
    t = t.replace(/^---$/gm, '<hr style="border:none;border-top:1px solid #dbe2ea;margin:14px 0">');
    t = t.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
    t = t.replace(/`([^`]+)`/g, '<code class="mono">$1</code>');
    t = t.replace(/^> (.*)$/gm, '<div class="note">$1</div>');
    t = t.replace(/^\| .*\|$/gm, function (row) { return '<span style="display:block;font-size:13px"><span class="mono">' + row.trim() + '</span></span>'; });
    t = t.replace(/^- (.*)$/gm, '<div style="margin:3px 0 3px 14px">· $1</div>');
    return t;
  }
  function loadManual() {
    var box = id('manBody'); if (!box) return;
    fetch('GAT-MANUAL.md?v=' + Date.now()).then(function (r) { return r.text(); }).then(function (md) {
      box.innerHTML = '<div class="card"><div class="md-body">' + mdLite(md) + '</div></div>';
    }).catch(function () { box.innerHTML = '<div class="empty">โหลดคู่มือไม่สำเร็จ — ดูไฟล์ GAT-MANUAL.md ใน repo</div>'; });
  }

  /* ---------- events / boot ---------- */
  function boot() {
    loadRunState();
    id('btnImport').addEventListener('click', importBCT);
    id('btnSeed').addEventListener('click', function () { status('โหลด seed…'); loadSeed().then(function () { status('✅ seed (xlsx) โหลดแล้ว ' + state.registers.length + ' รายการ'); }); });
    id('buFilter').addEventListener('change', function () { state.filter.bu = this.value; state.page = 1; renderAll(); });
    id('typeFilter').addEventListener('change', function () { state.filter.type = this.value; state.page = 1; renderAll(); });
    id('qFilter').addEventListener('input', function () { state.filter.q = this.value; state.page = 1; renderRegisters(); renderDash(); });
    document.body.addEventListener('click', function (e) {
      if (e.target.classList.contains('lnk')) {
        state.filter.bu = e.target.getAttribute('data-bu'); state.page = 1; renderAll(); showTab('registers');
      }
    });
    id('btnOpenRec').addEventListener('click', openRec);
    id('btnDraftRec').addEventListener('click', function () {
      var i = parseInt(id('recRegPick').value, 10);
      var r = (!isNaN(i) && state.registers[i]) ? state.registers[i] : null;
      var title = id('recTitle').value.trim() || (r ? r.TITLE : '');
      var text = [
        'ข้อเสนอแนะ GAT (โครงสำรอง — ส่งทางเว็บจะรันเลขให้เอง)',
        'ป้ายระดับ: ' + id('recSev').value,
        'หัวข้อ: ' + title,
        'รายละเอียด: ' + id('recDetail').value.trim(),
        'อ้างต้นเรื่อง: ' + (r ? r.REG_ID + ' (' + (r.SOURCE || '-') + ')' : '-'),
        'ผู้ออก: ' + (id('recBy').value || 'GAT')
      ].join('\n');
      download('gat-rec-draft.txt', text, 'text/plain;charset=utf-8');
    });
    id('btnRespond').addEventListener('click', respondRec);

    // v1.9 — ปิดใบ (GAT ยืนยัน)
    var b7 = id('btnCloseRec');
    if (b7) b7.addEventListener('click', function () {
      var recId = id('closeRecPick').value;
      var st = function (t) { status(t); };
      if (!recId) { st('⚠️ เลือกใบที่ BU ตอบแล้วก่อน'); return; }
      var by = id('closeBy').value.trim() || 'GAT';
      postToBCT('close_issue', { REC_ID: recId, BY: by }, function (res) {
        if (res.ok) { st('🔒 ปิดใบ ' + recId + ' แล้ว — บันทึกชีต + AuditLog'); importBCT(true); }
        else st('❌ ' + (res.error || 'ปิดไม่สำเร็จ'));
      });
    });

    // v1.8 — Packs + AI Review
    var b1 = id('btnSendPack'); if (b1) b1.addEventListener('click', sendPack);
    var b2 = id('btnLoadPacks'); if (b2) b2.addEventListener('click', loadPacks);
    var b3 = id('btnAiBuild'); if (b3) b3.addEventListener('click', function(){ aiBuildPrompt(id('aiPackPick').value); });
    var b4 = id('btnAiCopy'); if (b4) b4.addEventListener('click', function(){ var t=id('aiPrompt'); t.select(); try{document.execCommand('copy'); status('📋 คัดลอกชุดคำสั่ง AI แล้ว');}catch(e){} });
    var b5 = id('btnAiParse'); if (b5) b5.addEventListener('click', aiParse);
    var b6 = id('btnAiEmit'); if (b6) b6.addEventListener('click', aiEmit);
    id('respDecision').addEventListener('change', function () {
      var noFix = this.value === 'ไม่แก้ไข';
      id('respReason').disabled = !noFix; id('respResponsible').disabled = !noFix;
      id('respEvidence').disabled = noFix;
      id('respReason').placeholder = noFix ? 'เหตุผลการไม่แก้ไข (บังคับ)' : '— (เฉพาะกรณีไม่แก้ไข) —';
    });
    showTab('dashboard');
    loadSeed();
    if (window.GAT_CONFIG.BCT_API) { id('bctApiUrl').value = window.GAT_CONFIG.BCT_API; }
  }
  document.addEventListener('DOMContentLoaded', boot);

  var TAB_NAMES = { dashboard: 'Dashboard', registers: 'Registers', bct: 'BCT Import/Export', recs: 'ข้อเสนอแนะ', universe: 'Regulatory Universe', summary: 'สรุปผลงาน GAT', process: 'กระบวนการทีม GAT', runner: 'เดินกระบวนการ (Runner)', manual: 'คู่มือการใช้งาน', report: 'รายงานผู้บริหาร', qms: 'QMS Document' };

  /* ---------- แท็บเดินกระบวนการ (Process Runner) — ให้ทีมเดินตาม CORE ทีละขั้น ---------- */
  var RUN_STEPS = [
    { id: 'P-01', check: ['เลือกขอบเขตจาก 3 แหล่ง (ปฏิทิน / ทะเบียน 🟡🔴 / เหตุเร่งด่วน) แล้ว', 'ระบุเจ้าของด้าน (คน/ลูกค้า/การเงิน) ครบทุกหัวข้อ', 'รอหัวหน้าสาย Audit อนุมัติแผนแล้ว'], act: null, actLabel: null },
    { id: 'P-02', check: ['แจ้งแผน + รายการขอข้อมูลให้ BU แล้ว (ล่วงหน้า 14 วัน)', 'ระบุกำหนดส่ง (SLA 3 วันทำการ / ด่วน LCT 24 ชม.) ในหนังสือทุกครั้ง'], act: null, actLabel: null },
    { id: 'P-03', check: ['BU ส่งสำเนาไฟล์เข้าระบบแล้ว (ห้ามแก้ต้นฉบับ)', 'จด «ชีท+แถว» ที่อ่านครบทุกไฟล์', 'บันทึกรอบส่งลง GAT_Entries แล้ว'], act: 'bct', actLabel: 'บันทึกที่แท็บ BCT → ชีท GAT_Entries' },
    { id: 'P-04', check: ['ตรวจตาม Checklist ของขอบเขตนั้นแล้ว', 'ข้อพบมี หลักฐาน + เกณฑ์อ้างอิง + แนวทางบรรเทา ครบทุกใบ', 'อ้างกฎหมาย = ฉบับจริง + วันบังคับใช้ (ไม่พบ = เขียน «ไม่พบในไฟล์»)'], act: 'recs', actLabel: 'ออกใบที่แท็บ ข้อเสนอแนะ (รันเลข GAT-REC อัตโนมัติ)' },
    { id: 'P-05', check: ['ส่งใบประเด็นให้ Process Owner/BU แล้ว', 'ติดตามคำตอบ (แก้=หลักฐาน / ไม่แก้=เหตุผล+ผู้รับผิดชอบ) ภายใน 5 วันทำการ', 'ช่องคำตอบครบทุกช่องแล้ว (ขาด = ยังไม่นับตอบ)'], act: 'recs', actLabel: 'บันทึกคำตอบที่แท็บ ข้อเสนอแนะ (ช่อง BU ตอบ)' },
    { id: 'P-06', check: ['ตรวจหลักฐานการแก้แล้ว (พอ/ไม่พอ ชัดเจน)', '🔴 ที่ไม่แก้ = ยืนยันกลับเป็นทางการแล้ว', 'ติดตามรอบถัดไป / ถดถอย 30/60/90 วัน ลงระบบแล้ว'], act: 'recs', actLabel: 'ปิดรายการ (GAT ยืนยัน) ที่แท็บ ข้อเสนอแนะ' },
    { id: 'P-07', check: ['BU อุทธรณ์ภายใน 7 วัน (ถ้ามี)', 'OAC ตัดสิน = จบที่การตัดสิน (บันทึก GAT_AuditLog แล้ว)', 'High ระหว่างอุทธรณ์: มีมาตรการป้องกันชั่วคราวแล้ว'], act: null, actLabel: null },
    { id: 'P-08', check: ['รายงานฉบับสมบูรณ์ก่อนวันที่ 5 ของเดือนถัดไป', 'คุมถดถอย 30/60/90 วัน ลงระบบแล้ว', 'ส่งผู้มีอำนาจ/OAC + นัดประชุมทบทวน 🔴 ค้าง'], act: 'summary', actLabel: 'สรุปที่แท็บ สรุปผลงาน (คัดลอก/ดาวน์โหลด .md)' },
    { id: 'P-09', check: ['อัปเดตสถานะ 5 ระดับ (🟢🟡🟠🔴⚫) ให้ทะเบียนล่าสุดแล้ว', 'นำเข้าข้อมูล live จาก BCT แล้ว', 'ตรวจว่าไม่มีรายการสถานะตกยุค'], act: 'dashboard', actLabel: 'ตรวจที่แท็บ Dashboard (KPI สด)' },
    { id: 'P-10', check: ['คัดลอก bct-template.xlsx แล้ว', 'ติดตั้ง GAS bridge + วาง Web App URL แล้ว', 'เว็บเชื่อม live ตรวจแล้ว (import สำเร็จ)'], act: 'bct', actLabel: 'ตั้งค่าที่แท็บ BCT Import/Export' }
  ];
  function renderRunner() {
    var box = id('runBody'); if (!box) return;
    var j = state.process || {};
    var core = j.CORE || [];
    var prog = state.runState || {}; // { 'P-01': [true,true,false], ... }
    var totalChk = 0, doneChk = 0;
    RUN_STEPS.forEach(function (s) { (prog[s.id] || []).forEach(function (v) { totalChk++; if (v) doneChk++; }); });
    var h = [];
    h.push('<div class="hero"><div class="goldlbl">Process Runner · เดินตามกระบวนการทุกขั้น</div><h2>🚦 เดินกระบวนการ CORE 10 (P-01 → P-10)</h2><p>แต่ละขั้นมี Checklist ให้ติ๊ก — ครบทุกข้อ = ผ่านขั้น · ปุ่มข้างการ์ดกระโดไปทำจริงในแท็บนั้นทันที · ความคืบหน้าบันทึกในเครื่องนี้ (localStorage)</p></div>');
    h.push('<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:16px">');
    h.push(kpi('ผ่านแล้ว', fmt(doneChk) + ' / ' + fmt(totalChk), 'ข้อที่ติ๊กครบ') + kpi('ขั้นที่ผ่านหมด', fmt(RUN_STEPS.filter(function (s) { var c = prog[s.id] || []; return c.length && c.every(function (v) { return v; }); }).length) + ' / 10', 'ครบทุก checklist') + kpi('ขั้นถัดไป', (RUN_STEPS.filter(function (s) { var c = prog[s.id] || []; return !c.length || !c.every(function (v) { return v; }); })[0] || {}).id || 'ครบทุกขั้น 🎉', 'ทำต่อจากนี้'));
    h.push('</div>');
    RUN_STEPS.forEach(function (s, ix) {
      var meta = core.filter(function (c) { return c.id === s.id; })[0] || {};
      var checks = prog[s.id] || [];
      var done = checks.length > 0 && s.check.every(function (_, i) { return checks[i]; });
      h.push('<div class="card" style="border-left:5px solid ' + (done ? '#0e8345' : '#b48a3c') + '">');
      h.push('<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><h3 style="margin:0">' + (done ? '✅' : '▶️') + ' ขั้นที่ ' + (ix + 1) + ' — ' + esc(s.id) + ' ' + esc(meta.name || '') + (meta.sla ? ' <span style="font-size:12px;color:#b48a3c;font-weight:600">' + esc(meta.sla) + '</span>' : '') + '</h3><div style="display:flex;gap:6px;flex-wrap:wrap">' +
        '<button class="rb-act" data-rundoc="' + s.id + '" style="margin-bottom:6px">📄 เอกสาร PM เต็ม</button>' +
        (s.act ? '<button class="rb-act" data-runact="' + s.act + '" style="margin-bottom:6px">' + esc(s.actLabel || 'ไปทำจริง') + '</button>' : '') + '</div></div>');
      h.push('<div style="font-size:13px;color:#51617a;margin-bottom:8px">PM: ' + esc(String(meta.pm || '').slice(0, 120)) + (String(meta.pm || '').length > 120 ? '…' : '') + '</div>');
      h.push('<table class="tbl">' + s.check.map(function (c, i) {
        return '<tr><td style="width:34px;text-align:center"><input type="checkbox" class="rb-chk" data-rstep="' + s.id + '" data-rchk="' + i + '"' + (checks[i] ? ' checked' : '') + '></td><td style="font-size:13.5px">' + esc(c) + '</td></tr>';
      }).join('') + '</table></div>');
    });
    h.push('<div class="note">การทำจริงยังเกิดในแท็บปลายทาง (BCT / ข้อเสนอแนะ / สรุปผลงาน / Dashboard) — Runner ช่วยลำดับ+ไม่พลาดขั้น+ไม่พลาดหลักฐาน ตามหลัก «ผู้ปฏิบัติต้องอ่านแล้วทำตามได้จริง» ของ WI</div>');
    box.innerHTML = h.join('');
  }
  function saveRunState() {
    try { localStorage.setItem('gat_run_state', JSON.stringify(state.runState || {})); } catch (e) {}
  }
  function loadRunState() {
    try { state.runState = JSON.parse(localStorage.getItem('gat_run_state') || '{}'); } catch (e) { state.runState = {}; }
  }
  function showTab(name) {
    document.querySelectorAll('.tabpane').forEach(function (p) { p.classList.remove('on'); p.style.display = 'none'; });
    var t = id('pane-' + name);
    if (t) { t.classList.add('on'); t.style.display = 'block'; }
    document.querySelectorAll('nav a').forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-tab') === name); });
    var c = id('crumbTab'); if (c) c.textContent = TAB_NAMES[name] || name;
    var sb = document.getElementById('sidebar'); if (sb && sb.classList) sb.classList.remove('open');
    if (name === 'manual' && !showTab._manLoaded) { showTab._manLoaded = true; loadManual(); }
    if (name === 'runner') { renderRunner(); }
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('nav a');
    if (a) { e.preventDefault(); showTab(a.getAttribute('data-tab')); return; }
    var pp = e.target.getAttribute && e.target.getAttribute('data-pg');
    if (pp) { state.page = parseInt(pp, 10) || 1; renderRegisters(); return; }
    var cp = e.target.closest && e.target.closest('.copy-id');
    if (cp) { var ct = cp.getAttribute('data-rid') || cp.textContent; copyText(ct, '📋 คัดลอกรหัสแล้ว: ' + ct); }
    if (e.target.classList && e.target.classList.contains('rb-chk')) { // Runner checklist ติ๊ก
      var rs = e.target.getAttribute('data-rstep'), ri = parseInt(e.target.getAttribute('data-rchk'), 10);
      state.runState = state.runState || {};
      var arr = state.runState[rs] || [];
      arr[ri] = e.target.checked; state.runState[rs] = arr; saveRunState(); renderRunner();
      return;
    }
    var ra = e.target.getAttribute && e.target.getAttribute('data-runact');
    if (ra) { showTab(ra === 'recs' ? 'recs' : ra); return; }
    var rd = e.target.getAttribute && e.target.getAttribute('data-rundoc');
    if (rd) { // เปิดเอกสาร PM เต็มของขั้นนั้น (แท็บกระบวนการ → เลข index ใน PM_DOCS)
      var pd = (state.process || {}).meta ? (state.process.meta.PM_DOCS || []) : [];
      var ix = -1;
      pd.forEach(function (p, i2) { if (p.id === rd) ix = i2; });
      showTab('process');
      setTimeout(function () {
        var btn = document.querySelector('[data-pmdoc="' + ix + '"]');
        if (btn) btn.click();
        var card = id('pmdocs'); if (card) card.scrollIntoView({ behavior: 'smooth' });
      }, 50);
      return;
    }
  });

  /* export ชุด register ปัจจุบันกลับเข้ารูปแบบ BCT (CSV คอลัมน์ตรง GAT_Registers) */
  function exportForBCT() {
    var regs = filtered();
    var head = ['REG_ID', 'BU', 'PROCESS_TYPE', 'PROCESS_CODE', 'TITLE', 'REGULATOR', 'LAW_RULE', 'REQUIREMENT', 'DOCUMENT', 'DUE_DATE', 'FREQUENCY', 'OWNER', 'COMPLIANCE_REVIEWER', 'LEGAL', 'SIGNATORY', 'STATUS', 'EVIDENCE', 'SOURCE'];
    var rows = [head].concat(regs.map(function (r) {
      return head.map(function (h) { return r[h] != null ? r[h] : ''; });
    }));
    download('gat-registers-for-BCT.csv', csv(rows));
    status('ส่งออก CSV สำหรับวางลงชีท GAT_Registers บน BCT แล้ว (' + regs.length + ' รายการ)');
  }

  return { showTab: showTab, exportForBCT: exportForBCT, buildReport: buildReport, state: function () { return state; }, _draft: draftIssue, renderSummary: renderSummary, loadProcess: loadProcess, renderRunner: renderRunner,
    _renderPacks: renderPacks, _fillPackSelectors: fillPackSelectors, _aiBuildPrompt: aiBuildPrompt, _aiParse: aiParse, _aiEmit: aiEmit, _loadPacks: loadPacks, _renderRecs: renderRecs };
})();