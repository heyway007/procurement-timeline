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

  it("fits the sequence column and uses the shared table font in the header", () => {
    expect(stylesheet).toMatch(
      /grid-template-columns:\s*16mm\s+minmax\(0,\s*1fr\)\s+100mm\s*!important/,
    );

    const printHeaderBlock = stylesheet.match(
      /\.print-grid:first-child\s*\{([\s\S]*?)\n\s*\}/,
    )?.[1] ?? "";

    expect(printHeaderBlock).toMatch(
      /font-family:\s*"Kanit",\s*Tahoma,\s*sans-serif\s*!important/,
    );
  });

  it("keeps horizontal borders around the printed end row", () => {
    const printEndRowBlock = stylesheet.match(
      /\.print-grid:last-child\s*\{([\s\S]*?)\n\s*\}/,
    )?.[1] ?? "";

    expect(printEndRowBlock).toMatch(/border-top:\s*1px\s+solid\s+#cbd5e1\s*!important/);
    expect(printEndRowBlock).toMatch(/border-bottom:\s*1px\s+solid\s+#cbd5e1\s*!important/);
  });
});
