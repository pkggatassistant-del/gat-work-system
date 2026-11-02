# GAT Work System — ระบบงาน General Audit Team (กลุ่ม PKG)

ระบบงานเฉพาะ GAT: กระบวนการ **PM / WI / SD / FM** + เชื่อม Google Sheet **BCT** (บอร์ด BU บันทึกรายการตรวจสอบ) + ออก**ข้อเสนอแนะรันเลข** GAT-REC-xxxx ให้ BU ตอบ (แก้ไข→แนบหลักฐาน / ไม่แก้→เหตุผล+ผู้รับผิดชอบ)

**เว็บใช้งาน:** https://pkggatassistant-del.github.io/gat-work-system/
- ตัวอย่าง: `gat/index.html`

## ชีท BCT กลาง
- Google Sheet: `1MK4ufs2ycbJg81ZVaqeJb0z3MEaflAMVZmKqmhkrZ1E` (ชีท: GAT_Registers / GAT_Entries / GAT_Issues / GAT_AuditLog)
- GAS: `gas-bct-bridge.js` — actions: `open_issue` / `respond_issue` / `close_issue` + GET: `overview` / `list_registers` / `list_recs` / `list_entries`

## ติดตั้งฐานใหม่
ใช้ `bct-template.xlsx` (อัปโหลดขึ้น Drive → Open with Google Sheets → วาง GAS → Deploy)

## เอกสาร
- [GAT-SYSTEM-BLUEPRINT.md](GAT-SYSTEM-BLUEPRINT.md) — แผนผังระบบ + โร้ดแมป
- [GAT-WORKFLOW-SOP.md](GAT-WORKFLOW-SOP.md) — SOP วงจรงาน 5 ขั้น (No Review → No Sign → No Submission)

---
ระบบเดิมบน web-pp7 ยังทำงานปกติ — repo นี้คือเวอร์ชันเฉพาะ GAT ที่แยกตั้งแต่ 2 พ.ย. 2569
