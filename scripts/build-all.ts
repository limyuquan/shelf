/**
 * Cross-compiles shelf for every release platform into dist/<platform>/.
 * Usage: bun scripts/build-all.ts [platform-id …]
 */
import { $ } from "bun";
import { PLATFORMS, platformId } from "./targets.ts";

const only = new Set(process.argv.slice(2));
for (const platform of PLATFORMS) {
  const id = platformId(platform);
  if (only.size > 0 && !only.has(id)) continue;
  const outfile = `dist/${id}/${platform.binary}`;
  await $`bun build --compile --minify --bytecode --target=${platform.bunTarget} packages/cli/src/main.ts --outfile ${outfile}`.quiet();
  console.log(`built ${outfile}`);
}
