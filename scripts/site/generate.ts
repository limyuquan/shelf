/**
 * Generated blocks: docs sections filled from the code, so they cannot drift.
 *
 * A page marks a block and `bun run docs:gen` fills the space between the markers
 * (the site build fills them too, and a test fails when a committed block is stale):
 *
 *   <!-- generated:cli borrow -->        usage, arguments and options of `shelf borrow`
 *   <!-- generated:cli set save -->      a subcommand (`cli set` lists set's subcommands)
 *   <!-- generated:cli-index -->         every command, grouped, linking to docs/cli/<command>.md
 *   <!-- generated:errors -->            every error code with its exit code and meaning
 *   <!-- generated:config -->            every config key with its type, default and description
 *   <!-- /generated -->
 *
 * Prose goes around the markers, never inside: whatever is inside is replaced.
 * `cli-index` emits a `###` heading per command group; the other kinds emit no headings.
 */
import { posix } from "node:path";
import { ConfigSchema, ERROR_MEANINGS, type ErrorCode } from "@shelf/core";
import { commandGroups, main } from "../../packages/cli/src/cli.ts";
import {
  EXIT_CODES,
  INTERNAL_ERROR_MEANING,
  INTERNAL_EXIT_CODE,
} from "../../packages/cli/src/output.ts";

/** citty's CommandDef, without importing citty (a dependency of the CLI package only). */
type AnyCommand = (typeof commandGroups)[number]["commands"][string];

/** The page every `cli` block points to for the global `--json` and `--actor` options. */
export const CLI_OVERVIEW_PAGE = "cli/index";

const BLOCK = /<!-- generated:([a-z-]+)((?: [^\s>]+)*) -->[\s\S]*?<!-- \/generated -->/g;
const OPEN = /<!-- generated:([^>]*?) -->/g;

export interface FillResult {
  readonly markdown: string;
  /** The blocks found, e.g. `cli borrow`, in page order. */
  readonly blocks: readonly string[];
}

/** Fills every generated block in a page. `page` is its docs path, e.g. `cli/borrow`. */
export function fillGenerated(markdown: string, page: string): FillResult {
  const opens = [...markdown.matchAll(OPEN)].length;
  const blocks: string[] = [];
  const filled = markdown.replace(BLOCK, (_, kind: string, rest: string) => {
    const args = rest.trim().split(/\s+/).filter(Boolean);
    const spec = [kind, ...args].join(" ");
    blocks.push(spec);
    return `<!-- generated:${spec} -->\n\n${generateBlock(kind, args, page).trim()}\n\n<!-- /generated -->`;
  });
  if (blocks.length !== opens) {
    throw new Error(`${page}.md: a "<!-- generated:… -->" marker has no "<!-- /generated -->"`);
  }
  return { markdown: filled, blocks };
}

export function generateBlock(kind: string, args: readonly string[], page: string): string {
  switch (kind) {
    case "cli":
      return cliBlock(args, page);
    case "cli-index":
      return cliIndexBlock(page);
    case "errors":
      return errorsBlock();
    case "config":
      return configBlock();
    default:
      throw new Error(`${page}.md: unknown generated block "${kind}"`);
  }
}

// ---------------------------------------------------------------------------
// cli

/** Top-level commands in `shelf --help` order. */
export function topLevelCommands(): { name: string; group: string; command: AnyCommand }[] {
  return commandGroups.flatMap((group) =>
    Object.entries(group.commands).map(([name, command]) => ({
      name,
      group: group.title,
      command,
    })),
  );
}

function findCommand(path: readonly string[]): AnyCommand {
  let command: AnyCommand = main;
  for (const name of path) {
    const sub = (command.subCommands as Record<string, AnyCommand> | undefined)?.[name];
    if (!sub) throw new Error(`no command "shelf ${path.join(" ")}"`);
    command = sub;
  }
  return command;
}

interface Arg extends Record<string, unknown> {
  readonly type?: string;
  readonly description?: string;
  readonly required?: boolean;
  readonly default?: unknown;
  readonly alias?: string | string[];
  readonly options?: string[];
}

const GLOBALS = ["json", "actor"];

