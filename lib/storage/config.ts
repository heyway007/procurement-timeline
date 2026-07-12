export type StorageMode = "postgres" | "google_drive";

export type GoogleDriveStorageConfig = {
  clientEmail: string;
  privateKey: string;
  fileId: string | null;
  folderId: string | null;
  fileName: string;
};

const DEFAULT_GOOGLE_DRIVE_FILE_NAME = "procurement-timeline-data.json";

function required(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function storageModeFromEnv(env: Partial<NodeJS.ProcessEnv>): StorageMode {
  const mode = required(env.STORAGE_MODE) ?? "postgres";
  if (mode === "postgres" || mode === "google_drive") return mode;
  throw new Error("STORAGE_MODE_UNSUPPORTED");
}

export function assertGoogleDriveEnv(
  env: Partial<NodeJS.ProcessEnv>,
): GoogleDriveStorageConfig {
  const clientEmail = required(env.GOOGLE_DRIVE_CLIENT_EMAIL);
  if (!clientEmail) throw new Error("GOOGLE_DRIVE_CLIENT_EMAIL_NOT_CONFIGURED");

  const rawPrivateKey =
    required(env.GOOGLE_DRIVE_PRIVATE_KEY) ??
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
      required(env.GOOGLE_DRIVE_FILE_NAME) ?? DEFAULT_GOOGLE_DRIVE_FILE_NAME,
  };
}

function decodeBase64PrivateKey(value: string | null): string | null {
  if (!value) return null;
  return Buffer.from(value, "base64").toString("utf8");
}
