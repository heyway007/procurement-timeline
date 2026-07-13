import { rm } from "node:fs/promises";

await rm("dist/standalone", { recursive: true, force: true });
