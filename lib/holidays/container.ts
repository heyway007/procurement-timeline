import { PrismaHolidayRepository } from "@/lib/db/prisma-holiday-repository";
import { PrismaProjectRepository } from "@/lib/db/prisma-project-repository";
import { HolidayService } from "./service";
import { SocHolidaySource } from "./official-source";

let service: HolidayService | undefined;

export function getHolidayService(): HolidayService {
  if (!service) {
    const secret = process.env.HOLIDAY_PREVIEW_SECRET;
    if (!secret) throw new Error("HOLIDAY_PREVIEW_SECRET_NOT_CONFIGURED");
    service = new HolidayService(
      new PrismaHolidayRepository(),
      new PrismaProjectRepository(),
      secret,
      new SocHolidaySource(),
    );
  }
  return service;
}
