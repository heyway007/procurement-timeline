import { getGoogleDriveDataStore } from "@/lib/google-drive/container";
import { GoogleDriveProjectRepository } from "@/lib/google-drive/project-repository";
import { storageModeFromEnv } from "@/lib/storage/config";
import { ProjectService } from "./service";
import { OwnedProjectRepository } from "./owned-repository";
import { requireUser } from "@/lib/auth/server";
import { assertSameOrigin } from "@/lib/auth/http";
import type { AuthUser } from "@/lib/auth/types";

export async function getProjectService(request?: Request): Promise<ProjectService> {
  if (request && !["GET", "HEAD"].includes(request.method)) assertSameOrigin(request);
  const user = await requireUser();
  return createProjectService(user);
}

async function createProjectService(user: AuthUser): Promise<ProjectService> {
    if (storageModeFromEnv(process.env) === "google_drive") {
      const repository = new GoogleDriveProjectRepository(
        getGoogleDriveDataStore(),
      );
      return new ProjectService(new OwnedProjectRepository(repository, user), repository);
    }
    const { PrismaProjectRepository } = await import(
      "@/lib/db/prisma-project-repository"
    );
    const repository = new PrismaProjectRepository(user.id);
    return new ProjectService(new OwnedProjectRepository(repository, user), repository);
}
