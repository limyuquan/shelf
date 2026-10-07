/**
 * Builds the website's read-only dashboard demo: the real web app (same Bun.build
 * and Tailwind setup as scripts/build.ts) with a fetch shim that answers the API
 * from a snapshot of the demo shelf, and hash routing, so it runs as static files
 * under any base path (GitHub Pages serves it at /shelf/demo/).
 *
 * Usage: bun scripts/site/demo/build.ts [--out dist/site/demo] [--serve] [--port 4241]
 *   --serve  serves the output at http://localhost:<port>/shelf/demo/ after building
 */
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join, normalize, resolve, sep } from "node:path";
import { parseArgs } from "node:util";
import type { BunPlugin } from "bun";
import tailwind from "bun-plugin-tailwind";
import { recordSnapshot } from "./snapshot.ts";

const ROOT = resolve(import.meta.dir, "../../..");
const SEAM = join(ROOT, "packages/web/src/app/history.ts");

/**
 * The web app's router takes its history from app/history.ts (browser history
 * by default). The demo swaps in hash history: Pages has no index.html fallback.
 */
function hashHistory(used: { value: boolean }): BunPlugin {
  return {
    name: "shelf-demo-hash-history",
    setup(build) {
      build.onLoad({ filter: /[\\/]app[\\/]history\.ts$/ }, (args) => {
        if (normalize(args.path) !== SEAM) return undefined;
        used.value = true;
        return {
          loader: "ts",
          contents: `import { createHashHistory } from "@tanstack/react-router";\nexport const history = createHashHistory();\n`,
        };
      });
    },
  };
}

/**
 * Inter ships every script's subset inlined in the CSS; the demo's text is
 * English, so it keeps the basic Latin one (the rest fall back to system fonts).
 */
function keepLatinFont(css: string): string {
  const faces = [...css.matchAll(/@font-face\{[^}]*\}/g)].map((match) => match[0]);
  const inter = faces.filter((face) => face.includes("Inter Variable"));
  const latin = inter.filter((face) => /unicode-range:U\+\?\?[,;}]/.test(face));
  if (latin.length !== 1) {
    console.warn("demo: couldn't find Inter's Latin subset; keeping every subset");
    return css;
  }
  return inter
    .filter((face) => face !== latin[0])
    .reduce((out, face) => out.replace(face, ""), css);
}

/** Writes the demo (index.html, assets, snapshot.json) into `outDir`, replacing it. */
export async function buildDemo(outDir: string): Promise<void> {
  const snapshot = await recordSnapshot();
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const swapped = { value: false };
  const result = await Bun.build({
    entrypoints: [join(import.meta.dir, "index.html")],
    outdir: outDir,
    target: "browser",
    minify: true,
    sourcemap: "none",
    plugins: [hashHistory(swapped), tailwind],
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
  });
  if (!result.success) throw new AggregateError(result.logs, "Building the demo failed");
  if (!swapped.value) throw new Error(`The demo build never loaded ${SEAM}; hash routing is off`);

  for (const output of result.outputs) {
    if (output.path.endsWith(".css")) {
      await writeFile(output.path, keepLatinFont(await readFile(output.path, "utf8")));
    }
  }
  await writeFile(join(outDir, "snapshot.json"), JSON.stringify(snapshot));
}

/** Total size of a directory's files, in bytes. */
async function sizeOf(dir: string): Promise<number> {
  let total = 0;
  for (const entry of await readdir(dir, { recursive: true, withFileTypes: true })) {
    if (entry.isFile()) total += (await stat(join(entry.parentPath, entry.name))).size;
  }
  return total;
}

/**
 * Serves `dir` at `/shelf/demo/` like GitHub Pages: static files only, no
 * fallback to index.html.
 */
export function serveDemo(dir: string, port: number) {
  const prefix = "/shelf/demo/";
  const root = resolve(dir);
  return Bun.serve({
    hostname: "127.0.0.1",
    port,
    async fetch(request) {
      const { pathname } = new URL(request.url);
      if (pathname === "/" || pathname === "/shelf/demo") return Response.redirect(prefix, 302);
      if (!pathname.startsWith(prefix)) return new Response("Not found", { status: 404 });
      const relative = decodeURIComponent(pathname.slice(prefix.length)) || "index.html";
      const path = resolve(root, relative.endsWith("/") ? `${relative}index.html` : relative);
      if (!path.startsWith(root + sep)) return new Response("Not found", { status: 404 });
      const file = Bun.file(path);
      return (await file.exists())
        ? new Response(file)
        : new Response("Not found", { status: 404 });
    },
  });
}

if (import.meta.main) {
  const { values } = parseArgs({
    options: {
      out: { type: "string", default: "dist/site/demo" },
      serve: { type: "boolean" },
      port: { type: "string", default: "4241" },
    },
  });
  await buildDemo(values.out);
  console.log(`built ${values.out} (${Math.round((await sizeOf(values.out)) / 1024)} KB)`);
  if (values.serve) {
    const server = serveDemo(values.out, Number(values.port));
    console.log(`demo: http://localhost:${server.port}/shelf/demo/`);
  }
}
