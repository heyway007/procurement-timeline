import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const stylesheet = fs.readFileSync(
  path.resolve(process.cwd(), "app/globals.css"),
  "utf8",
);

describe("print stylesheet", () => {
  it("does not lock browser print settings with an @page rule", () => {
    expect(stylesheet).not.toMatch(/@page\s*\{/);
    expect(stylesheet).not.toMatch(/size:\s*A4\s+landscape/);
    expect(stylesheet).not.toMatch(/margin:\s*8mm/);
  });

  it("removes the table top edge from the printed header", () => {
    const printTableBlock = stylesheet.match(
      /\.print-table\s*\{([\s\S]*?)\n\s*\}/,
    )?.[1] ?? "";

    expect(printTableBlock).toMatch(/border-top:\s*0\s*!important/);
  });
});
