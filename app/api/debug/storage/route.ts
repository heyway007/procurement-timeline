import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getGoogleDriveDataStore } from "@/lib/google-drive/container";
import { assertGoogleDriveEnv, storageModeFromEnv } from "@/lib/storage/config";

function errorInfo(error: unknown): { name: string; message: string } {
  if (error instanceof Error) {
    return { name: error.name, message: error.message.slice(0, 240) };
  }
  return { name: typeof error, message: String(error).slice(0, 240) };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const env = process.env;
  const base = {
    hasProcessEnv: Boolean(env),
    storageMode: env.STORAGE_MODE ?? null,
    hasClientEmail: Boolean(env.GOOGLE_DRIVE_CLIENT_EMAIL),
    hasPrivateKey: Boolean(env.GOOGLE_DRIVE_PRIVATE_KEY),
    hasPrivateKeyBase64: Boolean(env.GOOGLE_DRIVE_PRIVATE_KEY_BASE64),
    hasFileId: Boolean(env.GOOGLE_DRIVE_FILE_ID),
    hasFolderId: Boolean(env.GOOGLE_DRIVE_FOLDER_ID),
    fileName: env.GOOGLE_DRIVE_FILE_NAME ?? null,
  };

  try {
    const mode = storageModeFromEnv(env);
    const config = mode === "google_drive" ? assertGoogleDriveEnv(env) : null;
    const store = mode === "google_drive" ? getGoogleDriveDataStore() : null;
    const document = store ? await store.read() : null;
    const writeResult = request.nextUrl.searchParams.get("write") === "1" && store
      ? await store.mutate((draft) => ({
          projects: draft.projects.length,
          updatedAt: draft.updatedAt,
        }))
      : null;
    return NextResponse.json({
      ok: true,
      ...base,
      resolvedMode: mode,
      config: config
        ? {
            clientEmail: config.clientEmail,
            privateKeyLength: config.privateKey.length,
            fileId: config.fileId,
            folderId: config.folderId,
            fileName: config.fileName,
          }
        : null,
      document: document
        ? {
            projects: document.projects.length,
            holidays: document.holidays.length,
            templates: document.templates.length,
          }
        : null,
      writeResult,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      ...base,
      error: errorInfo(error),
    });
  }
}
