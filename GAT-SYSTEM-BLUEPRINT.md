# GAT Work System — Blueprint v1.0 (2 พ.ย. 2569)

**เป้าหมายตามคำสั่งพี่หนึ่ง:** สร้างระบบงานของ GAT ผ่าน Web GAT — กระบวนการ PM / WI / SD / FM — ทำงานร่วมกับ Google Sheet **BCT** (บอร์ดที่ทีม BU บันทึกรายการตรวจสอบ) — ข้อมูลนำเข้า/ส่งออกระหว่าง BCT ⇄ Web GAT — ขึ้น Dashboard เพื่อวิเคราะห์ รายงานผล รวบรวมประเด็น

**ข้อมูลตั้งต้น:** xlsx 26 ชีท เดียวกับ 23 ต.ค. 69 (เนื้อหาเหมือนเป๊ะ ตรวจ diff แล้ว) → สกัดเป็น `gat-seed.json`

---

## 1) สถาปัตยกรรม

```
┌─────────────────────────┐         ┌──────────────────────────────┐
│  Google Sheet "BCT"      │  GAS    │   Web GAT (repo web-pp7/gat) │
│  (บอร์ดทีม BU บันทึก)     │◄───────►│   GitHub Pages + JS          │
│                          │ Web API │                              │
│  GAT_Registers (master)  │  doGet  │  📊 Dashboard  (KPI/วิเคราะห์) │
│  GAT_Entries   (ผลบันทึก) │  doPost │  🗂 Registers (12 ช่องตามxlsx) │
│  GAT_Issues    (ใบประเด็น)│         │  📥 BCT Import/Export         │
│  GAT_AuditLog  (trail)   │         │  🧾 ใบประเด็น (SOP 5 ขั้น)     │
└─────────────────────────┘         │  🗊 Universe / 📤 รายงาน       │
                                     └──────────────────────────────┘
```

- **ฝั่ง BU:** บันทึกบนชีท BCT ตรง ๆ (หรือผ่าน Google Form ภายหลัง) — ไฟล์ต้นฉบับ BU ไม่แก้ (กติกา SOP ข้อ 5)
- **ฝั่ง GAT:** ตรวจ → ออกใบประเด็นลง `GAT_Issues` → BU ตอบกลับในชีท → Web GAT ดึงมาสรุป
- **กลไกเชื่อม:** Google Apps Script ไฟล์เดียว (`gas-bct-bridge.js`) ติดตั้งบนชีท BCT + Deploy Web App (GET อ่าน / POST บันทึก) + audit log ทุกกระทำ

## 2) กระบวนการ PM WI SD FM ในระบบ

| ประเภท | ความหมายในระบบ GAT | ตัวอย่างจาก seed (ตัวเลขจริง v1.0) |
|---|---|---|
| **PM** | การจัดการ/นโยบาย/ห้ามฝ่าฝืน | Regulatory Universe AAMG-PMSG-CPDG-LDC-TNR (25) + การฝ่าฝืนร้ายแรง 7 ข้อ + PMSG 20 หน่วยงาน → **100 รายการ** |
| **WI** | แนวปฏิบัติ/ขั้นตอนบังคับ | Regulatory Submission Control **9 ขั้น** (Identify→Prepare→Review→Compliance→Legal→Sign→Submit→Archive→Dashboard) — หลัก "No Review → No Sign → No Submission" |
| **SD** | มาตรฐาน/เอกสารต้องมี | ประเภทเอกสาร 16 (จัดทำ/ตรวจ/อนุมัติ/ลงนาม/ส่ง + mode) + ใบอนุญาต → **17 รายการ** |
| **FM** | ฟอร์ม/รายงานตามรอบ | ภาษี+ยื่นรายการ 57 นิติบุคคล (WHT2/3/53, ภ.พ.30, SBT40, CIT51/50, DBD, บอจ.5) → **58 รายการ** |

รวม seed v1.0 = **184 รายการ** (ตรวจผ่าน UI test: กรอง/ค้น/สร้างรายงาน ได้จริง)

## 3) วงจรข้อมูล BCT ⇄ Web GAT

**นำเข้า (Import):** GAS `doGet?action=list_registers|list_entries|list_issues` → Web GAT ผสมกับ seed (BCT ทับ seed รหัสเดียวกัน) → ขึ้น Dashboard ทันที
**ส่งออก (Export):** ปุ่ม "Export รูปแบบ BCT (CSV)" — คอลัมน์ตรงชีท `GAT_Registers` 20 ช่อง วางลงชีทได้เลย (แนวเดียวกับ SOP: "ผลตรวจเป็นไฟล์/ชีทเพิ่มเสมอ")
**ใบประเด็น:** แท็บ 🧾 สร้างโครง .txt ตาม SOP (ป้าย 🔴 ขัดกฎหมาย/จำเป็นจริง เทียบ 🟢 ข้อเสนอ + คำถาม BU 3 ข้อ) → BU ตอบในชีท → Import กลับมาเห็นสถานะ

## 4) การติดตั้ง (3 ขั้น ใช้เวลา ~10 นาที)

1. เปิด Google Sheet **BCT** → Extensions → Apps Script → วาง `gas-bct-bridge.js` → รัน `setupSheets()` ครั้งเดียว
2. Deploy → New deployment → Web app (Execute as: Me / Access: Anyone) → คัดลอก `/exec` URL
3. เปิด Web GAT → แท็บ "📥 BCT Import/Export" → วาง URL → กด "บันทึก API URL" → กด "Import จาก BCT"

URL Web GAT: `https://pakonchotbuncha-netizen.github.io/web-pp7/gat/index.html` (หลัง push รอบนี้)

## 5) โร้ดแมป

- **v1.0 (วันนี้)** — seed ครบ 184 รายการ + GAS bridge + Dashboard/KPI + Export CSV + โครงใบประเด็น + รายงานสรุป
- **v1.1** — Google Form สำหรับ BU (ไม่ต้องแตะชีท) / แจ้งเตือน Telegram เมื่อมี overdue หรือประเด็น 🔴 ตอบไม่แก้
- **v1.2** — วางระบบประเด็นเดิม F-01–F-15 (สวัสดิการ) เข้า GAT_Issues เป็นชุดแรกจริง
- **v2.0** — Compliance Calendar (มีอะไรต้องส่งวันนี้) + Alert 30 วัน + Monthly Audit & Oversight Report อัตโนมัติ + โยงกล้อง/กฎ CR-01–05 จาก dashboard เดิม

## 6) ไฟล์ในระบบนี้

| ไฟล์ | หน้าที่ |
|---|---|
| `index.html` | หน้าเว็บ 6 แท็บ |
| `app.js` | ตรรกะหลัก (seed→register, import, กรอง, รายงาน) |
| `gat-config.js` | ตั้งค่า + URL GAS + นิยาม PM/WI/SD/FM |
| `gat-seed.json` | ข้อมูลตั้งต้นจาก xlsx (57 บริษัท / 20 หน่วยงาน / 5 BU-universe / 16 ประเภทเอกสาร) |
| `gas-bct-bridge.js` | โค้ดติดตั้งบน Google Sheet BCT (ตัวกลาง) |