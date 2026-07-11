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
  });
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
