import { getGoogleDriveDataStore } from "@/lib/google-drive/container";
import { GoogleDriveProjectRepository } from "@/lib/google-drive/project-repository";
import { storageModeFromEnv } from "@/lib/storage/config";
import { ProjectService } from "./service";

let service: Promise<ProjectService> | undefined;

export function getProjectService(): Promise<ProjectService> {
  if (!service) {
    service = createProjectService();
  }
  return service;
}

async function createProjectService(): Promise<ProjectService> {
    if (storageModeFromEnv(process.env) === "google_drive") {
      const repository = new GoogleDriveProjectRepository(
        getGoogleDriveDataStore(),
      );
      return new ProjectService(repository, repository);
    }
    const { PrismaProjectRepository } = await import(
      "@/lib/db/prisma-project-repository"
    );
    const repository = new PrismaProjectRepository();
    return new ProjectService(repository, repository);
}
