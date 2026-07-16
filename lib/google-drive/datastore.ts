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

type GoogleDriveDataStoreCacheOptions = {
  ttlMs?: number;
  nowMs?: () => number;
};

const DEFAULT_GOOGLE_DRIVE_CACHE_TTL_MS = 60_000;

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
  private cachedDocument:
    | { document: GoogleDriveDocument; expiresAtMs: number }
    | undefined;
  private pendingRead: Promise<GoogleDriveDocument> | undefined;
  private readonly cacheTtlMs: number;
  private readonly nowMs: () => number;

  constructor(
    private readonly client: GoogleDriveFileClient,
    private readonly now: () => string = () => new Date().toISOString(),
    options: GoogleDriveDataStoreCacheOptions = {},
  ) {
    this.cacheTtlMs = options.ttlMs ?? DEFAULT_GOOGLE_DRIVE_CACHE_TTL_MS;
    this.nowMs = options.nowMs ?? (() => Date.now());
  }

  async read(): Promise<GoogleDriveDocument> {
    const cached = this.cachedDocument;
    if (cached && cached.expiresAtMs > this.nowMs()) {
      return cloneDocument(cached.document);
    }
    if (this.pendingRead) return cloneDocument(await this.pendingRead);

    this.pendingRead = this.readFromDrive();
    try {
      return cloneDocument(await this.pendingRead);
    } finally {
      this.pendingRead = undefined;
    }
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
    this.setCache(parsed.data);
    return result;
  }

  private async readFromDrive(): Promise<GoogleDriveDocument> {
    const content = await this.client.readText();
    if (!content) {
      const document = createEmptyGoogleDriveDocument(this.now());
      await this.client.writeText(JSON.stringify(document, null, 2));
      this.setCache(document);
      return document;
    }
    const document = parseDocument(content);
    this.setCache(document);
    return document;
  }

  private setCache(document: GoogleDriveDocument): void {
    if (this.cacheTtlMs <= 0) {
      this.cachedDocument = undefined;
      return;
    }
    this.cachedDocument = {
      document: cloneDocument(document),
      expiresAtMs: this.nowMs() + this.cacheTtlMs,
    };
  }
}

