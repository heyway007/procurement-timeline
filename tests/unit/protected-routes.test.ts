// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => new Headers(),
}));

import * as projects from "@/app/api/projects/route";
import * as project from "@/app/api/projects/[id]/route";
import * as step from "@/app/api/projects/[id]/steps/[order]/route";
import * as end from "@/app/api/projects/[id]/process-end/route";
import * as reset from "@/app/api/projects/[id]/reset-schedule/route";
import * as bid from "@/app/api/projects/[id]/bid-submission-time/route";
import * as holidays from "@/app/api/holidays/route";
import * as preview from "@/app/api/holidays/preview/route";
import * as confirm from "@/app/api/holidays/confirm/route";
import * as year from "@/app/api/holiday-years/[year]/route";

const context = { params: Promise.resolve({ id: "some-project", order: "1", year: "2026" }) };
type Handler = (request: NextRequest, routeContext: typeof context) => Promise<Response>;
const cases: Array<[string, string, Handler]> = [
  ["list", "GET", projects.GET], ["create", "POST", projects.POST],
  ["detail", "GET", project.GET], ["update", "PATCH", project.PATCH], ["delete", "DELETE", project.DELETE],
  ["step", "PATCH", step.PATCH], ["end", "PATCH", end.PATCH],
  ["reset", "POST", reset.POST], ["bid", "PATCH", bid.PATCH],
  ["holidays", "GET", holidays.GET], ["holiday sync", "POST", holidays.POST],
  ["holiday preview", "POST", preview.POST], ["holiday confirm", "POST", confirm.POST],
  ["verify year", "PUT", year.PUT],
];

describe("private API routes", () => {
  it.each(cases)("requires a session for %s", async (_label, method, handler) => {
    const request = new NextRequest("https://timeline.example/api/projects?year=2026", {
      method,
      headers: { Origin: "https://timeline.example", "Content-Type": "application/json" },
      ...(method === "GET" ? {} : { body: JSON.stringify({ version: 1, year: 2026, sourceNote: "test", token: "test" }) }),
    });
    const response = await handler(request, context);
    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(await response.json()).not.toHaveProperty("projects");
  });

  it.each(cases.filter(([, method]) => method !== "GET"))("rejects cross-origin %s before any mutation", async (_label, method, handler) => {
    const response = await handler(new NextRequest("https://timeline.example/api/projects", {
      method, headers: { Origin: "https://other.example", "Content-Type": "application/json" }, body: "{}",
    }), context);
    expect(response.status).toBe(403);
  });
});
