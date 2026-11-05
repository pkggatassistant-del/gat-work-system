/* GAT Work System — shared config (โหลดก่อน app.js เสมอ) */
window.GAT_CONFIG = {
  REC_SCOPE: ['GAT-REC-0042','GAT-REC-0043','GAT-REC-0044','GAT-REC-0045','GAT-REC-0046','GAT-REC-0047','GAT-REC-0048','GAT-REC-0049','GAT-REC-0050','GAT-REC-0051'], // v1.10 โหมดทดสอบเรื่องเดียว (GA-LC) — เคลียร์ [] เพื่อโชว์ทุกใบ
  VERSION: 'v1.26 (5 พ.ย. 69) — ขั้น 2 ใหม่: BU เลือกประเด็นจากขั้น 1 + แนบหลักฐานบังคับต่อประเด็น (ไม่มี = ไม่บันทึก) → เข้าขั้น 3 ตามประเด็น; default BCT_API = deploy ③',
  // ปิดท้ายด้วย '/' เมื่อติดตั้งจริง — ตัวอย่าง: https://script.google.com/macros/s/AKfy.../exec
  BCT_API: (localStorage.getItem('gat_bct_api') || 'https://script.google.com/macros/s/AKfycbxNc3kI6eb2S7zEkZ-ZL51lsx9QP9OnQ3WEfnV0bJEDscndZ4CqGSIXqsPeSHj7PB-n/exec'), // v1.26 default = deploy ③ (GAS v1.7 — ใช้จริงเมื่อหนึ่ง deploy v1.7 แล้ว; เปลี่ยนเองได้ในแท็บ BCT Import/Export)
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