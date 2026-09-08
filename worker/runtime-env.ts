export interface RuntimeEnvBindings {
  AUTH_PROVIDER?: string;
  AUTH_MOCK_USERS_JSON?: string;
  AUTH_ADMIN_EXTERNAL_IDS_JSON?: string;
  AUTH_EXTERNAL_URL?: string;
  AUTH_EXTERNAL_PROVIDER_ID?: string;
  AUTH_EXTERNAL_API_KEY?: string;
  DATABASE_URL?: string;
  STORAGE_MODE?: string;
  GOOGLE_DRIVE_CLIENT_EMAIL?: string;
  GOOGLE_DRIVE_PRIVATE_KEY?: string;
  GOOGLE_DRIVE_PRIVATE_KEY_BASE64?: string;
  GOOGLE_DRIVE_FILE_ID?: string;
  GOOGLE_DRIVE_FOLDER_ID?: string;
  GOOGLE_DRIVE_FILE_NAME?: string;
  HOLIDAY_PREVIEW_SECRET?: string;
}

const RUNTIME_ENV_KEYS = [
  "AUTH_PROVIDER",
  "AUTH_MOCK_USERS_JSON",
  "AUTH_ADMIN_EXTERNAL_IDS_JSON",
  "AUTH_EXTERNAL_URL",
  "AUTH_EXTERNAL_PROVIDER_ID",
  "AUTH_EXTERNAL_API_KEY",
  "DATABASE_URL",
  "STORAGE_MODE",
  "GOOGLE_DRIVE_CLIENT_EMAIL",
  "GOOGLE_DRIVE_PRIVATE_KEY",
  "GOOGLE_DRIVE_PRIVATE_KEY_BASE64",
  "GOOGLE_DRIVE_FILE_ID",
  "GOOGLE_DRIVE_FOLDER_ID",
  "GOOGLE_DRIVE_FILE_NAME",
  "HOLIDAY_PREVIEW_SECRET",
] as const satisfies readonly (keyof RuntimeEnvBindings)[];

export function syncRuntimeEnv(env: RuntimeEnvBindings): void {
  if (typeof process === "undefined" || !process.env) return;
  for (const key of RUNTIME_ENV_KEYS) {
    const value = env[key];
    if (typeof value === "string") process.env[key] = value;
  }
}
