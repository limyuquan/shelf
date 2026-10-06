/** Release platforms: Bun compile target → npm `os`/`cpu` and binary name. */
export interface Platform {
  readonly bunTarget: string;
  readonly os: "linux" | "darwin" | "win32";
  readonly cpu: "x64" | "arm64";
  readonly binary: string;
}

export const PLATFORMS: readonly Platform[] = [
  { bunTarget: "bun-linux-x64", os: "linux", cpu: "x64", binary: "shelf" },
  { bunTarget: "bun-linux-arm64", os: "linux", cpu: "arm64", binary: "shelf" },
  { bunTarget: "bun-darwin-x64", os: "darwin", cpu: "x64", binary: "shelf" },
  { bunTarget: "bun-darwin-arm64", os: "darwin", cpu: "arm64", binary: "shelf" },
  { bunTarget: "bun-windows-x64", os: "win32", cpu: "x64", binary: "shelf.exe" },
];

/** `shelf-linux-x64`, matching `process.platform`-`process.arch` at runtime. */
export function platformId(platform: Pick<Platform, "os" | "cpu">): string {
  return `shelf-${platform.os}-${platform.cpu}`;
}
