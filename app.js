/* ============================================================
 * GAT Work System — แอปหลัก (Dashboard + Registers + BCT)
 * โครงสร้าง: 6 แท็บ
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
    registersBCT: [],
    lastImport: null,
    filter: { bu: '', type: '', q: '' }
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
    Promise.all([gasGet('list_registers'), gasGet('list_entries'), gasGet('list_recs').catch(function(){return gasGet('list_issues');})])
      .then(function (res) {
        state.registersBCT = (res[0].ok ? res[0].data : []);
        state.entries = (res[1].ok ? res[1].data : []);
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
    renderDash(); renderRegisters(); renderUniverse(); renderRecs();
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
    regs.forEach(function (r) { buby[r.BU] = (buby[r.BU] || 0) + 1; });
    var buRows = Object.keys(buby).sort().map(function (bu) {
      return '<tr><td><a class="lnk" data-bu="' + esc(bu) + '">' + esc(bu) + '</a></td><td>' + buby[bu] + '</td></tr>';
    }).join('');
    id('kpiRow').innerHTML =
      kpi('รายการตรวจสอบ (Registers)', fmt(regs.length), 'จากทุกแหล่ง') +
      kpi('🟢 ปกติ', fmt(byStat['🟢']), 'มีข้อมูล/ผ่าน') +
      kpi('🟡 รอข้อมูลจริง', fmt(byStat['🟡']), 'ต้องติดตาม BU') +
      kpi('🔴 ช่องว่าง', fmt(byStat['🔴']), 'ยังไม่มีระบบ/ข้อมูล') +
      kpi('รายการบันทึก (BCT Entries)', fmt(state.entries.length), 'live จากชีท') +
      kpi('ข้อเสนอแนะเปิดอยู่', fmt(state.recs.filter(function (x) { return String(x.STATUS).indexOf('ปิด') < 0; }).length), 'รันเลข GAT-REC-xxxx') +
      kpi('BU ไม่แก้ไข (รอ GAT ยืนยัน)', fmt(state.recs.filter(function (x) { return String(x.STATUS || '').indexOf('ไม่แก้') >= 0 && String(x.STATUS).indexOf('ปิด') < 0; }).length), 'ต้องยืนยันกลับตาม SOP ⑤');
    id('dashBody').innerHTML =
      '<div class="cols2">' +
      '<div class="card"><h3>ตามประเภทกระบวนการ</h3>' + barChart(byType, window.GAT_CONFIG.PROCESS_TYPES) + '</div>' +
      '<div class="card"><h3>ตาม BU (กดเพื่อกรอง)</h3><table class="tbl"><thead><tr><th>BU/กลุ่ม</th><th>รายการ</th></tr></thead><tbody>' + buRows + '</tbody></table></div>' +
      '</div>' +
      '<div class="card"><h3>กระบวนการ 9 ขั้น (Regulatory Submission Control)</h3>' +
      '<ol class="flow">' + ['Requirement Identified', 'BU Prepare', 'BU Review', 'Compliance Check', 'Legal Consult', 'Approve & Sign', 'Submit', 'Evidence Archive', 'Dashboard'].map(function (s, i) {
        return '<li><b>' + (i + 1) + '. ' + s + '</b></li>';
      }).join('<li class="arw">→</li>') + '</ol>' +
      '<div class="note">หลักการ: <b>No Review → No Sign → No Submission</b> — ทุกรายการใน Registers เดินตามกระบวนการนี้บน BCT ก่อนขึ้น Dashboard</div></div>';
  }
  function kpi(label, big, sub) {
    return '<div class="card kpi"><div class="l">' + esc(label) + '</div><div class="b">' + big + '</div><div class="s">' + esc(sub) + '</div></div>';
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

  function renderRegisters() {
    var regs = filtered().slice(0, 400);
    var opts = uniqueCol('BU').map(function (b) {
      return '<option' + (state.filter.bu === b ? ' selected' : '') + '>' + esc(b) + '</option>';
    }).join('');
    id('buFilter').innerHTML = '<option value="">— BU ทั้งหมด —</option>' + opts;
    id('buFilter').value = state.filter.bu;
    id('regBody').innerHTML = regs.map(function (r) {
      return '<tr><td class="mono">' + esc(r.REG_ID) + '</td><td>' + esc(r.BU) +
        '</td><td><span class="chip" data-tp="' + esc(r.PROCESS_TYPE) + '">' + esc(r.PROCESS_TYPE) + '</span></td><td>' + esc(r.TITLE) +
        '</td><td>' + esc(r.REGULATOR || '') + '</td><td>' + esc(r.FREQUENCY || '') +
        '</td><td>' + esc((r.OWNER || '') + (r.SIGNATORY ? ' · ลงนาม: ' + r.SIGNATORY : '')) +
        '</td><td class="stat">' + esc(r.STATUS || '') + '</td><td class="mono src">' + esc(r.SOURCE || '') + '</td></tr>';
    }).join('') || '<tr><td colspan="9" class="empty">ไม่มีข้อมูลตรงเงื่อนไข</td></tr>';
    id('regCount').textContent = 'แสดง ' + regs.length + ' / ทั้งหมด ' + state.registers.length;
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
    rp.innerHTML = '<option value="">— เลือกเลขข้อเสนอแนะ —</option>' + state.recs.map(function (x) {
      return '<option value="' + esc(x.REC_ID) + '">' + esc(x.REC_ID) + (x.REC_NO ? ' (#' + esc(x.REC_NO) + ')' : '') + ' · ' + esc(String(x.TITLE || '').slice(0, 40)) + '</option>';
    }).join('');
    rp.value = cur;
    var list = state.recs;
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
      BY: id('recBy').value.trim() || 'GAT'
    };
    postToBCT('open_issue', payload, function (res) {
      if (res.ok) {
        status('✅ รันเลขแล้ว: ' + res.REC_ID + ' (#' + res.REC_NO + ') — ส่งเข้าชีท ' + (window.GAT_CONFIG.SHEETS ? window.GAT_CONFIG.SHEETS.RECS : 'GAT_Issues') + ' บน BCT เรียบร้อย');
        id('recTitle').value = ''; id('recDetail').value = '';
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

  /* ---------- events / boot ---------- */
  function boot() {
    id('btnImport').addEventListener('click', importBCT);
    id('btnSeed').addEventListener('click', function () { status('โหลด seed…'); loadSeed().then(function () { status('✅ seed (xlsx) โหลดแล้ว ' + state.registers.length + ' รายการ'); }); });
    id('buFilter').addEventListener('change', function () { state.filter.bu = this.value; renderAll(); });
    id('typeFilter').addEventListener('change', function () { state.filter.type = this.value; renderAll(); });
    id('qFilter').addEventListener('input', function () { state.filter.q = this.value; renderRegisters(); renderDash(); });
    document.body.addEventListener('click', function (e) {
      if (e.target.classList.contains('lnk')) {
        state.filter.bu = e.target.getAttribute('data-bu'); renderAll(); showTab('registers');
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

  function showTab(name) {
    document.querySelectorAll('.tabpane').forEach(function (p) { p.style.display = 'none'; });
    var t = id('pane-' + name); if (t) t.style.display = 'block';
    document.querySelectorAll('.nav a').forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-tab') === name); });
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('.nav a');
    if (a) { e.preventDefault(); showTab(a.getAttribute('data-tab')); }
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

  return { showTab: showTab, exportForBCT: exportForBCT, buildReport: buildReport, state: function () { return state; }, _draft: draftIssue };
})();