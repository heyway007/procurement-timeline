import { NextResponse } from "next/server";
import { ZodError } from "zod";

const messages: Record<string, { status: number; message: string }> = {
  INVALID_HOLIDAY_PREVIEW_TOKEN: {
    status: 422,
    message: "ข้อมูลยืนยันหมดอายุหรือไม่ถูกต้อง กรุณาตรวจสอบผลกระทบใหม่",
  },
  HOLIDAY_PREVIEW_TOKEN_EXPIRED: {
    status: 422,
    message: "ข้อมูลยืนยันหมดอายุ กรุณาตรวจสอบผลกระทบใหม่",
  },
  HOLIDAY_SOURCE_NOTE_REQUIRED: {
    status: 422,
    message: "กรุณาระบุแหล่งอ้างอิงวันหยุด",
  },
  INVALID_CALENDAR_YEAR: {
    status: 422,
    message: "ปีปฏิทินไม่ถูกต้อง",
  },
};

export function holidayErrorResponse(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        code: "VALIDATION_ERROR",
        message: "ข้อมูลวันหยุดไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง",
        fieldErrors: error.flatten().fieldErrors,
      },
      { status: 422 },
    );
  }
  const code = error instanceof Error ? error.message : "INTERNAL_ERROR";
  const known = messages[code];
  return NextResponse.json(
    {
      code: known ? code : "INTERNAL_ERROR",
      message: known?.message ?? "ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง",
    },
    { status: known?.status ?? 500 },
  );
}
