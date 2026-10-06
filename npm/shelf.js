#!/usr/bin/env node
// Launcher installed by the npm package: runs the native binary from the
// platform package npm selected through optionalDependencies.

const { spawnSync } = require("node:child_process");
const path = require("node:path");

const id = `shelf-${process.platform}-${process.arch}`;
const scope = require("../package.json").name.split("/")[0];
const binary = process.platform === "win32" ? "shelf.exe" : "shelf";

let executable;
try {
  executable = path.join(
    path.dirname(require.resolve(`${scope}/${id}/package.json`)),
    "bin",
    binary,
  );
} catch {
  console.error(
    `shelf: no prebuilt binary for ${process.platform}-${process.arch} (${scope}/${id} is not installed).\n` +
      "Reinstall without --no-optional / --omit=optional, or download a binary from the GitHub release.",
  );
  process.exit(1);
}

const result = spawnSync(executable, process.argv.slice(2), { stdio: "inherit" });
if (result.error) {
  console.error(`shelf: failed to run ${executable}: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
