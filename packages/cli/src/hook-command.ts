import { basename } from "node:path";

/**
 * How harness hooks should run shelf: this binary's absolute path when running
 * compiled (hooks may run without the user's shell PATH, e.g. from a desktop
 * app), else whatever `shelf` resolves to on PATH (development, npm launcher).
 */
export function resolveHookCommand(): string {
  if (/^shelf(-[\w-]+)?(\.exe)?$/.test(basename(process.execPath))) return process.execPath;
  return Bun.which("shelf") ?? "shelf";
}
