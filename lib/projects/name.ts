export function formatProjectName(name: string): string {
  return name.replace(/^Timeline #(\d+)$/, (_, number: string) =>
    `Timeline #${number.padStart(3, "0")}`,
  );
}
