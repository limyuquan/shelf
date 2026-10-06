/**
 * Lays out npm packages in dist/npm/ from the binaries built by build-all.ts:
 * one per platform (`os`/`cpu`-gated, holding the binary) and a launcher package
 * that lists them as optionalDependencies — npm installs only the matching one,
 * with no install scripts. Set NPM_SCOPE to publish under another scope.
 */
import { chmod, cp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import cliPackage from "../packages/cli/package.json" with { type: "json" };
import { PLATFORMS, platformId } from "./targets.ts";

const scope = process.env.NPM_SCOPE ?? "@limyuquan";
const version = cliPackage.version;
const out = "dist/npm";
const common = {
  version,
  license: "MIT",
  repository: { type: "git", url: "git+https://github.com/limyuquan/shelf.git" },
};

await rm(out, { recursive: true, force: true });

for (const platform of PLATFORMS) {
  const id = platformId(platform);
  const dir = join(out, id);
  await mkdir(join(dir, "bin"), { recursive: true });
  await cp(join("dist", id, platform.binary), join(dir, "bin", platform.binary));
  await chmod(join(dir, "bin", platform.binary), 0o755);
  await writeJson(join(dir, "package.json"), {
    name: `${scope}/${id}`,
    ...common,
    description: `shelf binary for ${platform.os}-${platform.cpu}`,
    os: [platform.os],
    cpu: [platform.cpu],
    files: ["bin"],
  });
}

const main = join(out, "shelf");
await mkdir(join(main, "bin"), { recursive: true });
await cp("npm/shelf.js", join(main, "bin", "shelf.js"));
await cp("README.md", join(main, "README.md"));
await cp("LICENSE", join(main, "LICENSE"));
await writeJson(join(main, "package.json"), {
  name: `${scope}/shelf`,
  ...common,
  description:
    "A personal skill library for coding agents: borrow skills into projects, with due dates",
  keywords: ["agent-skills", "claude-code", "codex", "cursor", "skills", "cli"],
  bin: { shelf: "bin/shelf.js" },
  files: ["bin", "README.md", "LICENSE"],
  engines: { node: ">=18" },
  optionalDependencies: Object.fromEntries(
    PLATFORMS.map((platform) => [`${scope}/${platformId(platform)}`, version]),
  ),
});
console.log(`npm packages for ${scope} ${version} in ${out}/`);

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}
