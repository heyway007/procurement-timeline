const MAX_BYTES = 2_000_000;
const OFFICIAL_HOSTS = new Set(["www.soc.go.th", "soc.go.th"]);

export function officialSocUrl(value: string, base = "https://www.soc.go.th/"): string {
  let url: URL;
  try { url = new URL(value, base); } catch { throw new Error("OFFICIAL_SOURCE_INVALID"); }
  if (url.protocol !== "https:" || !OFFICIAL_HOSTS.has(url.hostname) || url.username || url.password || (url.port && url.port !== "443")) {
    throw new Error("OFFICIAL_SOURCE_INVALID");
  }
  url.hash = "";
  return url.href;
}

/** One bounded discovery run, including redirects and streamed response bodies. */
export class SocSourceReader {
  private requests = 0;
  private controller = new AbortController();
  private timer = setTimeout(() => this.controller.abort(), 8_000);

  close(): void { clearTimeout(this.timer); }

  async read(value: string, format: "html" | "json", redirects = 0): Promise<string> {
    const url = officialSocUrl(value);
    if (this.requests >= 8 || this.controller.signal.aborted) throw new Error("OFFICIAL_SOURCE_UNAVAILABLE");
    this.requests += 1;
    const response = await fetch(url, {
      signal: this.controller.signal,
      redirect: "manual",
      headers: { "User-Agent": "ProcurementTimeline/1.0 (+official-holiday-sync)", Accept: format === "json" ? "application/json" : "text/html" },
      cache: "no-store",
    });
    if (response.url) officialSocUrl(response.url);
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location || redirects >= 2) throw new Error("OFFICIAL_SOURCE_INVALID");
      return this.read(officialSocUrl(location, url), format, redirects + 1);
    }
    if (!response.ok) throw new Error("OFFICIAL_SOURCE_UNAVAILABLE");
    const contentType = response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
    if (format === "html" ? contentType !== "text/html" : !contentType || !/^application\/(?:[\w.-]+\+)?json$/.test(contentType)) {
      throw new Error("OFFICIAL_SOURCE_INVALID");
    }
    if (Number(response.headers.get("content-length") ?? 0) > MAX_BYTES) throw new Error("OFFICIAL_SOURCE_TOO_LARGE");
    if (!response.body) return "";
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let total = 0;
    let text = "";
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        total += chunk.value.byteLength;
        if (total > MAX_BYTES) {
          await reader.cancel();
          throw new Error("OFFICIAL_SOURCE_TOO_LARGE");
        }
        text += decoder.decode(chunk.value, { stream: true });
      }
      return text + decoder.decode();
    } finally {
      reader.releaseLock();
    }
  }
}