function cliBlock(path: readonly string[], page: string): string {
  if (path.length === 0) throw new Error(`${page}.md: "generated:cli" needs a command name`);
  const command = findCommand(path);
  const name = `shelf ${path.join(" ")}`;
  const args = Object.entries((command.args ?? {}) as Record<string, Arg>);
  const positional = args.filter(([, arg]) => arg.type === "positional");
  const options = args.filter(([, arg]) => arg.type !== "positional");
  const hasGlobals = GLOBALS.every((flag) => options.some(([key]) => key === flag));
  const own = hasGlobals ? options.filter(([key]) => !GLOBALS.includes(key)) : options;
  const subCommands = Object.entries((command.subCommands ?? {}) as Record<string, AnyCommand>);
  const out: string[] = [];

  const usage = [name];
  for (const [key, arg] of positional) {
    const label = `<${key}>${isVariadic(arg) ? "..." : ""}`;
    usage.push(isRequired(arg) ? label : `[${label}]`);
  }
  if (subCommands.length > 0) usage.push("<command>");
  if (own.length > 0) usage.push("[options]");
  out.push(["```text", usage.join(" "), "```"].join("\n"));

  if (subCommands.length > 0) {
    out.push(
      table(
        ["Command", "Description"],
        subCommands.map(([sub, def]) => [
          code(`${name} ${sub}`),
          cell(String((def.meta as { description?: string } | undefined)?.description ?? "")),
        ]),
      ),
    );
  }
  if (positional.length > 0) {
    out.push(
      table(
        ["Argument", "Description"],
        positional.map(([key, arg]) => {
          const { text, fallback } = splitDefault(arg.description ?? "");
          const label = `${code(`<${key}>${isVariadic(arg) ? "..." : ""}`)}${isRequired(arg) ? "" : " (optional)"}`;
          const shown = fallback && /^[\d.]+$/.test(fallback) ? code(fallback) : fallback;
          return [label, cell(shown ? `${text}. Default: ${shown}` : text)];
        }),
      ),
    );
  }
  if (own.length > 0) {
    out.push(
      table(
        ["Option", "Type", "Default", "Description"],
        own.map(([key, arg]) => optionRow(key, arg)),
      ),
    );
  }
  if (hasGlobals) {
    const overview = relativeDocLink(page, CLI_OVERVIEW_PAGE);
    out.push(
      `Also takes the global options \`--json\` and \`--actor\` ([CLI overview](${overview})).`,
    );
  }
  return out.join("\n\n");
}

function optionRow(key: string, arg: Arg): string[] {
  const aliases = (Array.isArray(arg.alias) ? arg.alias : arg.alias ? [arg.alias] : []).map(
    (alias) => code(`-${alias}`),
  );
  const value = arg.type === "string" ? ` <${key}>` : "";
  const names = [code(`--${key}${value}`), ...aliases];
  if (arg.type === "boolean" && arg.default === true) names.push(code(`--no-${key}`));
  const { text, fallback } = splitDefault(arg.description ?? "");
  const type = arg.type === "enum" ? (arg.options ?? []).map(code).join(" \\| ") : arg.type;
  const fallbackCell =
    arg.default !== undefined
      ? code(String(arg.default))
      : fallback && /^[\d.]+$/.test(fallback)
        ? code(fallback)
        : fallback
          ? cell(fallback)
          : "";
  return [names.join(", "), type ?? "string", fallbackCell, cell(text)];
}

/** citty has no variadic flag; shelf's descriptions say "One or more …" or "Skill names". */
function isVariadic(arg: Arg): boolean {
  return /^(one or more\b|\w+ (names|terms)\b)/i.test(arg.description ?? "");
}

function isRequired(arg: Arg): boolean {
  return arg.required !== false && arg.default === undefined;
}

/** Moves a trailing "(default: …)" out of a description, for the Default column. */
function splitDefault(description: string): { text: string; fallback: string | null } {
  const match = description.match(/^(.*?)\s*\(default: ([^)]+)\)\s*$/);
  return match
    ? { text: match[1] ?? "", fallback: match[2] ?? null }
    : { text: description, fallback: null };
}

