import { describe, expect, it } from "vitest";
import { GoogleDriveDataStore, createEmptyGoogleDriveDocument } from "@/lib/google-drive/datastore";
import { GoogleDriveProjectRepository } from "@/lib/google-drive/project-repository";
import { OwnedProjectRepository } from "@/lib/projects/owned-repository";
import { ProjectService } from "@/lib/projects/service";
import type { AuthUser } from "@/lib/auth/types";

const alice: AuthUser = { id: "alice", email: "alice@example.test", displayName: "Alice", role: "USER" };
const bob: AuthUser = { id: "bob", email: "bob@example.test", displayName: "Bob", role: "ADMIN" };
const input = { name: "Project", budgetCategory: "TEN_TO_TWENTY_MILLION" as const, startDate: "2026-07-06" };

function setup() {
  let content = JSON.stringify(createEmptyGoogleDriveDocument("2026-09-08T00:00:00.000Z"));
  const store = new GoogleDriveDataStore({
    async readText() { return content; },
    async writeText(value) { content = value; },
  });
  const raw = new GoogleDriveProjectRepository(store);
  const owned = new OwnedProjectRepository(raw, alice);
  const service = new ProjectService(owned, raw);
  const other = new ProjectService(new OwnedProjectRepository(raw, bob), raw);
  return { raw, owned, service, other };
}

describe("project ownership", () => {
  it("assigns the authenticated owner, ignores forged owner fields and excludes legacy/foreign projects", async () => {
    const { raw, service, other } = setup();
    const project = (await service.create({ ...input, ownerName: "Bob", ownerUserId: bob.id } as never)).project;
    expect(project).toMatchObject({ ownerName: "Alice", ownerUserId: alice.id });
    await other.create(input);
    await new ProjectService(raw, raw).create({ ...input, name: "Unassigned legacy" });
    expect((await service.list({})).map(item => item.id)).toEqual([project.id]);
    expect(await other.list({ query: "Alice" })).toEqual([]);
  });

  it("preserves ownership through detail and schedule updates even with forged owner fields", async () => {
    const { service, raw } = setup();
    const project = (await service.create(input)).project;
    const updated = await service.updateDetails(project.id, {
      ...input, ownerName: "Bob", ownerUserId: bob.id, version: project.version, confirmReset: true,
    } as never);
    expect(updated).toMatchObject({ ownerName: "Alice", ownerUserId: alice.id });
    const reset = await service.resetSchedule(project.id, updated.version);
    expect(reset.ownerUserId).toBe(alice.id);
    expect((await raw.findById(project.id))?.ownerUserId).toBe(alice.id);
  });

  it.each(["get", "remove", "adjustStep", "adjustEnd", "resetSchedule", "updateDetails", "updateBidSubmissionTime"] as const)(
    "denies %s for another user's id, including for admins", async (operation) => {
      const { service, other, raw } = setup();
      const project = (await service.create(input)).project;
      const actions = {
        get: () => other.get(project.id),
        remove: () => other.remove(project.id, 1),
        adjustStep: () => other.adjustStep(project.id, { order: 1, newDate: "2026-07-07", version: 1, confirmOverwrite: true, confirmShortening: true }),
        adjustEnd: () => other.adjustEnd(project.id, "2026-12-01", 1, true),
        resetSchedule: () => other.resetSchedule(project.id, 1),
        updateDetails: () => other.updateDetails(project.id, { ...input, version: 1, confirmReset: true }),
        updateBidSubmissionTime: () => other.updateBidSubmissionTime(project.id, { timeSlot: "AFTERNOON", version: 1 }),
      };
      await expect(actions[operation]()).rejects.toThrow("PROJECT_NOT_FOUND");
      expect(await raw.findById(project.id)).toEqual(project);
    },
  );

  it("does not transfer ownership when holidays recalculate a project", async () => {
    const { service, raw } = setup();
    const project = (await service.create(input)).project;
    // Internal calendar replacements must retain the owner even when generated from a snapshot.
    const replacement = { ...project, note: "calendar update" };
    const result = await raw.replace(project.id, project.version, replacement);
    expect(result.kind === "ok" && result.project.ownerUserId).toBe(alice.id);
  });
});
