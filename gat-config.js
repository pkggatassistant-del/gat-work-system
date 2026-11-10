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
  VERSION: 'v1.36 (10 พ.ย. 69) — แท็บ 3 ตามคำสั่ง "ตัดตรงนี้ออก เพราะมีตรงส่วนนี้แล้ว": ตัดกล่องลิงก์ดิบ "หลักฐานที่ BU แนบ:" ออกจากหัวเรื่องการตรวจ — ลิงก์คลิกได้อยู่ต่อแถวในตารางตรวจแล้ว; PACK โครงเก่า (ลิงก์ดิบไม่มีบล็อกประเด็น) สร้าง 1 แถว"หลักฐานที่ BU แนบ" ให้ตรวจต่อได้',

  // ปิดท้ายด้วย '/' เมื่อติดตั้งจริง - ตัวอย่าง: https://script.google.com/macros/s/AKfy.../exec
  BCT_API: (localStorage.getItem('gat_bct_api') || 'https://script.google.com/macros/s/AKfycbzuKrVSmPSphudtgIgmREMBiYYYETUNsTsyCzrUKgZ3C08Is1A-pf3Vsvadj7R8ArOv/exec'), // v1.27.1 default = GAS v1.7 (deploy ใหม่ 5 พ.ย. 69 — tabs_status 10/10 ผ่าน; เปลี่ยนเองได้ในแท็บ BCT Import/Export)
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