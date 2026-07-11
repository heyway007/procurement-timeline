import { PrismaProjectRepository } from "@/lib/db/prisma-project-repository";
import { ProjectService } from "./service";

let service: ProjectService | undefined;

export function getProjectService(): ProjectService {
  if (!service) {
    const repository = new PrismaProjectRepository();
    service = new ProjectService(repository, repository);
  }
  return service;
}
