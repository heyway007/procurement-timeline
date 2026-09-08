import { getGoogleDriveDataStore } from "@/lib/google-drive/container";
import { GoogleDriveHolidayRepository } from "@/lib/google-drive/holiday-repository";
import { GoogleDriveProjectRepository } from "@/lib/google-drive/project-repository";
import { storageModeFromEnv } from "@/lib/storage/config";
import { HolidayService } from "./service";
import { SocHolidaySource } from "./official-source";
import { requireAdmin, requireUser } from "@/lib/auth/server";
import { assertSameOrigin } from "@/lib/auth/http";

let service: Promise<HolidayService> | undefined;

export async function getHolidayService(request?: Request, readOnly = false): Promise<HolidayService> {
  if (request && !["GET", "HEAD"].includes(request.method)) assertSameOrigin(request);
  if (readOnly) await requireUser();
  else await requireAdmin();
  if (!service) {
    service = createHolidayService();
  }
  return service;
}

async function createHolidayService(): Promise<HolidayService> {
  const secret = process.env.HOLIDAY_PREVIEW_SECRET;
  if (!secret) throw new Error("HOLIDAY_PREVIEW_SECRET_NOT_CONFIGURED");
  if (storageModeFromEnv(process.env) === "google_drive") {
    const store = getGoogleDriveDataStore();
    const projects = new GoogleDriveProjectRepository(store);
    return new HolidayService(
      new GoogleDriveHolidayRepository(store, projects),
      projects,
      secret,
      new SocHolidaySource(),
    );
  }
  const { PrismaHolidayRepository } = await import(
    "@/lib/db/prisma-holiday-repository"
  );
  const { PrismaProjectRepository } = await import(
    "@/lib/db/prisma-project-repository"
  );
  return new HolidayService(
    new PrismaHolidayRepository(),
    new PrismaProjectRepository(),
    secret,
    new SocHolidaySource(),
  );
}
