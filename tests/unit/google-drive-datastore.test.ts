import { afterEach, describe, expect, it, vi } from "vitest";
import { APPROVED_TEMPLATE_KEY, APPROVED_TEMPLATE_STEPS } from "@/lib/schedule/approved-template";
import {
  GoogleDriveApiFileClient,
  GoogleDriveDataStore,
  createEmptyGoogleDriveDocument,
  type GoogleDriveFileClient,
} from "@/lib/google-drive/datastore";

class FakeDriveFileClient implements GoogleDriveFileClient {
  content: string | null = null;
  writes: string[] = [];

  constructor(initialContent: string | null = null) {
    this.content = initialContent;
  }

  async readText(): Promise<string | null> {
    return this.content;
  }

  async writeText(content: string): Promise<void> {
    this.content = content;
    this.writes.push(content);
  }
}

const nowIso = "2026-07-12T12:00:00.000Z";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GoogleDriveDataStore", () => {
  it("creates an empty document seeded with the approved template", () => {
    const document = createEmptyGoogleDriveDocument(nowIso);

    expect(document.schemaVersion).toBe(1);
    expect(document.templates).toEqual([
      {
        key: APPROVED_TEMPLATE_KEY,
        name: "Procurement timeline",
        version: 1,
        steps: APPROVED_TEMPLATE_STEPS,
      },
    ]);
    expect(document.projects).toEqual([]);
    expect(document.holidays).toEqual([]);
    expect(document.holidayCalendarYears).toEqual([]);
    expect(document.updatedAt).toBe(nowIso);
  });

  it("initializes a missing Drive file when reading", async () => {
    const client = new FakeDriveFileClient();
    const store = new GoogleDriveDataStore(client, () => nowIso);

    const document = await store.read();

    expect(document.templates[0].key).toBe(APPROVED_TEMPLATE_KEY);
    expect(client.writes).toHaveLength(1);
  });

  it("reads an existing valid Drive document", async () => {
    const existing = createEmptyGoogleDriveDocument(nowIso);
    existing.projects.push({
      id: "project-1",
      name: "City Expo",
      ownerName: "POND",
      budget: 29000000,
      budgetCategory: "TEN_TO_TWENTY_MILLION",
      startDate: "2026-07-13",
      note: "",
      templateKey: APPROVED_TEMPLATE_KEY,
      templateVersion: 1,
      processEndDate: "2026-09-04",
      isProcessEndManuallyAdjusted: false,
      scheduleStatus: "NORMAL",
      version: 1,
      createdAt: nowIso,
      updatedAt: nowIso,
      steps: [],
    });
    const client = new FakeDriveFileClient(JSON.stringify(existing));
    const store = new GoogleDriveDataStore(client, () => "2026-07-13T00:00:00.000Z");

    const document = await store.read();

    expect(document.projects[0].name).toBe("City Expo");
    expect(client.writes).toHaveLength(0);
  });

  it("saves mutations back to Drive", async () => {
    const client = new FakeDriveFileClient(JSON.stringify(createEmptyGoogleDriveDocument(nowIso)));
    const store = new GoogleDriveDataStore(client, () => "2026-07-13T00:00:00.000Z");

    const count = await store.mutate((document) => {
      document.holidays.push({
        id: "holiday-1",
        date: "2026-07-29",
        name: "วันหยุด",
        sourceNote: "manual",
        scope: "NATIONWIDE",
        origin: "MANUAL",
        officialSourceUrl: null,
        officialSourceLabel: null,
        lastConfirmedAt: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
      return document.holidays.length;
    });

    expect(count).toBe(1);
    expect(JSON.parse(client.content ?? "{}").holidays).toHaveLength(1);
    expect(JSON.parse(client.content ?? "{}").updatedAt).toBe("2026-07-13T00:00:00.000Z");
  });

  it("rejects invalid JSON data clearly", async () => {
    const client = new FakeDriveFileClient("{not-json");
    const store = new GoogleDriveDataStore(client, () => nowIso);

    await expect(store.read()).rejects.toThrow("GOOGLE_DRIVE_DATA_INVALID");
  });
});

describe("GoogleDriveApiFileClient", () => {
  it("uses fetch-based Google Drive REST calls for shared files", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ access_token: "access-token", expires_in: 3600 }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = GoogleDriveApiFileClient.fromConfig(
      {
        clientEmail: "service@example.iam.gserviceaccount.com",
        privateKey: "unused-in-test",
        fileId: "drive-file-id",
        folderId: null,
        fileName: "procurement-timeline-data.json",
      },
      {
        signJwt: async () => "signed.jwt",
        nowSeconds: () => 1_000,
      },
    );

    const content = await client.readText();

    expect(content).toBe("{}");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe("https://oauth2.googleapis.com/token");
    expect(fetchMock.mock.calls[1][0]).toBe(
      "https://www.googleapis.com/drive/v3/files/drive-file-id?alt=media",
    );
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      headers: { Authorization: "Bearer access-token" },
    });
  });
});
