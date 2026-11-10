/* GAT Work System - shared config (โหลดก่อน app.js เสมอ) */
/* v1.27.1 — auto-migrate: localStorage เก่าที่ชี้ deployment เก่า (< v1.7) จะถูกเขียนทับเป็น URL ใหม่อัตโนมัติ (ที่มา: หนึ่ง deploy ใหม่ชุด 5 พ.ย. 69) */
(function(){
  var NEW_API='https://script.google.com/macros/s/AKfycbzuKrVSmPSphudtgIgmREMBiYYYETUNsTsyCzrUKgZ3C08Is1A-pf3Vsvadj7R8ArOv/exec';
  var OLD_MARKER='AKfycbxNc3kI6eb2S7zEkZ';
  try{
    var cur=localStorage.getItem('gat_bct_api');
    if(!cur){ localStorage.setItem('gat_bct_api',NEW_API); }
    else if(cur.indexOf(OLD_MARKER)>=0){ localStorage.setItem('gat_bct_api',NEW_API); }
  }catch(e){}
})();

window.GAT_CONFIG = {
  REC_SCOPE: ['GAT-REC-0042','GAT-REC-0043','GAT-REC-0044','GAT-REC-0045','GAT-REC-0046','GAT-REC-0047','GAT-REC-0048','GAT-REC-0049','GAT-REC-0050','GAT-REC-0051'], // v1.10 โหมดทดสอบเรื่องเดียว (GA-LC) - เคลียร์ [] เพื่อโชว์ทุกใบ
  VERSION: 'v1.38.2 (10 พ.ย. 69) — แท็บ 5: dropdown ปิดประเด็นหลัก/ย่อย + การนับใบเปิด-ปิด = ไม่กรอง REC_SCOPE อีกต่อไป (โหมด scope ใช้กับตารางโชว์เท่านั้น — ใบจริงทุกใบเลือกได้ แม้เลขเกิน 0051); เดิม v1.38.1: BCT API = GAS v1.10.1 (URL ใหม่) + migrateBctApi ย้ายเครื่องเก่าอัตโนมัติ + เมนู "BCT Import/Export"; แท็บ 5 เปลี่ยนคำ ใหญ่→ย่อย (ตามสัท) + dropdown โชว์ชื่อเรื่องนำ',

  // ปิดท้ายด้วย '/' เมื่อติดตั้งจริง - ตัวอย่าง: https://script.google.com/macros/s/AKfy.../exec
  BCT_API: 'https://script.google.com/macros/s/AKfycbwkiyWP4UzOGNt6Ly-XV1Rztz7gaW9V6GuKZ_hSpWmUu9QMjUmDS0RUjbej784ewTxVig/exec', // v1.38.1 = GAS v1.10.1 (deploy ใหม่ 10 พ.ย. 69 — มีแท็บใบแจ้งประเด็น BU + NOTE ขั้น 3; เปลี่ยนเองได้ในแท็บ BCT Import/Export ที่เพิ่มเมนูซ้าย ฐานข้อมูล)
  SOURCES: {
    // อ้างไฟล์เทียบตําแหน่ง index.html (ทํางานได้ทั้งบน GitHub Pages และ local)
    SEED: 'gat-seed.json',            // ข้อมูลตั้งต้นจาก PKG_Compliance_plan_2026-30.xlsx
    REC_SEED: 'gat-rec-migration.json', // ข้อเสนอแนะชุดแรก F-01-F-15 (สวัสดิการ 29 ต.ค. 69)
    PROCESS_SEED: 'gat-process.json', // กระบวนการทํางานภายในทีม GAT (PM/WI/SD/FM ของทีมเอง)
    BCT: 'BCT (Google Sheet บอร์ด BU)'    // live ผ่าน BCT_API
  },
  PROCESS_TYPES: {
    PM: { label: 'PM - Process Management (ภาพการไหลของงาน)', color: '#2563eb' },
    WI: { label: 'WI - Work Instruction (คําสั่งติดตําแหน่ง)', color: '#0891b2' },
    SD: { label: 'SD - Supporting Document (เอกสารสนับสนุน)', color: '#7c3aed' },
    FM: { label: 'FM - Form/Format (แบบฟอร์มบันทึกผล)', color: '#b45309' }
  },
  // กติกากลาง (gat-workflow-sop.md + xlsx การฝ่าฝืน 7 ข้อ)
  RULES: {
    SEVERITY: ['🔴 ขัดกฎหมาย/จําเป็นจริง', '🟢 ข้อเสนอ'],
    ENTRY_RESULTS: ['ส่งแล้ว/ตรงเวลา', 'ส่งล่าช้า', 'ยังไม่ส่ง', 'พบประเด็น']
  }
};