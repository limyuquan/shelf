import { type Context, closeContext, createContext } from "@shelf/core";
import { type ArgsDef, type CommandDef, defineCommand, type ParsedArgs } from "citty";
import { detectActor } from "./actor.ts";
import { type CommandOutput, printFailure, printSuccess } from "./output.ts";

const globalArgs = {
  json: {
    type: "boolean",
    description: "Print a single-line JSON envelope { schemaVersion, ok, data | error }",
  },
  actor: {
    type: "string",
    description: "Who is acting, recorded in the activity log (default: auto-detected)",
  },
} as const satisfies ArgsDef;

type WithGlobals<A extends ArgsDef> = A & typeof globalArgs;

interface ShelfCommandDef<A extends ArgsDef> {
  readonly name: string;
  readonly description: string;
  readonly args?: A;
  readonly run: (ctx: Context, args: ParsedArgs<WithGlobals<A>>) => Promise<CommandOutput>;
}

/**
 * Defines a subcommand with the shared flags, a service context, uniform output
 * (human text or JSON envelope) and exit codes. Commands only map args to a core
 * service call and render its result.
 */
export function shelfCommand<const A extends ArgsDef = Record<never, never>>(
  def: ShelfCommandDef<A>,
): CommandDef<WithGlobals<A>> {
  return defineCommand({
    meta: { name: def.name, description: def.description },
    args: { ...globalArgs, ...def.args } as WithGlobals<A>,
    async run({ args }) {
      const json = Boolean(args.json);
      let ctx: Context | undefined;
      try {
        ctx = await createContext({ actor: detectActor(args.actor) });
        printSuccess(await def.run(ctx, args), json);
      } catch (error) {
        process.exitCode = printFailure(error, json);
      } finally {
        if (ctx) closeContext(ctx);
      }
    },
  });
}

/** All positional arguments, for commands that accept several names. */
export function positionals(args: { _: string[] }): string[] {
  return args._.filter((value) => value.length > 0);
}
