import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import type { ProjectRepository } from "@/lib/projects/repository";
import type { ProjectRecord, ProjectReplacement } from "@/lib/projects/types";
import { recalculateWithManualAnchors } from "@/lib/schedule/engine";
import type { ScheduledTimeline } from "@/lib/schedule/types";
import type {
  HolidayMutation,
  HolidayRepository,
  YearCoverageRecord,
} from "./repository";
import { holidayMutationSchema } from "./schema";
import type { HolidaySource } from "./official-source";
import type { HolidayRecord, HolidaySyncStatus } from "./repository";

const previewPayloadSchema = z.object({
  mutation: holidayMutationSchema,
  projects: z.array(z.object({ id: z.string().min(1), version: z.number().int().positive() })),
  expiresAt: z.number().int().positive(),
});
type PreviewPayload = z.infer<typeof previewPayloadSchema>;
const PREVIEW_AAD = Buffer.from("timeline-holiday-preview:v1");

export type HolidayConfirmResult = {
  updatedProjectIds: string[];
  needsReviewProjectIds: string[];
  versionConflictProjectIds: string[];
};

export class HolidayService {
  private readonly inFlightSyncs = new Map<number, Promise<ReturnType<HolidayService["syncYear"]> extends Promise<infer T> ? T : never>>();

  constructor(
    private readonly holidays: HolidayRepository,
    private readonly projects: ProjectRepository,
    private readonly previewSecret: string,
    private readonly officialSource?: HolidaySource,
  ) {
    if (previewSecret.length < 8) throw new Error("HOLIDAY_PREVIEW_SECRET_TOO_SHORT");
  }

  async listAndSyncYear(year: number): Promise<{
    holidays: HolidayRecord[];
    coverage: YearCoverageRecord | null;
    conflicts: string[];
    sync: { status: HolidaySyncStatus; cached: boolean; message: string | null; sourceUrl: string | null; lastSuccessfulSyncAt: string | null };
  }> {
    if (!Number.isInteger(year) || year < 2000 || year > 2200) throw new Error("INVALID_CALENDAR_YEAR");
    const cached = await this.holidays.listYear(year);
    const lastSuccess = cached.coverage?.lastSuccessfulSyncAt;
    if (lastSuccess && Date.now() - new Date(lastSuccess).getTime() < 15 * 60 * 1000) {
      return { ...cached, conflicts: [], sync: { status: "FRESH", cached: true, message: null, sourceUrl: this.safeSourceUrl(year), lastSuccessfulSyncAt: lastSuccess } };
    }
    if (!this.officialSource) {
      return { ...cached, conflicts: [], sync: { status: cached.holidays.length ? "CACHED" : "FAILED", cached: true, message: "ไม่ได้กำหนดแหล่งข้อมูลราชการ", sourceUrl: null, lastSuccessfulSyncAt: lastSuccess ?? null } };
    }
    let pending = this.inFlightSyncs.get(year);
    if (!pending) {
      pending = this.syncYear(year);
      this.inFlightSyncs.set(year, pending);
      void pending.finally(() => this.inFlightSyncs.delete(year));
    }
    return pending;
  }

  private async syncYear(year: number) {
    const attemptedAt = new Date().toISOString();
    try {
      const official = await this.officialSource!.fetchYear(year);
      const reconciliation = await this.holidays.reconcileOfficialYear(year, official, attemptedAt);
      const stored = await this.holidays.listYear(year);
      return { ...stored, conflicts: reconciliation.conflicts, sync: { status: "FRESH" as const, cached: false, message: null, sourceUrl: this.safeSourceUrl(year), lastSuccessfulSyncAt: attemptedAt } };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "OFFICIAL_SOURCE_UNAVAILABLE";
      await this.holidays.recordSyncFailure(year, attemptedAt, message);
      const stored = await this.holidays.listYear(year);
      return { ...stored, conflicts: [], sync: { status: (stored.holidays.length ? "CACHED" : "FAILED") as HolidaySyncStatus, cached: true, message, sourceUrl: this.safeSourceUrl(year), lastSuccessfulSyncAt: stored.coverage?.lastSuccessfulSyncAt ?? null } };
    }
  }

  private safeSourceUrl(year: number): string | null {
    try { return this.officialSource?.sourceUrl(year) ?? null; } catch { return null; }
  }

  listYear(year: number) {
    if (!Number.isInteger(year) || year < 2000 || year > 2200) {
      throw new Error("INVALID_CALENDAR_YEAR");
    }
    return this.holidays.listYear(year);
  }

  async previewMutation(mutation: HolidayMutation, viewerUserId?: string): Promise<{
    token: string;
    affectedProjectCount: number;
    affectedProjects: Array<{ id: string; name: string; version: number }>;
  }> {
    mutation = holidayMutationSchema.parse(mutation);
    const projects = await this.holidays.listAffectedProjects(
      this.mutationDates(mutation),
    );
    const payload: PreviewPayload = {
      mutation,
      projects: projects.map((project) => ({
        id: project.id,
        version: project.version,
      })),
      expiresAt: Date.now() + 5 * 60 * 1000,
    };
    return {
      token: this.encrypt(payload),
      affectedProjectCount: projects.length,
      affectedProjects: projects.filter((project) => viewerUserId === undefined || project.ownerUserId === viewerUserId).map((project) => ({
        id: project.id,
        name: project.name,
        version: project.version,
      })),
    };
  }

