/* GAT Work System — shared config (โหลดก่อน app.js เสมอ) */
window.GAT_CONFIG = {
  VERSION: 'v1.0 (2 พ.ย. 2569)',
  // ปิดท้ายด้วย '/' เมื่อติดตั้งจริง — ตัวอย่าง: https://script.google.com/macros/s/AKfy.../exec
  BCT_API: (localStorage.getItem('gat_bct_api') || 'https://script.google.com/macros/s/AKfycbw-R9GpWKraNLagP3GTsa5ff8TxAmbt89JUkNP9ROX-xVfBy8lIpvFWmBiefMKpOXmCgg/exec'), // BCT กลาง — deploy จริง 2 พ.ย. 69 (localStorage ทับได้)
  SOURCES: {
    // อ้างไฟล์เทียบตำแหน่ง index.html (ทำงานได้ทั้งบน GitHub Pages และ local)
    SEED: 'gat-seed.json',            // ข้อมูลตั้งต้นจาก PKG_Compliance_plan_2026-30.xlsx
    REC_SEED: 'gat-rec-migration.json', // ข้อเสนอแนะชุดแรก F-01–F-15 (สวัสดิการ 29 ต.ค. 69)
    BCT: 'BCT (Google Sheet บอร์ด BU)'    // live ผ่าน BCT_API
  },
  PROCESS_TYPES: {
    PM: { label: 'PM — การจัดการแผนงาน', color: '#2563eb' },
    WI: { label: 'WI — แนวปฏิบัติงาน', color: '#0891b2' },
    SD: { label: 'SD — มาตรฐาน/เอกสาร', color: '#7c3aed' },
    FM: { label: 'FM — แบบฟอร์ม/รายงาน', color: '#b45309' }
  },
  // กติกากลาง (gat-workflow-sop.md + xlsx การฝ่าฝืน 7 ข้อ)
  RULES: {
    SEVERITY: ['🔴 ขัดกฎหมาย/จำเป็นจริง', '🟢 ข้อเสนอ'],
    ENTRY_RESULTS: ['ส่งแล้ว/ตรงเวลา', 'ส่งล่าช้า', 'ยังไม่ส่ง', 'พบประเด็น']
  }
};