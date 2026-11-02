/* GAT Work System — shared config (โหลดก่อน app.js เสมอ) */
window.GAT_CONFIG = {
  VERSION: 'v1.5 (2 พ.ย. 69) — แท็บ "เดินกระบวนการ (Runner)" CORE 10 ขั้น + checklist + ปุ่มไปทำจริง', // นิยาม PM=Process Management · WI=Work Instruction · SD=Supporting Document · FM=Form/Format ตามตารางที่พี่หนึ่งให้ 2 พ.ย. 69; v1.3 = แยกข้อมูลตรวจ/เอกสารทีม
  // ปิดท้ายด้วย '/' เมื่อติดตั้งจริง — ตัวอย่าง: https://script.google.com/macros/s/AKfy.../exec
  BCT_API: (localStorage.getItem('gat_bct_api') || 'https://script.google.com/macros/s/AKfycbwkiyWP4UzOGNt6Ly-XV1Rztz7gaW9V6GuKZ_hSpWmUu9QMjUmDS0RUjbej784ewTxVig/exec'), // BCT กลาง — deploy ใหม่ 2 พ.ย. 69 (localStorage ทับได้)
  SOURCES: {
    // อ้างไฟล์เทียบตำแหน่ง index.html (ทำงานได้ทั้งบน GitHub Pages และ local)
    SEED: 'gat-seed.json',            // ข้อมูลตั้งต้นจาก PKG_Compliance_plan_2026-30.xlsx
    REC_SEED: 'gat-rec-migration.json', // ข้อเสนอแนะชุดแรก F-01–F-15 (สวัสดิการ 29 ต.ค. 69)
    PROCESS_SEED: 'gat-process.json', // กระบวนการทำงานภายในทีม GAT (PM/WI/SD/FM ของทีมเอง)
    BCT: 'BCT (Google Sheet บอร์ด BU)'    // live ผ่าน BCT_API
  },
  PROCESS_TYPES: {
    PM: { label: 'PM — Process Management (ภาพการไหลของงาน)', color: '#2563eb' },
    WI: { label: 'WI — Work Instruction (คำสั่งติดตำแหน่ง)', color: '#0891b2' },
    SD: { label: 'SD — Supporting Document (เอกสารสนับสนุน)', color: '#7c3aed' },
    FM: { label: 'FM — Form/Format (แบบฟอร์มบันทึกผล)', color: '#b45309' }
  },
  // กติกากลาง (gat-workflow-sop.md + xlsx การฝ่าฝืน 7 ข้อ)
  RULES: {
    SEVERITY: ['🔴 ขัดกฎหมาย/จำเป็นจริง', '🟢 ข้อเสนอ'],
    ENTRY_RESULTS: ['ส่งแล้ว/ตรงเวลา', 'ส่งล่าช้า', 'ยังไม่ส่ง', 'พบประเด็น']
  }
};