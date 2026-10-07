/**
 * `bun run docs:gen`: fills every generated block (see generate.ts) in docs/ and
 * the site fixtures from the code, and writes schema/config.schema.json.
 *
 * Usage: bun scripts/site/gen.ts [docs-dir…]
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { ROOT } from "./docs.ts";
import { configJsonSchema, fillGenerated } from "./generate.ts";

export const FIXTURES_DIR = join(ROOT, "scripts/site/fixtures/docs");
export const SCHEMA_FILE = join(ROOT, "schema/config.schema.json");

/** Fills the blocks in every .md under `dir`; returns the files it changed. */
export function generateDocs(dir: string): string[] {
  const changed: string[] = [];
  const walk = (sub: string) => {
    for (const entry of readdirSync(join(dir, sub), { withFileTypes: true })) {
      const rel = sub ? `${sub}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(rel);
      else if (entry.name.endsWith(".md")) {
        const file = join(dir, rel);
        const source = readFileSync(file, "utf8");
        const { markdown } = fillGenerated(source, rel.slice(0, -3));
        if (markdown !== source) {
          writeFileSync(file, markdown);
          changed.push(file);
        }
      }
    }
  };
  walk("");
  return changed;
}

export function writeSchema(): boolean {
  const schema = configJsonSchema();
  if (existsSync(SCHEMA_FILE) && readFileSync(SCHEMA_FILE, "utf8") === schema) return false;
  mkdirSync(join(ROOT, "schema"), { recursive: true });
  writeFileSync(SCHEMA_FILE, schema);
  return true;
}

if (import.meta.main) {
  const dirs =
    process.argv.length > 2
      ? process.argv.slice(2).map((dir) => resolve(dir))
      : [join(ROOT, "docs"), FIXTURES_DIR];
  const changed = dirs.filter((dir) => existsSync(dir)).flatMap(generateDocs);
  if (writeSchema()) changed.push(SCHEMA_FILE);
  for (const file of changed) console.log(`updated ${relative(process.cwd(), file)}`);
  if (changed.length === 0) console.log("generated blocks are up to date");
}
