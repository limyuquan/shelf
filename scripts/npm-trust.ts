/**
 * Makes every npm package trust the release workflow (npm trusted publishing),
 * so releases publish without an npm token. Run it once, and again only when a
 * package is added (a new platform). npm requires each package to exist first.
 *
 * Usage: npm login, then bun run npm:trust
 * npm asks for two-factor authentication on the first package; tick its option
 * to skip it for five minutes and the rest go through on their own.
 */
import { PLATFORMS, platformId } from "./targets.ts";

const scope = process.env.NPM_SCOPE ?? "@limyuquan";
// Platform packages first, matching the order the release publishes them in.
const packages = [
  ...PLATFORMS.map((platform) => `${scope}/${platformId(platform)}`),
  `${scope}/shelf`,
];

const failed: string[] = [];
for (const name of packages) {
  console.log(`\n${name}`);
  const result = Bun.spawnSync(
    [
      "npm",
      "trust",
      "github",
      name,
      "--repo",
      "limyuquan/shelf",
      "--file",
      "release.yml",
      "--allow-publish",
      "--yes",
    ],
    { stdio: ["inherit", "inherit", "inherit"] },
  );
  if (result.exitCode !== 0) failed.push(name);
  // npm asks for a pause between calls to avoid rate limiting.
  await Bun.sleep(2000);
}

if (failed.length > 0) {
  console.error(
    `\nNot configured: ${failed.join(", ")}. A package that already trusts a workflow ` +
      "fails here; check it with `npm trust list <package>`.",
  );
  process.exit(1);
}
console.log(`\nAll ${packages.length} packages trust limyuquan/shelf's release.yml.`);
