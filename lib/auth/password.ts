import { randomBytes, pbkdf2, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const derive = promisify(pbkdf2);
// Workerd supports PBKDF2 up to 100,000 iterations. Mock is opt-in only.
const ITERATIONS = 100_000;
export async function hashMockPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const digest = await derive(password, salt, ITERATIONS, 32, "sha256");
  return `pbkdf2-sha256$${ITERATIONS}$${salt}$${digest.toString("hex")}`;
}
export async function verifyMockPassword(password: string, encoded: string): Promise<boolean> {
  const parts = encoded.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2-sha256" || parts[1] !== String(ITERATIONS) || !/^[a-f0-9]{32}$/.test(parts[2]) || !/^[a-f0-9]{64}$/.test(parts[3])) return false;
  const actual = await derive(password, parts[2], ITERATIONS, 32, "sha256");
  return timingSafeEqual(actual, Buffer.from(parts[3], "hex"));
}