function cloneDocument(document: GoogleDriveDocument): GoogleDriveDocument {
  return JSON.parse(JSON.stringify(document)) as GoogleDriveDocument;
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

type SignJwt = (input: { email: string; privateKey: string; nowSeconds: number }) => Promise<string>;

type GoogleDriveApiFileClientOptions = {
  signJwt?: SignJwt;
  nowSeconds?: () => number;
  fetch?: typeof fetch;
};

type GoogleAccessToken = {
  token: string;
  expiresAtSeconds: number;
};

export class GoogleDriveApiFileClient implements GoogleDriveFileClient {
  private fileId: string | null;
  private accessToken: GoogleAccessToken | null = null;

  private constructor(
    private readonly clientEmail: string,
    private readonly privateKey: string,
    fileId: string | null,
    private readonly folderId: string | null,
    private readonly fileName: string,
    private readonly options: Required<GoogleDriveApiFileClientOptions>,
  ) {
    this.fileId = fileId;
  }

  static fromConfig(
    config: GoogleDriveStorageConfig,
    options: GoogleDriveApiFileClientOptions = {},
  ): GoogleDriveApiFileClient {
    return new GoogleDriveApiFileClient(
      config.clientEmail,
      config.privateKey,
      config.fileId,
      config.folderId,
      config.fileName,
      {
        signJwt: options.signJwt ?? signServiceAccountJwt,
        nowSeconds:
          options.nowSeconds ?? (() => Math.floor(Date.now() / 1000)),
        fetch: options.fetch ?? fetch,
      },
    );
  }

  async readText(): Promise<string | null> {
    const fileId = await this.resolveFileId();
    if (!fileId) return null;
    const response = await this.driveFetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    );
    return response.text();
  }

  async writeText(content: string): Promise<void> {
    const fileId = await this.resolveFileId();
    if (fileId) {
      await this.driveFetch(
        `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=media`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: content,
        },
      );
      return;
    }
    const boundary = `procurement-timeline-${crypto.randomUUID()}`;
    const metadata = {
      name: this.fileName,
      mimeType: "application/json",
      parents: this.folderId ? [this.folderId] : undefined,
    };
    const body = [
      `--${boundary}`,
      "content-type: application/json; charset=utf-8",
      "",
      JSON.stringify(metadata),
      `--${boundary}`,
      "content-type: application/json",
      "",
      content,
      `--${boundary}--`,
      "",
    ].join("\r\n");
    const response = await this.driveFetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
      {
        method: "POST",
        headers: { "content-type": `multipart/related; boundary=${boundary}` },
        body,
      },
    );
    const created = (await response.json()) as { id?: string };
    this.fileId = created.id ?? null;
  }

  private async resolveFileId(): Promise<string | null> {
    if (this.fileId) return this.fileId;
    if (!this.folderId) return null;
    const escapedName = this.fileName.replace(/'/g, "\\'");
    const search = new URLSearchParams({
      q: `'${this.folderId}' in parents and name = '${escapedName}' and trashed = false`,
      fields: "files(id,name)",
      pageSize: "1",
      includeItemsFromAllDrives: "true",
      supportsAllDrives: "true",
    });
    const response = await this.driveFetch(
      `https://www.googleapis.com/drive/v3/files?${search.toString()}`,
    );
    const data = (await response.json()) as { files?: Array<{ id?: string }> };
    this.fileId = data.files?.[0]?.id ?? null;
    return this.fileId;
  }

  private async driveFetch(
    url: string,
    init: RequestInit = {},
  ): Promise<Response> {
    const token = await this.getAccessToken();
    const response = await this.options.fetch(url, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      throw new Error(await googleDriveErrorMessage(response));
    }
    return response;
  }

  private async getAccessToken(): Promise<string> {
    const nowSeconds = this.options.nowSeconds();
    if (
      this.accessToken &&
      this.accessToken.expiresAtSeconds - 60 > nowSeconds
    ) {
      return this.accessToken.token;
    }

    const assertion = await this.options.signJwt({
      email: this.clientEmail,
      privateKey: this.privateKey,
      nowSeconds,
    });
    const response = await this.options.fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    });
    if (!response.ok) {
      throw new Error(await googleDriveErrorMessage(response));
    }
    const data = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!data.access_token) throw new Error("GOOGLE_DRIVE_AUTH_FAILED");
    this.accessToken = {
      token: data.access_token,
      expiresAtSeconds: nowSeconds + (data.expires_in ?? 3600),
    };
    return this.accessToken.token;
  }
}

async function signServiceAccountJwt({
  email,
  privateKey,
  nowSeconds,
}: {
  email: string;
  privateKey: string;
  nowSeconds: number;
}): Promise<string> {
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: email,
    scope: "https://www.googleapis.com/auth/drive",
    aud: "https://oauth2.googleapis.com/token",
    exp: nowSeconds + 3600,
    iat: nowSeconds,
  };
  const signingInput = [
    base64UrlEncodeJson(header),
    base64UrlEncodeJson(payload),
  ].join(".");
  try {
    if (!globalThis.crypto?.subtle) throw new Error("WEB_CRYPTO_UNAVAILABLE");
    const key = await globalThis.crypto.subtle.importKey(
      "pkcs8",
      pemToArrayBuffer(privateKey),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signature = await globalThis.crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      key,
      new TextEncoder().encode(signingInput),
    );
    return `${signingInput}.${base64UrlEncode(signature)}`;
  } catch {
    throw new Error("GOOGLE_DRIVE_JWT_SIGN_FAILED");
  }
}

function base64UrlEncodeJson(value: unknown): string {
  return base64UrlEncode(new TextEncoder().encode(JSON.stringify(value)));
}

function base64UrlEncode(value: ArrayBuffer | Uint8Array): string {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function pemToArrayBuffer(privateKey: string): ArrayBuffer {
  const base64 = privateKey
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

async function googleDriveErrorMessage(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const parsed = JSON.parse(text) as {
      error?: { message?: string; code?: number };
    };
    const message = parsed.error?.message;
    return message
      ? `GOOGLE_DRIVE_API_ERROR: ${message}`
      : `GOOGLE_DRIVE_API_ERROR: ${response.status}`;
  } catch {
    return text || `GOOGLE_DRIVE_API_ERROR: ${response.status}`;
  }
}