function cliIndexBlock(page: string): string {
  return commandGroups
    .map((group) => {
      const rows = Object.entries(group.commands).flatMap(([name, command]) => {
        const link = relativeDocLink(page, `cli/${name}`);
        const subs = Object.entries((command.subCommands ?? {}) as Record<string, AnyCommand>);
        const describe = (def: AnyCommand) =>
          cell(String((def.meta as { description?: string } | undefined)?.description ?? ""));
        return [
          [`[${code(`shelf ${name}`)}](${link})`, describe(command)],
          ...subs.map(([sub, def]) => [
            `[${code(`shelf ${name} ${sub}`)}](${link})`,
            describe(def),
          ]),
        ];
      });
      return `### ${group.title}\n\n${table(["Command", "Description"], rows)}`;
    })
    .join("\n\n");
}

// ---------------------------------------------------------------------------
// errors

function errorsBlock(): string {
  const codes = (Object.keys(EXIT_CODES) as ErrorCode[]).sort(
    (a, b) => EXIT_CODES[a] - EXIT_CODES[b],
  );
  return table(
    ["Code", "Exit code", "Meaning"],
    [
      [code("INTERNAL"), String(INTERNAL_EXIT_CODE), cell(INTERNAL_ERROR_MEANING)],
      ...codes.map((name) => [code(name), String(EXIT_CODES[name]), cell(ERROR_MEANINGS[name])]),
    ],
  );
}

// ---------------------------------------------------------------------------
// config

interface JsonSchemaProperty {
  readonly type?: string;
  readonly enum?: readonly unknown[];
  readonly items?: JsonSchemaProperty;
  readonly default?: unknown;
  readonly description?: string;
}

/** `schema/config.schema.json`: the config file's JSON Schema, from `ConfigSchema`. */
export function configJsonSchema(): string {
  const schema = ConfigSchema.toJSONSchema({ io: "input" }) as Record<string, unknown>;
  const { $schema, ...rest } = schema;
  const tidy = JSON.parse(
    JSON.stringify(rest, (key, value) =>
      // zod's bound for "integer"; noise for a human reading the schema.
      key === "maximum" && value === Number.MAX_SAFE_INTEGER ? undefined : value,
    ),
  );
  return `${JSON.stringify(
    {
      $schema,
      $id: "https://limyuquan.github.io/shelf/schema/config.schema.json",
      title: "shelf config",
      ...tidy,
    },
    null,
    2,
  )}\n`;
}

function configBlock(): string {
  const schema = JSON.parse(configJsonSchema()) as {
    properties: Record<string, JsonSchemaProperty>;
  };
  return table(
    ["Key", "Type", "Default", "Description"],
    Object.entries(schema.properties).map(([key, property]) => [
      code(key),
      jsonType(property),
      code(JSON.stringify(property.default)),
      cell(property.description ?? ""),
    ]),
  );
}

function jsonType(property: JsonSchemaProperty): string {
  if (property.enum) return property.enum.map((value) => code(JSON.stringify(value))).join(" \\| ");
  if (property.type === "array") return `${property.items ? jsonType(property.items) : "any"}[]`;
  return property.type ?? "any";
}

// ---------------------------------------------------------------------------
// Markdown helpers

/** A relative `.md` link from one docs page to another, as GitHub resolves it. */
export function relativeDocLink(from: string, to: string): string {
  return posix.relative(posix.dirname(from), `${to}.md`);
}

function table(header: readonly string[], rows: readonly (readonly string[])[]): string {
  return [
    `| ${header.join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

function code(text: string): string {
  return `\`${text.replaceAll("|", "\\|")}\``;
}

/**
 * Text for a table cell: pipes escaped, and `<` / `>` outside code spans escaped
 * so `@<set>` is not read as an HTML tag.
 */
function cell(text: string): string {
  return text
    .split(/(`[^`]*`)/)
    .map((part, index) =>
      index % 2 === 1
        ? part.replaceAll("|", "\\|")
        : part.replaceAll("|", "\\|").replaceAll("<", "&lt;").replaceAll(">", "&gt;"),
    )
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}
