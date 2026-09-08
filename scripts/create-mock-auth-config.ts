import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { hashMockPassword } from "../lib/auth/password";

// Local operator utility. Generated secrets/credentials live in a git-ignored directory.
const outputDirectory = resolve(".codex-logs/auth-demo");
await mkdir(outputDirectory, { recursive: true });
const accounts = [
  { externalUserId: "demo-admin", email: "admin@timeline.test", displayName: "ผู้ดูแลทดสอบ" },
  { externalUserId: "demo-member", email: "member@timeline.test", displayName: "ผู้ใช้งานทดสอบ" },
].map(account => ({ ...account, password: randomBytes(18).toString("base64url") }));
const users = await Promise.all(accounts.map(async ({ password, ...account }) => ({
  ...account, passwordHash: await hashMockPassword(password),
})));
const secretsFile = resolve(outputDirectory, "worker-secrets.json");
const credentialsFile = resolve(outputDirectory, "accounts.txt");
// Exclusive creation avoids silently changing an already configured account's password.
await writeFile(secretsFile, JSON.stringify({
  AUTH_PROVIDER: "mock",
  AUTH_MOCK_USERS_JSON: JSON.stringify(users),
  AUTH_ADMIN_EXTERNAL_IDS_JSON: JSON.stringify(["demo-admin"]),
}, null, 2), { flag: "wx", mode: 0o600 });
await writeFile(credentialsFile, [
  "บัญชีทดสอบ Timeline — เก็บไฟล์นี้ไว้ส่วนตัว",
  "https://timeline.workplatform.workers.dev/login",
  "",
  ...accounts.flatMap((account, index) => [
    `${index === 0 ? "ผู้ดูแลปฏิทินส่วนกลาง" : "สมาชิก"}: ${account.displayName}`,
    `Email: ${account.email}`,
    `Password: ${account.password}`,
    "",
  ]),
  "แต่ละบัญชีเห็นเฉพาะโครงการของตนเอง โครงการเดิมยังไม่ได้ผูกเจ้าของ",
  "บัญชีนี้เป็นตัวจำลอง เมื่อเชื่อม Auth จริงให้ปิด mock และยกเลิก session ทดสอบ",
].join("\n"), { flag: "wx", mode: 0o600 });
console.log(JSON.stringify({ secretsFile, credentialsFile, emails: accounts.map(account => account.email) }));
