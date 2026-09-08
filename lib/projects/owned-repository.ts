import type { AuthUser } from "@/lib/auth/types";
import type { ProjectRepository, ProjectMutationResult } from "./repository";
import type { ListProjectsFilter, NewProjectRecord, ProjectRecord, ProjectReplacement } from "./types";

/** Request-local boundary: callers cannot select or transfer a project's owner. */
export class OwnedProjectRepository implements ProjectRepository {
  constructor(private readonly repository: ProjectRepository, private readonly user: AuthUser) {}

  async list(filter: ListProjectsFilter): Promise<ProjectRecord[]> {
    return (await this.repository.list(filter)).filter(project => project.ownerUserId === this.user.id);
  }

  async findById(id: string): Promise<ProjectRecord | null> {
    const project = await this.repository.findById(id);
    return project?.ownerUserId === this.user.id ? project : null;
  }

  create(input: NewProjectRecord): Promise<ProjectRecord> {
    return this.repository.create({ ...input, ownerUserId: this.user.id, ownerName: this.user.displayName });
  }

  async replace(id: string, version: number, input: ProjectReplacement): Promise<ProjectMutationResult> {
    if (!await this.findById(id)) return { kind: "not_found" };
    return this.repository.replace(id, version, { ...input, ownerUserId: this.user.id, ownerName: this.user.displayName });
  }

  async remove(id: string, version: number): Promise<ProjectMutationResult> {
    if (!await this.findById(id)) return { kind: "not_found" };
    return this.repository.remove(id, version);
  }
}
