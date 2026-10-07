/**
 * `bun run site:serve`: serves dist/site under /shelf/ the way GitHub Pages
 * does (directory → index.html, missing → 404.html with status 404, a
 * directory without its trailing slash redirects), with `.md` as Markdown.
 *
 * Usage: bun scripts/site/serve.ts [--port 4211] [--dir dist/site]
 */
import { existsSync, statSync } from "node:fs";
import { join, normalize, resolve } from "node:path";
import { parseArgs } from "node:util";
import { ROOT } from "./docs.ts";

const BASE = "/shelf/";

const TYPES: Record<string, string> = {
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

export function serveSite(dir: string, port: number): ReturnType<typeof Bun.serve> {
  const fileResponse = (file: string, status = 200) => {
    const ext = file.slice(file.lastIndexOf("."));
    const body = Bun.file(file);
    const type = TYPES[ext] ?? body.type;
    return new Response(body, {
      status,
      headers: { "content-type": type, "cache-control": "no-cache" },
    });
  };
  return Bun.serve({
    port,
    hostname: "127.0.0.1",
    fetch(request) {
      const url = new URL(request.url);
      if (url.pathname === "/" || url.pathname === "/shelf") {
        return Response.redirect(`${url.origin}${BASE}`, 302);
      }
      if (!url.pathname.startsWith(BASE)) return new Response("Not found", { status: 404 });
      const rel = decodeURIComponent(url.pathname.slice(BASE.length));
      const target = normalize(join(dir, rel));
      if (!target.startsWith(dir)) return new Response("Forbidden", { status: 403 });
      if (existsSync(target) && statSync(target).isDirectory()) {
        if (!url.pathname.endsWith("/")) {
          return Response.redirect(`${url.origin}${url.pathname}/${url.search}`, 301);
        }
        const index = join(target, "index.html");
        if (existsSync(index)) return fileResponse(index);
      } else if (existsSync(target)) {
        return fileResponse(target);
      }
      const notFound = join(dir, "404.html");
      return existsSync(notFound)
        ? fileResponse(notFound, 404)
        : new Response("Not found", { status: 404 });
    },
  });
}

if (import.meta.main) {
  const { values } = parseArgs({
    options: {
      port: { type: "string", default: "4211" },
      dir: { type: "string", default: join(ROOT, "dist/site") },
    },
  });
  const dir = resolve(values.dir);
  if (!existsSync(dir)) {
    console.error(`${dir} does not exist; run \`bun run site\` first`);
    process.exit(1);
  }
  const server = serveSite(dir, Number(values.port));
  console.log(`serving ${dir} at http://localhost:${server.port}${BASE}`);
}
