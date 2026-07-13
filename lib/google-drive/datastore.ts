import { google } from "googleapis";
import { APPROVED_TEMPLATE_KEY, APPROVED_TEMPLATE_STEPS } from "@/lib/schedule/approved-template";
import type { GoogleDriveStorageConfig } from "@/lib/storage/config";
import {
  googleDriveDocumentSchema,
  type GoogleDriveDocument,
} from "./schema";

export type { GoogleDriveDocument } from "./schema";

export interface GoogleDriveFileClient {
  readText(): Promise<string | null>;
  writeText(content: string): Promise<void>;
}

export function createEmptyGoogleDriveDocument(
  nowIso: string,
): GoogleDriveDocument {
  return {
    schemaVersion: 1,
    templates: [
      {
        key: APPROVED_TEMPLATE_KEY,
        name: "Procurement timeline",
        version: 1,
        steps: APPROVED_TEMPLATE_STEPS,
      },
    ],
    projects: [],
    holidays: [],
    holidayCalendarYears: [],
    updatedAt: nowIso,
  };
}

export class GoogleDriveDataStore {
  constructor(
    private readonly client: GoogleDriveFileClient,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async read(): Promise<GoogleDriveDocument> {
    const content = await this.client.readText();
    if (!content) {
      const document = createEmptyGoogleDriveDocument(this.now());
      await this.client.writeText(JSON.stringify(document, null, 2));
      return document;
    }
    return parseDocument(content);
  }

  async mutate<T>(
    mutation: (document: GoogleDriveDocument) => T | Promise<T>,
  ): Promise<T> {
    const document = await this.read();
    const result = await mutation(document);
    document.updatedAt = this.now();
    const parsed = googleDriveDocumentSchema.safeParse(document);
    if (!parsed.success) throw new Error("GOOGLE_DRIVE_DATA_INVALID");
    await this.client.writeText(JSON.stringify(parsed.data, null, 2));
    return result;
  }
}

function parseDocument(content: string): GoogleDriveDocument {
  try {
    const parsed = googleDriveDocumentSchema.safeParse(JSON.parse(content));
    if (!parsed.success) throw new Error("GOOGLE_DRIVE_DATA_INVALID");
    return parsed.data;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "GOOGLE_DRIVE_DATA_INVALID"
    ) {
      throw error;
    }
    throw new Error("GOOGLE_DRIVE_DATA_INVALID");
  }
}

type DriveApi = ReturnType<typeof google.drive>;

export class GoogleDriveApiFileClient implements GoogleDriveFileClient {
  private fileId: string | null;

  private constructor(
    private readonly drive: DriveApi,
    fileId: string | null,
    private readonly folderId: string | null,
    private readonly fileName: string,
  ) {
    this.fileId = fileId;
  }

  static fromConfig(config: GoogleDriveStorageConfig): GoogleDriveApiFileClient {
    const auth = new google.auth.JWT({
      email: config.clientEmail,
      key: config.privateKey,
      scopes: ["https://www.googleapis.com/auth/drive"],
    });
    return new GoogleDriveApiFileClient(
      google.drive({ version: "v3", auth }),
      config.fileId,
      config.folderId,
      config.fileName,
    );
  }

  async readText(): Promise<string | null> {
    const fileId = await this.resolveFileId();
    if (!fileId) return null;
    const response = await this.drive.files.get(
      { fileId, alt: "media" },
      { responseType: "text" },
    );
    if (typeof response.data === "string") return response.data;
    return JSON.stringify(response.data);
  }

  async writeText(content: string): Promise<void> {
    const fileId = await this.resolveFileId();
    if (fileId) {
      await this.drive.files.update({
        fileId,
        media: { mimeType: "application/json", body: content },
      });
      return;
    }
    const created = await this.drive.files.create({
      requestBody: {
        name: this.fileName,
        mimeType: "application/json",
        parents: this.folderId ? [this.folderId] : undefined,
      },
      media: { mimeType: "application/json", body: content },
      fields: "id",
    });
    this.fileId = created.data.id ?? null;
  }

  private async resolveFileId(): Promise<string | null> {
    if (this.fileId) return this.fileId;
    if (!this.folderId) return null;
    const escapedName = this.fileName.replace(/'/g, "\\'");
    const response = await this.drive.files.list({
      q: `'${this.folderId}' in parents and name = '${escapedName}' and trashed = false`,
      fields: "files(id, name)",
      pageSize: 1,
    });
    this.fileId = response.data.files?.[0]?.id ?? null;
    return this.fileId;
  }
}
