/**
 * Compiles the shelf binary: the CLI, the API server and the web app (with
 * Tailwind) in one executable. Usage: bun scripts/build.ts [--target bun-linux-x64] [--outfile path]
 */
import { parseArgs } from "node:util";
import tailwind from "bun-plugin-tailwind";

export async function compile(options: { target?: string; outfile: string }): Promise<void> {
  const result = await Bun.build({
    entrypoints: ["packages/cli/src/main.ts"],
    compile: {
      outfile: options.outfile,
      ...(options.target ? { target: options.target as Bun.Build.CompileTarget } : {}),
    },
    minify: true,
    bytecode: true,
    plugins: [tailwind],
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
  });
  if (!result.success) {
    throw new AggregateError(result.logs, `Building ${options.outfile} failed`);
  }
}

if (import.meta.main) {
  const { values } = parseArgs({
    options: { target: { type: "string" }, outfile: { type: "string", default: "dist/shelf" } },
  });
  await compile({ outfile: values.outfile, ...(values.target ? { target: values.target } : {}) });
  console.log(`built ${values.outfile}`);
}