  async confirmMutation(token: string): Promise<HolidayConfirmResult> {
    const payload = this.verify(token);
    await this.holidays.applyMutation(payload.mutation);
    const holidayDates = await this.holidays.listAllDates();
    const result: HolidayConfirmResult = {
      updatedProjectIds: [],
      needsReviewProjectIds: [],
      versionConflictProjectIds: [],
    };

    for (const reference of payload.projects) {
      const project = await this.projects.findById(reference.id);
      if (!project || project.version !== reference.version) {
        result.versionConflictProjectIds.push(reference.id);
        continue;
      }
      const recalculated = recalculateWithManualAnchors(
        this.toTimeline(project),
        holidayDates,
      );
      const replacement =
        recalculated.kind === "ok"
          ? this.replacement(project, recalculated.timeline, "NORMAL")
          : this.replacement(
              project,
              this.toTimeline(project),
              "NEEDS_REVIEW",
            );
      const saved = await this.projects.replace(
        project.id,
        project.version,
        replacement,
      );
      if (saved.kind !== "ok") {
        result.versionConflictProjectIds.push(project.id);
      } else if (recalculated.kind === "conflict") {
        result.needsReviewProjectIds.push(project.id);
      } else {
        result.updatedProjectIds.push(project.id);
      }
    }

    return result;
  }

  verifyYear(year: number, sourceNote: string): Promise<YearCoverageRecord> {
    if (!Number.isInteger(year) || year < 2000 || year > 2200) {
      throw new Error("INVALID_CALENDAR_YEAR");
    }
    if (!sourceNote.trim()) throw new Error("HOLIDAY_SOURCE_NOTE_REQUIRED");
    return this.holidays.verifyYear(year, sourceNote.trim());
  }

  private mutationDates(mutation: HolidayMutation): string[] {
    if (mutation.operation === "create") return [mutation.holiday.date];
    if (mutation.operation === "delete") return [mutation.date];
    return [...new Set([mutation.previousDate, mutation.holiday.date])];
  }

  private encrypt(payload: PreviewPayload): string {
    const iv = randomBytes(12);
    const key = createHash("sha256").update(this.previewSecret).digest();
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(PREVIEW_AAD);
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
    return ["v1", iv.toString("base64url"), ciphertext.toString("base64url"), cipher.getAuthTag().toString("base64url")].join(".");
  }

  private verify(token: string): PreviewPayload {
    try {
      if (typeof token !== "string") throw new Error();
      const parts = token.split(".");
      if (parts.length !== 4 || parts[0] !== "v1" || parts.slice(1).some((part) => !/^[A-Za-z0-9_-]+$/.test(part))) throw new Error();
      const [iv, ciphertext, tag] = parts.slice(1).map((part) => Buffer.from(part, "base64url"));
      if (iv.length !== 12 || tag.length !== 16 || parts.slice(1).some((part, index) => [iv, ciphertext, tag][index].toString("base64url") !== part)) throw new Error();
      const key = createHash("sha256").update(this.previewSecret).digest();
      const decipher = createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAAD(PREVIEW_AAD);
      decipher.setAuthTag(tag);
      const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      const payload = previewPayloadSchema.parse(JSON.parse(plaintext.toString("utf8")));
      if (payload.expiresAt <= Date.now()) {
        throw new Error("HOLIDAY_PREVIEW_TOKEN_EXPIRED");
      }
      return payload;
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.message === "HOLIDAY_PREVIEW_TOKEN_EXPIRED"
      ) {
        throw error;
      }
      throw new Error("INVALID_HOLIDAY_PREVIEW_TOKEN");
    }
  }

  private toTimeline(project: ProjectRecord): ScheduledTimeline {
    return {
      milestones: project.steps,
      processEndDate: project.processEndDate,
      isProcessEndManuallyAdjusted: project.isProcessEndManuallyAdjusted,
    };
  }

  private replacement(
    project: ProjectRecord,
    timeline: ScheduledTimeline,
    scheduleStatus: "NORMAL" | "NEEDS_REVIEW",
  ): ProjectReplacement {
    return {
      name: project.name,
      ownerUserId: project.ownerUserId,
      ownerName: project.ownerName,
      departmentName: project.departmentName,
      budget: project.budget,
      budgetCategory: project.budgetCategory,
      projectStatusType: project.projectStatusType,
      startDate: timeline.milestones[0].scheduledDate,
      note: project.note,
      templateKey: project.templateKey,
      templateVersion: project.templateVersion,
      processEndDate: timeline.processEndDate,
      isProcessEndManuallyAdjusted: timeline.isProcessEndManuallyAdjusted,
      scheduleStatus,
      steps: timeline.milestones,
    };
  }
}
