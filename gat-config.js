/* GAT Work System — shared config (โหลดก่อน app.js เสมอ) */
window.GAT_CONFIG = {
  REC_SCOPE: ['GAT-REC-0042','GAT-REC-0043','GAT-REC-0044','GAT-REC-0045','GAT-REC-0046','GAT-REC-0047','GAT-REC-0048','GAT-REC-0049','GAT-REC-0050','GAT-REC-0051'], // v1.10 โหมดทดสอบเรื่องเดียว (GA-LC) — เคลียร์ [] เพื่อโชว์ทุกใบ
  VERSION: 'v1.20 (4 พ.ย. 69) — แท็บ 1: แผนแจ้งมี checkbox ต่อเรื่อง — GAT ติ๊กเรื่องที่จะตรวจแล้วกดส่งเข้าขั้น 3 ได้ทันที (dropdown แท็บ 3 มีโหมดตามแผน __PLAN__ — ชุดคำสั่ง AI อ้างรายเรื่อง แม้ BU ยังไม่ส่ง PACK) (เทส jsdom 66 ผ่าน)',
  // ปิดท้ายด้วย '/' เมื่อติดตั้งจริง — ตัวอย่าง: https://script.google.com/macros/s/AKfy.../exec
  BCT_API: (localStorage.getItem('gat_bct_api') || 'https://script.google.com/macros/s/AKfycbwmSjODcZRoqLiYomSNtSwK1rZqSe9YTWRBFa1YaUdWdqr8I61aW7s4YAo1blzXRV2C/exec'), // BCT กลาง — deploy v1.5.1 ที่หนึ่ง deploy 4 พ.ย. 69 (standalone + SHEET_ID)
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