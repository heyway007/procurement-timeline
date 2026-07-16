import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertGoogleDriveEnv,
  storageModeFromEnv,
} from "@/lib/storage/config";

describe("storage config", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses postgres storage when STORAGE_MODE is not set", () => {
    expect(storageModeFromEnv({})).toBe("postgres");
  });

  it("uses postgres storage when STORAGE_MODE is postgres", () => {
    expect(storageModeFromEnv({ STORAGE_MODE: "postgres" })).toBe("postgres");
  });

  it("uses google drive storage when STORAGE_MODE is google_drive", () => {
    expect(storageModeFromEnv({ STORAGE_MODE: "google_drive" })).toBe(
      "google_drive",
    );
  });

  it("rejects unsupported storage modes", () => {
    expect(() => storageModeFromEnv({ STORAGE_MODE: "sqlite" })).toThrow(
      "STORAGE_MODE_UNSUPPORTED",
    );
  });

  it("normalizes escaped private-key newlines", () => {
    const config = assertGoogleDriveEnv({
      GOOGLE_DRIVE_CLIENT_EMAIL: "timeline@example.iam.gserviceaccount.com",
      GOOGLE_DRIVE_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n",
      GOOGLE_DRIVE_FILE_ID: "drive-file-id",
    });

    expect(config).toEqual({
      clientEmail: "timeline@example.iam.gserviceaccount.com",
      privateKey: "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n",
      fileId: "drive-file-id",
      folderId: null,
      fileName: "procurement-timeline-data.local.json",
    });
  });

  it("supports base64-encoded private keys for hosted secrets", () => {
    const privateKey = "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n";
    const config = assertGoogleDriveEnv({
      GOOGLE_DRIVE_CLIENT_EMAIL: "timeline@example.iam.gserviceaccount.com",
      GOOGLE_DRIVE_PRIVATE_KEY_BASE64: Buffer.from(privateKey, "utf8").toString("base64"),
      GOOGLE_DRIVE_FILE_ID: "drive-file-id",
    });

    expect(config.privateKey).toBe(privateKey);
  });

  it("loads Google Drive credentials from a service account JSON file", () => {
    const config = assertGoogleDriveEnv({
      GOOGLE_APPLICATION_CREDENTIALS: "tests/fixtures/google-service-account.json",
      GOOGLE_DRIVE_FILE_ID: "drive-file-id",
    });

    expect(config.clientEmail).toBe("timeline@example.iam.gserviceaccount.com");
    expect(config.privateKey).toBe("-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n");
  });

  it("decodes base64 private keys without Node Buffer", () => {
    vi.stubGlobal("Buffer", undefined);
    const privateKey = "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n";
    const config = assertGoogleDriveEnv({
      GOOGLE_DRIVE_CLIENT_EMAIL: "timeline@example.iam.gserviceaccount.com",
      GOOGLE_DRIVE_PRIVATE_KEY_BASE64: btoa(privateKey),
      GOOGLE_DRIVE_FILE_ID: "drive-file-id",
    });

    expect(config.privateKey).toBe(privateKey);
  });

  it("requires service account credentials in google drive mode", () => {
    expect(() => assertGoogleDriveEnv({ GOOGLE_DRIVE_FILE_ID: "file" })).toThrow(
      "GOOGLE_DRIVE_CLIENT_EMAIL_NOT_CONFIGURED",
    );
    expect(() =>
      assertGoogleDriveEnv({
        GOOGLE_DRIVE_CLIENT_EMAIL: "timeline@example.iam.gserviceaccount.com",
        GOOGLE_DRIVE_FILE_ID: "file",
      }),
    ).toThrow("GOOGLE_DRIVE_PRIVATE_KEY_NOT_CONFIGURED");
  });

  it("requires either a file id or a folder id in google drive mode", () => {
    expect(() =>
      assertGoogleDriveEnv({
        GOOGLE_DRIVE_CLIENT_EMAIL: "timeline@example.iam.gserviceaccount.com",
        GOOGLE_DRIVE_PRIVATE_KEY: "key",
      }),
    ).toThrow("GOOGLE_DRIVE_FILE_TARGET_NOT_CONFIGURED");
  });

  it("uses custom file name when configured", () => {
    const config = assertGoogleDriveEnv({
      GOOGLE_DRIVE_CLIENT_EMAIL: "timeline@example.iam.gserviceaccount.com",
      GOOGLE_DRIVE_PRIVATE_KEY: "key",
      GOOGLE_DRIVE_FOLDER_ID: "folder",
      GOOGLE_DRIVE_FILE_NAME: "custom.json",
    });

    expect(config.fileId).toBeNull();
    expect(config.folderId).toBe("folder");
    expect(config.fileName).toBe("custom.json");
  });

  it("uses the production data file only when APP_ENV is production", () => {
    const config = assertGoogleDriveEnv({
      APP_ENV: "production",
      GOOGLE_DRIVE_CLIENT_EMAIL: "timeline@example.iam.gserviceaccount.com",
      GOOGLE_DRIVE_PRIVATE_KEY: "key",
      GOOGLE_DRIVE_FILE_ID: "prod-file",
    });

    expect(config.fileName).toBe("procurement-timeline-data.json");
  });
});
