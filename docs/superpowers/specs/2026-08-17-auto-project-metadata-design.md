# Automatic Project Metadata and Hidden Budget Input — Design Specification

## Goal

ปรับฟอร์มสร้าง Timeline ให้ผู้ใช้เลือกเฉพาะฝ่าย ประเภทวงเงิน / วิธี วันที่เริ่มต้น และหมายเหตุ โดยไม่ต้องกรอกชื่อโครงการ ผู้จัดทำ Timeline หรือวงเงินจัดจ้าง ข้อมูลที่ว่างจะถูกเติมโดย service และยังคงใช้ schema ฐานข้อมูลเดิมเพื่อไม่กระทบข้อมูลเก่า

## User-visible behavior

- แสดงช่อง `ชื่อโครงการ` ในฟอร์มสร้าง Timeline แต่ไม่บังคับรับค่า
- แสดงช่อง `ผู้จัดทำ Timeline` ในฟอร์มสร้าง Timeline แต่ไม่บังคับรับค่า และใช้ค่า `-` เมื่อไม่มีค่า
- ซ่อนช่อง `วงเงินจัดจ้าง (บาท)` จากฟอร์มสร้าง Timeline
- ช่อง `ฝ่าย` ยังแสดงอยู่แต่ไม่บังคับเลือก และใช้ค่า `-` เมื่อไม่มีค่า
- คงช่อง `ประเภทวงเงิน / วิธี` ไว้และยังบังคับให้เลือก เพราะใช้เลือกแม่แบบ Timeline
- เมื่อสร้างรายการโดยไม่มีชื่อ ระบบตั้งชื่อเป็น `Timeline-<รหัสสั้น>-<DDMMYYYY>` โดยวันที่มาจาก `startDate` และรหัสสั้นเป็นอักขระ 8 ตัวแรกของ UUID ใหม่
- ข้อมูลชื่อหรือผู้จัดทำที่ส่งเข้ามาจาก client/API โดยตรงยังคงถูกเก็บได้ หากไม่ว่างและผ่าน validation
- ข้อมูล Timeline เดิมไม่ถูก migration หรือลบ

## Architecture and data flow

1. `ProjectForm` จะ render input ของชื่อโครงการและผู้จัดทำโดยไม่ใส่ `required`, render ฝ่ายโดยไม่ใส่ `required`, และจะไม่ render input ของวงเงินจริง
2. ฟอร์มส่งค่า `name: ""`, `ownerName: ""`, `departmentName: ""` และไม่ส่ง `budget` ที่ผู้ใช้กรอก โดยยังส่ง `budgetCategory`, `startDate` และ `note`
3. `createProjectSchema` จะรับชื่อและผู้จัดทำเป็น optional/blank และรับ budget ที่ไม่ระบุได้สำหรับ flow ใหม่ ข้อมูล budget เดิมที่ส่งเข้ามายังคง validate ได้
4. `ProjectService.create` จะ normalize ค่าในจุดเดียวก่อนสร้าง Timeline:
   - ชื่อว่าง → `Timeline-<short UUID>-<DDMMYYYY>`
   - ผู้จัดทำว่าง → `-`
   - department ว่าง → `-`
   - budget ว่าง → ค่า canonical ภายในตาม `budgetCategory` เพื่อคง compatibility กับคอลัมน์ `budget` ที่ยังเป็น non-null และ validation เดิม
5. การเลือก template ยังคงใช้ `budgetCategory` โดยตรงเหมือนเดิม จึงไม่เปลี่ยนจำนวนหรือวันของ milestone ที่สร้าง

ค่า canonical budget สำหรับข้อมูลใหม่:

| ประเภท | ค่า compatibility ภายใน |
| --- | ---: |
| `ONE_TO_FIVE_MILLION` | 1,000,000 |
| `FIVE_TO_TEN_MILLION` | 5,000,001 |
| `TEN_TO_TWENTY_MILLION` | 10,000,001 |
| `ABOVE_TWENTY_MILLION` | 50,000,001 |
| `SELECTIVE_METHOD` | 1,000,000 |

ค่าดังกล่าวเป็นเพียงค่า compatibility ชั่วคราว ไม่ใช่ค่าที่ผู้ใช้กรอกจริง และจะไม่เปลี่ยน schema หรือ migration ในรอบนี้

## Validation and error handling

- `budgetCategory` และ `startDate` ยังคงเป็น required; `departmentName` เป็น optional
- ตรวจสอบวันหยุด/วันหยุดสุดสัปดาห์ตาม flow เดิม
- ชื่อที่ผู้ใช้/API ส่งมาให้ trim และจำกัดความยาวตาม schema เดิม
- การสร้างชื่ออัตโนมัติทำใน service หลัง parse เพื่อให้ API และ UI มีพฤติกรรมเหมือนกัน
- หากสร้าง UUID หรือ parse วันที่ไม่ได้ ให้การสร้างล้มเหลวตาม error flow เดิม ไม่บันทึกข้อมูลบางส่วน
- การแก้ไขรายละเอียดเดิมยังรองรับข้อมูล `budget` เดิม และไม่เปลี่ยนชื่อ/ผู้จัดทำอัตโนมัติของรายการเก่าโดยไม่จำเป็น

## Testing

- Component test ยืนยันว่าฟอร์มแสดงช่องชื่อโครงการ ผู้จัดทำ และฝ่ายแบบไม่บังคับกรอก ไม่แสดงวงเงินจริง และยังแสดง/บังคับเลือกประเภทวงเงิน / วิธี
- Component test ยืนยันว่า payload จากฟอร์มส่งค่าว่างสำหรับ metadata และไม่ต้องกรอก budget
- Unit test ของ service ยืนยันชื่ออัตโนมัติมี prefix, short UUID และวันที่เริ่มต้น รวมทั้งผู้จัดทำเป็น `-`
- Unit test ของ service ยืนยันการเลือก canonical budget ตาม category และ template ที่สร้างยังถูกต้อง
- Unit test ยืนยันชื่อ/ผู้จัดทำ/budget ที่ส่งมาแบบเดิมยังทำงานได้ เพื่อป้องกัน regression ของ API และข้อมูลเดิม
- รัน component/unit tests, typecheck และ lint ที่มีอยู่ในโปรเจกต์

## Scope boundaries

- ไม่เปลี่ยน schema Prisma, migration หรือรูปแบบข้อมูล Google Drive ในรอบนี้
- ไม่ซ่อนการแสดงวงเงินของ Timeline เก่าบน dashboard/detail เพราะเป็นข้อมูลที่มีอยู่แล้วและอยู่นอกฟอร์มสร้าง
- ไม่ปรับ flow แก้ไขรายละเอียดนอกจากให้ schema/service รองรับค่า optional ตาม compatibility ที่จำเป็น
