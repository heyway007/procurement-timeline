# Dashboard Project Column Width — Design Specification

## Goal

ปรับตารางรายการ Timeline บน desktop ให้ชื่อโครงการยาวใช้พื้นที่เฉพาะคอลัมน์โครงการและไม่เบียดคอลัมน์ action จนข้อความในปุ่ม “เปิด Timeline” ตกเป็นสองบรรทัด โดยไม่ใช้ `white-space: nowrap` และไม่เปลี่ยน mobile layout

## Design

- ใช้ fixed table layout สำหรับตาราง desktop เพื่อให้การจัดสรรพื้นที่ของคอลัมน์คงที่และคาดเดาได้
- กำหนดคอลัมน์โครงการให้มีสัดส่วนจำกัดลงประมาณ 42% เพื่อให้ชื่อโครงการยาว wrap ภายในช่องแทนการดันคอลัมน์ action
- กำหนดพื้นที่คอลัมน์ action ให้พอสำหรับปุ่มเปิด Timeline และปุ่มลบในแถวเดียวกัน
- คงพฤติกรรมการ wrap ของข้อความปุ่มตามปกติ ไม่เพิ่ม `whitespace-nowrap`
- คง mobile card layout เดิม

## Verification

- เพิ่ม component regression test ตรวจ class/layout contract ของ desktop table และ project/action columns
- รัน targeted component test, test suite, typecheck, lint และ production build
- เปิด development server local เพื่อตรวจด้วย browser ว่าชื่อยาว wrap ในช่องโครงการและปุ่มยังอยู่ใน action column ตามภาพอ้างอิง
