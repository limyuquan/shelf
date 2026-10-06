/**
 * Runs the dashboard with hot reloading for working on the web app. Uses a fresh
 * demo shelf (scripts/demo/seed.ts) unless --real is passed, so development never
 * touches your real ~/.shelf by accident.
 *
 * Usage: bun run dev [--real] [--port N]
 */
import { parseArgs } from "node:util";
import { createContext } from "@shelf/core";
import { loadToken, startServer } from "@shelf/server";
import pkg from "../packages/cli/package.json" with { type: "json" };
import bundledSkill from "../packages/skill/SKILL.md" with { type: "text" };
import page from "../packages/web/index.html";
import { seedDemo } from "./demo/seed.ts";

const { values } = parseArgs({
  options: { real: { type: "boolean" }, port: { type: "string" } },
});

const env = values.real ? process.env : { ...process.env, ...(await seedDemo()).env };
const ctx = await createContext({ actor: "user:dashboard", env });
const server = startServer(ctx, {
  page,
  port: values.port ? Number(values.port) : 4173,
  development: true,
  token: await loadToken(ctx.paths.home),
  system: { version: pkg.version, bundledSkill, hookCommand: "shelf" },
});
console.log(`shelf dashboard (${values.real ? "real ~/.shelf" : "demo data"}): ${server.url}`);
