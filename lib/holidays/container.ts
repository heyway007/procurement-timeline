import { getGoogleDriveDataStore } from "@/lib/google-drive/container";
import { GoogleDriveHolidayRepository } from "@/lib/google-drive/holiday-repository";
import { GoogleDriveProjectRepository } from "@/lib/google-drive/project-repository";
import { storageModeFromEnv } from "@/lib/storage/config";
import { HolidayService } from "./service";
import { SocHolidaySource } from "./official-source";
import { HolidaySyncCoordinator } from "./sync-coordinator";
import { assertSameOrigin } from "@/lib/auth/http";

let service: Promise<HolidayService> | undefined;
let coordinator: Promise<HolidaySyncCoordinator> | undefined;

export function getHolidaySyncCoordinator(): Promise<HolidaySyncCoordinator> {
  coordinator ??= createHolidaySyncCoordinator();
  return coordinator;
}

async function createHolidaySyncCoordinator(): Promise<HolidaySyncCoordinator> {
  if (storageModeFromEnv(process.env) === "google_drive") {
    const store = getGoogleDriveDataStore();
    return new HolidaySyncCoordinator(new GoogleDriveHolidayRepository(store, new GoogleDriveProjectRepository(store)), new SocHolidaySource());
  }
  const { PrismaHolidayRepository } = await import("@/lib/db/prisma-holiday-repository");
  return new HolidaySyncCoordinator(new PrismaHolidayRepository(), new SocHolidaySource());
}

export async function getHolidayService(request?: Request): Promise<HolidayService> {
  if (request && !["GET", "HEAD"].includes(request.method)) assertSameOrigin(request);
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
      undefined,
      await getHolidaySyncCoordinator(),
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
    undefined,
    await getHolidaySyncCoordinator(),
  );
}
