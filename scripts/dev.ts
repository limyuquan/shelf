/**
 * Runs the dashboard with hot reloading for working on the web app. Uses a fresh
 * demo shelf (scripts/demo/seed.ts) unless --real is passed, so development never
 * touches your real ~/.shelf by accident.
 *
 * Usage: bun run dev [--real] [--port N]
 */
import { parseArgs } from "node:util";
import { createContext } from "@shelf/core";
import { startServer } from "@shelf/server";
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
});
console.log(`shelf dashboard (${values.real ? "real ~/.shelf" : "demo data"}): ${server.url}`);
