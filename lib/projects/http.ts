import { ZodError } from "zod";

type ErrorBody = {
  code: string;
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export type MappedProjectError = { status: number; body: ErrorBody };

const knownErrors: Record<string, MappedProjectError> = {
  PROJECT_VERSION_CONFLICT: {
    status: 409,
    body: {
      code: "PROJECT_VERSION_CONFLICT",
      message: "ข้อมูลนี้ถูกแก้ไขจากผู้ใช้อื่น กรุณาโหลดข้อมูลล่าสุด",
    },
  },
  PROJECT_NOT_FOUND: {
    status: 404,
    body: { code: "PROJECT_NOT_FOUND", message: "ไม่พบโครงการที่ต้องการ" },
  },
  MILESTONE_NOT_FOUND: {
    status: 404,
    body: { code: "MILESTONE_NOT_FOUND", message: "ไม่พบขั้นตอนที่ต้องการ" },
  },
  START_DATE_MUST_BE_WORKING_DAY: {
    status: 422,
    body: {
      code: "START_DATE_MUST_BE_WORKING_DAY",
      message: "วันที่เริ่มต้นต้องเป็นวันทำการราชการ",
    },
  },
  DATE_MUST_BE_WORKING_DAY: {
    status: 422,
    body: {
      code: "DATE_MUST_BE_WORKING_DAY",
      message: "วันที่เลือกต้องเป็นวันทำการราชการ",
    },
  },
  DATE_MUST_BE_AFTER_PREVIOUS: {
    status: 422,
    body: {
      code: "DATE_MUST_BE_AFTER_PREVIOUS",
      message: "วันที่เลือกต้องอยู่หลังขั้นตอนก่อนหน้า",
    },
  },
  DURATION_SHORTER_THAN_TEMPLATE: {
    status: 422,
    body: {
      code: "DURATION_SHORTER_THAN_TEMPLATE",
      message: "ระยะใหม่สั้นกว่าค่าแม่แบบ กรุณายืนยันก่อนบันทึก",
    },
  },
  DOWNSTREAM_ADJUSTMENTS_WILL_BE_REPLACED: {
    status: 422,
    body: {
      code: "DOWNSTREAM_ADJUSTMENTS_WILL_BE_REPLACED",
      message: "วันที่ซึ่งเคยปรับในขั้นตอนหลังจะถูกคำนวณใหม่",
    },
  },
  SCHEDULE_RESET_CONFIRMATION_REQUIRED: {
    status: 422,
    body: {
      code: "SCHEDULE_RESET_CONFIRMATION_REQUIRED",
      message: "การเปลี่ยนวันเริ่มจะล้างวันที่ซึ่งเคยปรับ กรุณายืนยันก่อนบันทึก",
    },
  },
};

export function mapProjectError(error: unknown): MappedProjectError {
  if (error instanceof ZodError) {
    return {
      status: 422,
      body: {
        code: "VALIDATION_ERROR",
        message: "ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง",
        fieldErrors: error.flatten().fieldErrors as Record<string, string[]>,
      },
    };
  }

  if (error instanceof Error && knownErrors[error.message]) {
    return knownErrors[error.message];
  }

  return {
    status: 500,
    body: {
      code: "INTERNAL_ERROR",
      message: "ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง",
    },
  };
}
