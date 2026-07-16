import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export type StorageMode = "postgres" | "google_drive";

export type GoogleDriveStorageConfig = {
  clientEmail: string;
  privateKey: string;
  fileId: string | null;
  folderId: string | null;
  fileName: string;
};

const LOCAL_GOOGLE_DRIVE_FILE_NAME = "procurement-timeline-data.local.json";
const PRODUCTION_GOOGLE_DRIVE_FILE_NAME = "procurement-timeline-data.json";

function required(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function defaultGoogleDriveFileName(env: Partial<NodeJS.ProcessEnv>): string {
  const appEnvironment =
    required(env.APP_ENV) ??
    (required(env.NODE_ENV) === "production" ? "production" : "local");
  return appEnvironment === "production"
    ? PRODUCTION_GOOGLE_DRIVE_FILE_NAME
    : LOCAL_GOOGLE_DRIVE_FILE_NAME;
}

export function storageModeFromEnv(env: Partial<NodeJS.ProcessEnv>): StorageMode {
  const mode = required(env.STORAGE_MODE) ?? "postgres";
  if (mode === "postgres" || mode === "google_drive") return mode;
  throw new Error("STORAGE_MODE_UNSUPPORTED");
}

type ServiceAccountCredentials = {
  client_email?: string;
  private_key?: string;
};

function readServiceAccountCredentials(
  filePath: string | null,
): ServiceAccountCredentials | null {
  if (!filePath) return null;
  try {
    return JSON.parse(
      readFileSync(resolve(filePath), "utf8"),
    ) as ServiceAccountCredentials;
  } catch {
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS_INVALID");
  }
}

export function assertGoogleDriveEnv(
  env: Partial<NodeJS.ProcessEnv>,
): GoogleDriveStorageConfig {
  const serviceAccount = readServiceAccountCredentials(
    required(env.GOOGLE_APPLICATION_CREDENTIALS),
  );
  const clientEmail =
    required(env.GOOGLE_DRIVE_CLIENT_EMAIL) ??
    required(serviceAccount?.client_email);
  if (!clientEmail) throw new Error("GOOGLE_DRIVE_CLIENT_EMAIL_NOT_CONFIGURED");

  const rawPrivateKey =
    required(env.GOOGLE_DRIVE_PRIVATE_KEY) ??
    serviceAccount?.private_key ??
    decodeBase64PrivateKey(required(env.GOOGLE_DRIVE_PRIVATE_KEY_BASE64));
  if (!rawPrivateKey) throw new Error("GOOGLE_DRIVE_PRIVATE_KEY_NOT_CONFIGURED");

  const fileId = required(env.GOOGLE_DRIVE_FILE_ID);
  const folderId = required(env.GOOGLE_DRIVE_FOLDER_ID);
  if (!fileId && !folderId) {
    throw new Error("GOOGLE_DRIVE_FILE_TARGET_NOT_CONFIGURED");
  }

  return {
    clientEmail,
    privateKey: rawPrivateKey.replace(/\\n/g, "\n"),
    fileId,
    folderId,
    fileName:
      required(env.GOOGLE_DRIVE_FILE_NAME) ?? defaultGoogleDriveFileName(env),
  };
}

function decodeBase64PrivateKey(value: string | null): string | null {
  if (!value) return null;
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new TextDecoder().decode(bytes);
}
