# GAT Work System — ระบบงาน General Audit Team (กลุ่ม PKG)

ระบบงานเฉพาะ GAT: กระบวนการ **PM / WI / SD / FM** + เชื่อม Google Sheet **BCT** (บอร์ด BU บันทึกรายการตรวจสอบ) + ออก**ข้อเสนอแนะรันเลข** GAT-REC-xxxx ให้ BU ตอบ (แก้ไข→แนบหลักฐาน / ไม่แก้→เหตุผล+ผู้รับผิดชอบ)

**เว็บใช้งาน:** https://pkggatassistant-del.github.io/gat-work-system/

## Changelog
- **v1.4 (2 พ.ย. 69) — เริ่มทำกระบวนการใหม่ ตามนิยามเอกสาร 4 ประเภทที่พี่หนึ่งกำหนด:** gat-process.json **v2.0 รื้อใหม่ทั้งไฟล์** — PM=Process Management (ภาพการไหลของงานตั้งแต่ต้นจนจบ — วงจร 7 ขั้น/นำส่ง 9 ขั้น/การไหลข้อมูล/4 เลยอร์/บทบาท/ปลายทาง) · WI=Work Instruction (คำสั่งติดตำแหน่ง "📍 จุด:" 7 จุด ก่อนเปิดไฟล์/ก่อนออกใบ/ก่อนอ้างกฎหมาย/BU ไม่แก้/ข้อมูลลับ/ก่อนรายงาน/พบหลักฐานถูกแก้) · SD=Supporting Document (เอกสารสนับสนุน 6 รายการ: กฎบัตร/QMS/SOP/พรินต์/เทมเพลต/กฎหมายที่อ้าง) · FM=Form/Format (แบบฟอร์มบันทึกผล 5 แบบ — เดิมเท่าเดิม); label PROCESS_TYPES + หัวข้อสรุปผลงาน/KPI เปลี่ยนเป็นนิยามใหม่; hero แท็บกระบวนการแสดงนิยาม 4 ประเภท (สังเกตว่า GAT-QMS-001 v1.0 ไม่ต้องแก้ — ใช้ PM=Process Management/SD=Supporting Document/FM=Form ตรงตามตารางอยู่แล้วโดยโครงสร้าง); ตัวเลขคง 6/7/6/5=24 หัวข้อ; jsdom 11 ผ่าน
- **v1.3 (2 พ.ย. 69) — แก้นิยาม PM/WI/SD/FM ในสรุปผลงาน+Dashboard (ชี้โดยพี่หนึ่ง):** ตัวเลข "PM 100 · WI 9 · SD 17 · FM 58" เดิม = การนับทะเบียน 184 ใส่หมวด PM/WI/SD/FM — ตามนิยามที่ถูกต้อง PM/WI/SD/FM = เอกสารกระบวนการทีม GAT เอง (PM 6 · WI 7 · SD 6 · FM 5 = 24 หัวข้อ จาก gat-process.json); สรุปผลงานแยก "ข้อมูลที่ต้องตรวจ" (จริงรายบริษัท+โครงสร้างกำกับ 32) ออกจาก "เอกสารกระบวนการทีม" ชัดเจน; Dashboard เปลี่ยนกราฟแท่งเป็น "ตามแหล่งข้อมูล" (Universe/TAX_BU/9 ขั้น/7 ข้อ/เอกสาร 16/PMSG/live BCT); KPI ใหม่ "ข้อมูลจริง/รอเก็บ", "โครงสร้างกำกับ 32"; jsdom 11 จุดผ่าน
- **v1.2 (2 พ.ย. 69) — UI Enterprise Redesign:** เลย์เอาต์ sidebar แบบองค์กร (navy+gold design system) · ฟอนต์ IBM Plex Sans Thai/Inter · hero cover หน้ากระบวนการ · toast แทน alert bar · topbar นาฬิกา live · ตาราง Registers แบบ pagination (25/หน้า จากเดิมโชว์เต็ม 800 แถว) · คัดลอกรหัส REG_ID ด้วยคลิก · KPI dashboard สีแยกความเสี่ยง · responsive มือถือ (burger menu) · print stylesheet · ตรวจอัตโนมัติ jsdom 17 จุด
- **v1.1 (2 พ.ย. 69):** วงจรข้อเสนอแนะรันเลข (open→respond→close) ผ่าน live บน BCT + แท็บสรุปผลงาน + แท็บกระบวนการทีม (24 หัวข้อ)
- **v1.0 (2 พ.ย. 69):** ระบบฐาน 7 แท็บ + seed 184 รายการ + GAS bridge

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
