import { PrismaProjectRepository } from "@/lib/db/prisma-project-repository";
import { getGoogleDriveDataStore } from "@/lib/google-drive/container";
import { GoogleDriveProjectRepository } from "@/lib/google-drive/project-repository";
import { storageModeFromEnv } from "@/lib/storage/config";
import { ProjectService } from "./service";

let service: ProjectService | undefined;

export function getProjectService(): ProjectService {
  if (!service) {
    if (storageModeFromEnv(process.env) === "google_drive") {
      const repository = new GoogleDriveProjectRepository(
        getGoogleDriveDataStore(),
      );
      service = new ProjectService(repository, repository);
      return service;
    }
    const repository = new PrismaProjectRepository();
    service = new ProjectService(repository, repository);
  }
  return service;
}
