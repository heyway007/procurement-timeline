# Print Preview Options Design

## Goal

ให้หน้า Timeline ใช้ตัวเลือกการพิมพ์ของเบราว์เซอร์ได้เต็มรูปแบบเหมือนหน้าเว็บทั่วไป โดยไม่บังคับขนาดกระดาษ แนวกระดาษ หรือขอบกระดาษจาก CSS ของแอป

## Scope

- ลบ `@page` ที่กำหนด `A4`, `landscape` และ `8mm` margin ใน print stylesheet
- คง layout ตารางและการจัดรูปแบบสำหรับการพิมพ์ที่มีอยู่
- คงการซ่อนปุ่ม/ส่วนควบคุมที่ไม่ควรอยู่ในเอกสารพิมพ์
- ไม่เพิ่มเมนูพิมพ์แบบกำหนดเองในหน้าเว็บในรอบนี้

## Behavior

เมื่อผู้ใช้กดปุ่มพิมพ์หรือ `Ctrl+P` Chrome จะเป็นผู้จัดการตัวเลือก เช่น destination, pages, layout, paper size, margins, scale, headers/footers และ Save as PDF ส่วนเนื้อหา Timeline จะยังใช้ print layout เดิม

## Implementation

แก้เฉพาะ `app/globals.css` โดยนำกฎ `@page` ที่ล็อกค่าการพิมพ์ออก ไม่เปลี่ยน component หรือ data flow

## Verification

- เพิ่ม/ปรับการทดสอบให้ยืนยันว่า print stylesheet ไม่มีการบังคับ `@page` settings
- รันชุดทดสอบทั้งหมด
- รัน ESLint สำหรับ source และ tests
- ตรวจหน้า local และ git diff ก่อน commit

## Acceptance Criteria

1. Print stylesheet ไม่กำหนดกระดาษ/แนวกระดาษ/ขอบกระดาษตายตัว
2. Print preview ยังแสดง Timeline ได้ครบและซ่อนปุ่มจัดการเหมือนเดิม
3. Tests และ lint ผ่าน
