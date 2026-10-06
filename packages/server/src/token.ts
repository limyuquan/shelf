import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * The dashboard's access token, kept in `<shelf home>/ui-token` (owner-only) so
 * that bookmarks and home-screen shortcuts keep working across restarts. Reading
 * the file already requires the user's account, so persisting it adds no access.
 */
export async function loadToken(home: string, options: { rotate?: boolean } = {}): Promise<string> {
  const file = join(home, "ui-token");
  if (!options.rotate) {
    const existing = (await readFile(file, "utf8").catch(() => "")).trim();
    if (existing.length >= 32) return existing;
  }
  const token = randomBytes(24).toString("base64url");
  await mkdir(home, { recursive: true });
  // Created owner-only from the start, then renamed into place atomically.
  const staging = `${file}.${randomBytes(6).toString("hex")}`;
  await writeFile(staging, `${token}\n`, { mode: 0o600 });
  await rename(staging, file);
  return token;
}
