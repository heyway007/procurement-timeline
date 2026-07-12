import { PrismaHolidayRepository } from "@/lib/db/prisma-holiday-repository";
import { PrismaProjectRepository } from "@/lib/db/prisma-project-repository";
import { getGoogleDriveDataStore } from "@/lib/google-drive/container";
import { GoogleDriveHolidayRepository } from "@/lib/google-drive/holiday-repository";
import { GoogleDriveProjectRepository } from "@/lib/google-drive/project-repository";
import { storageModeFromEnv } from "@/lib/storage/config";
import { HolidayService } from "./service";
import { SocHolidaySource } from "./official-source";

let service: HolidayService | undefined;

export function getHolidayService(): HolidayService {
  if (!service) {
    const secret = process.env.HOLIDAY_PREVIEW_SECRET;
    if (!secret) throw new Error("HOLIDAY_PREVIEW_SECRET_NOT_CONFIGURED");
    if (storageModeFromEnv(process.env) === "google_drive") {
      const store = getGoogleDriveDataStore();
      const projects = new GoogleDriveProjectRepository(store);
      service = new HolidayService(
        new GoogleDriveHolidayRepository(store, projects),
        projects,
        secret,
        new SocHolidaySource(),
      );
      return service;
    }
    service = new HolidayService(
      new PrismaHolidayRepository(),
      new PrismaProjectRepository(),
      secret,
      new SocHolidaySource(),
    );
  }
  return service;
}
