import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import {
  APPROVED_TEMPLATE_KEY,
  APPROVED_TEMPLATE_STEPS,
} from "../lib/schedule/approved-template";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL_NOT_CONFIGURED");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const OFFICIAL_2026_HOLIDAYS = [
  ["2026-01-01", "วันขึ้นปีใหม่", "NATIONWIDE"],
  ["2026-01-02", "วันหยุดราชการเพิ่มเป็นกรณีพิเศษ", "NATIONWIDE"],
  ["2026-03-03", "วันมาฆบูชา", "NATIONWIDE"],
  ["2026-04-06", "วันพระบาทสมเด็จพระพุทธยอดฟ้าจุฬาโลกมหาราชและวันที่ระลึกมหาจักรีบรมราชวงศ์", "NATIONWIDE"],
  ["2026-04-13", "วันสงกรานต์", "NATIONWIDE"],
  ["2026-04-14", "วันสงกรานต์", "NATIONWIDE"],
  ["2026-04-15", "วันสงกรานต์", "NATIONWIDE"],
  ["2026-05-01", "วันแรงงานแห่งชาติ", "NATIONWIDE"],
  ["2026-05-04", "วันฉัตรมงคล", "NATIONWIDE"],
  ["2026-06-01", "วันหยุดชดเชยวันวิสาขบูชา", "NATIONWIDE"],
  ["2026-06-03", "วันเฉลิมพระชนมพรรษาสมเด็จพระนางเจ้าฯ พระบรมราชินี", "NATIONWIDE"],
  ["2026-07-28", "วันเฉลิมพระชนมพรรษาพระบาทสมเด็จพระเจ้าอยู่หัว", "NATIONWIDE"],
  ["2026-07-29", "วันอาสาฬหบูชา", "NATIONWIDE"],
  ["2026-07-30", "วันเข้าพรรษา", "NATIONWIDE"],
  ["2026-08-12", "วันแม่แห่งชาติ", "NATIONWIDE"],
  ["2026-10-13", "วันนวมินทรมหาราช", "NATIONWIDE"],
  ["2026-10-16", "วันหยุดราชการเป็นกรณีพิเศษในพื้นที่กรุงเทพมหานคร", "BANGKOK"],
  ["2026-10-23", "วันปิยมหาราช", "NATIONWIDE"],
  ["2026-12-07", "วันหยุดชดเชยวันคล้ายวันพระบรมราชสมภพ รัชกาลที่ 9", "NATIONWIDE"],
  ["2026-12-10", "วันรัฐธรรมนูญ", "NATIONWIDE"],
  ["2026-12-31", "วันสิ้นปี", "NATIONWIDE"],
] as const;

async function seed(): Promise<void> {
  await prisma.$transaction(async (transaction) => {
    const template = await transaction.template.upsert({
      where: { key: APPROVED_TEMPLATE_KEY },
      create: {
        key: APPROVED_TEMPLATE_KEY,
        name: "แม่แบบจัดซื้อจัดจ้าง 29 ล้านบาท",
        version: 1,
      },
      update: {
        name: "แม่แบบจัดซื้อจัดจ้าง 29 ล้านบาท",
        version: 1,
      },
    });

    await transaction.templateStep.deleteMany({
      where: { templateId: template.id },
    });
    await transaction.templateStep.createMany({
      data: APPROVED_TEMPLATE_STEPS.map((step) => ({
        templateId: template.id,
        order: step.order,
        label: step.label,
        workingDaysToNext: step.workingDaysToNext,
      })),
    });

    const sourceUrl = "https://www.soc.go.th/?p=33672";
    const confirmedAt = new Date("2026-07-12T00:00:00.000Z");
    for (const [date, name, scope] of OFFICIAL_2026_HOLIDAYS) {
      const parsedDate = new Date(`${date}T00:00:00.000Z`);
      const existing = await transaction.holiday.findUnique({ where: { date: parsedDate } });
      if (existing?.origin === "MANUAL") continue;
      await transaction.holiday.upsert({
        where: { date: parsedDate },
        create: { date: parsedDate, name, sourceNote: "สำนักเลขาธิการคณะรัฐมนตรี", scope, origin: "OFFICIAL_SYNC", officialSourceUrl: sourceUrl, officialSourceLabel: "สำนักเลขาธิการคณะรัฐมนตรี", lastConfirmedAt: confirmedAt },
        update: { name, scope, origin: "OFFICIAL_SYNC", officialSourceUrl: sourceUrl, officialSourceLabel: "สำนักเลขาธิการคณะรัฐมนตรี", lastConfirmedAt: confirmedAt },
      });
    }
    await transaction.holidayCalendarYear.upsert({
      where: { year: 2026 },
      create: { year: 2026, sourceNote: "สำนักเลขาธิการคณะรัฐมนตรี", lastSuccessfulSyncAt: confirmedAt, lastSyncAttemptAt: confirmedAt, lastSyncStatus: "CACHED" },
      update: { sourceNote: "สำนักเลขาธิการคณะรัฐมนตรี", lastSuccessfulSyncAt: confirmedAt, lastSyncStatus: "CACHED" },
    });
  }, { timeout: 30_000 });
}

seed()
  .then(() => {
    console.info("Seeded approved procurement template.");
  })
  .catch((error: unknown) => {
    console.error("Failed to seed approved procurement template.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
