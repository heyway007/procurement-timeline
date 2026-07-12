import { PrismaProjectRepository } from "@/lib/db/prisma-project-repository";
import { storageModeFromEnv } from "@/lib/storage/config";
import { ProjectService } from "./service";

let service: ProjectService | undefined;

export function getProjectService(): ProjectService {
  if (!service) {
    if (storageModeFromEnv(process.env) === "google_drive") {
      throw new Error("GOOGLE_DRIVE_STORAGE_NOT_IMPLEMENTED");
    }
    const repository = new PrismaProjectRepository();
    service = new ProjectService(repository, repository);
  }
  return service;
}
