import { getGoogleDriveDataStore } from "@/lib/google-drive/container";
import { GoogleDriveProjectRepository } from "@/lib/google-drive/project-repository";
import { storageModeFromEnv } from "@/lib/storage/config";
import { ProjectService } from "./service";
import { assertSameOrigin } from "@/lib/auth/http";

export async function getProjectService(request?: Request): Promise<ProjectService> {
  if (request && !["GET", "HEAD"].includes(request.method)) assertSameOrigin(request);
  if (storageModeFromEnv(process.env) === "google_drive") {
    const repository = new GoogleDriveProjectRepository(getGoogleDriveDataStore());
    return new ProjectService(repository, repository);
  }
  const { PrismaProjectRepository } = await import("@/lib/db/prisma-project-repository");
  const repository = new PrismaProjectRepository();
  return new ProjectService(repository, repository);
}
