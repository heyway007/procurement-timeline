# Google Drive Storage Mode Design

## Objective

Add an optional backend storage mode that stores all procurement timeline data in one JSON file on Google Drive instead of PostgreSQL. The existing PostgreSQL mode remains the default and the user interface continues to call the same application APIs.

## Storage Modes

The backend chooses storage through `STORAGE_MODE`.

| Value | Behavior |
| --- | --- |
| `postgres` or unset | Use the existing Prisma/PostgreSQL repositories. |
| `google_drive` | Use Google Drive JSON repositories for projects, holidays, and holiday coverage. |

Google Drive mode must not require end users to sign in. The Next.js server authenticates with a Google service account. The service account email is shared on the target Drive file or folder by the file owner.

## Google Drive File

Google Drive mode stores data in one JSON file, for example `procurement-timeline-data.json`. The file contains:

- `schemaVersion`
- `templates`
- `projects`
- `holidays`
- `holidayCalendarYears`
- `updatedAt`

The file is the source of truth in Google Drive mode. If the file does not exist and `GOOGLE_DRIVE_FILE_ID` is not configured, the app creates it in the configured folder. If a file id is configured, the app reads and writes that file only.

## Environment Variables

Google Drive mode uses these variables:

- `STORAGE_MODE=google_drive`
- `GOOGLE_DRIVE_CLIENT_EMAIL`
- `GOOGLE_DRIVE_PRIVATE_KEY`
- `GOOGLE_DRIVE_FILE_ID` optional when creating a new file by folder
- `GOOGLE_DRIVE_FOLDER_ID` optional when the app should create/find the JSON file in a folder
- `GOOGLE_DRIVE_FILE_NAME` optional, defaults to `procurement-timeline-data.json`

The private key may be stored with escaped newlines (`\n`) and is normalized before authentication.

## Repository Architecture

The existing services already depend on repository interfaces. Google Drive mode adds repository implementations behind the same interfaces:

- `GoogleDriveProjectRepository` implements `ProjectRepository` and `HolidayCalendarReader`.
- `GoogleDriveHolidayRepository` implements `HolidayRepository`.
- A shared `GoogleDriveDataStore` loads, validates, initializes, and saves the JSON document.

Containers choose Prisma or Google Drive repositories based on `STORAGE_MODE`. Business rules stay in existing services, so scheduling, manual date adjustment, holiday recalculation, conflict handling, and official holiday sync behavior remain unchanged.

## Concurrency

The JSON document stores project versions just like PostgreSQL records. Project update/delete operations still require the expected version and return `conflict` when the version is stale.

Because Google Drive writes the whole JSON file, the datastore also tracks the Drive file version/ETag when available. Before saving, it rechecks the remote file metadata/content and retries when safe. If another server changed the file after the current read, the operation reloads and reapplies the repository mutation once. If the business-level version no longer matches, the existing conflict result is returned.

## Initialization

When Google Drive mode first creates an empty file, it seeds the approved procurement template into the JSON document so new projects can be created immediately. Existing PostgreSQL seed scripts remain unchanged.

## Errors and UX

If Google Drive credentials or file access are missing, API routes should return a clear backend configuration error instead of silently falling back to PostgreSQL. The front end can show the existing request error surface.

Common setup failures:

- service account email is not shared on the file/folder
- private key has invalid newline formatting
- neither file id nor folder access is available for the JSON file

## Testing

- Unit tests cover JSON datastore initialization, project create/list/find/replace/remove, holiday list/mutation/reconcile/coverage, and optimistic conflicts.
- Container tests prove `STORAGE_MODE=google_drive` selects Google Drive repositories and missing credentials fail clearly.
- Existing project service, holiday service, schedule, and UI tests continue to pass without Google Drive credentials because PostgreSQL remains the default.

## Acceptance Criteria

- Setting `STORAGE_MODE=google_drive` makes project and holiday APIs use Google Drive JSON storage.
- The app can run without user login in Google Drive mode using a service account.
- Existing UI flows for creating projects, editing milestones, managing holidays, official holiday sync, and printing keep working through the same API contracts.
- PostgreSQL mode remains unchanged when `STORAGE_MODE` is unset or `postgres`.
- Setup instructions in `.env.example` explain all Google Drive variables.
