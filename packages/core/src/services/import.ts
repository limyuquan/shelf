import { basename, join, relative } from "node:path";
import type { RevisionHash, Skill } from "../domain/types.ts";
import { ShelfError } from "../errors.ts";
import { copyDirectory, pathExists, replaceDirectory } from "../library/fs.ts";
import { hashDirectory, listFiles } from "../library/hash.ts";
import { librarySkillPath, revisionPath, snapshotSkill } from "../library/library.ts";
import { readSkillMetadata } from "../library/skill-file.ts";
import {
  type FetchedSource,
  fetchSource,
  findSkillDirectories,
  parseSource,
  type SkillSourceSpec,
} from "../library/source.ts";
import { auditDirectory, type Finding, hasBlockingFindings } from "../security/audit.ts";
import { writeTransaction } from "../store/database.ts";
import { recordEvent } from "../store/events.ts";
import { findSkillByName, insertRevision, insertSkill, updateSkillHead } from "../store/skills.ts";
import { findSkillSource, upsertSkillSource } from "../store/sources.ts";
import type { Context } from "./context.ts";
import { diffDirectories, type FileDiff } from "./diff.ts";
import { refreshLibrary, requireSkill } from "./library.ts";

/**
 * `review`: nothing changed; pass `yes` to import (or link) after reading the findings.
 * `blocked`: high-severity findings; pass `force` as well to import anyway.
 * `linked`: the library already had the skill; the source was recorded so that
 * `shelf pull` can fetch its updates. The library's content is unchanged.
 */
export type ImportStatus = "review" | "blocked" | "imported" | "linked";

export interface AddResult {
  readonly skill: string;
  readonly status: ImportStatus;
  readonly source: string;
  /** The library already has this skill: `yes` links it to the source instead of importing. */
  readonly existing: boolean;
  readonly files: string[];
  readonly findings: Finding[];
  /** For an existing skill: how the source differs from the library's latest revision. */
  readonly diff: FileDiff[];
  readonly revision: RevisionHash | null;
}

export interface ImportOptions {
  readonly ref?: string;
  readonly path?: string;
  /** Which skills to take when the source holds several. */
  readonly skills?: readonly string[];
  readonly all?: boolean;
  /** Import after review. Without it, `add` only reports what it would import. */
  readonly yes?: boolean;
  /** Import despite high-severity findings (and, for `pull`, local library edits). */
  readonly force?: boolean;
}

/**
 * Imports skills from outside the library. Two-step by design: the first call
 * fetches and audits; nothing enters the library until the caller passes `yes`
 * (and `force` for high-severity findings). A skill the library already has
 * (e.g. adopted from a project) is linked to the source instead, so `shelf pull`
 * can update it. Agents may review and link, but may not import from remote
 * sources unless the user enables `allowAgentImports`.
 */
export async function addSkill(
  ctx: Context,
  input: string,
  options: ImportOptions = {},
): Promise<AddResult[]> {
  const spec = parseSource(input, {
    cwd: ctx.cwd,
    ...(options.ref ? { ref: options.ref } : {}),
    ...(options.path ? { path: options.path } : {}),
  });
  await refreshLibrary(ctx);

  const fetched = await fetchSource(spec);
  try {
    const base = spec.path ? join(fetched.root, spec.path) : fetched.root;
    const candidates = await findSkillDirectories(base);
    const plans = await Promise.all(
      chooseSkills(candidates, options).map((dir) => planImport(ctx, dir)),
    );
    // Refuse before changing anything, so a mixed batch is not half-applied.
    if (options.yes && plans.some((plan) => !plan.existing)) assertImportAllowed(ctx, spec);
    const results: AddResult[] = [];
    for (const plan of plans) {
      results.push(
        plan.existing
          ? await linkOne(ctx, spec, fetched, plan.dir, plan.existing, options)
          : await importOne(ctx, spec, fetched, plan.dir, plan.name, options),
      );
    }
    return results;
  } finally {
    await fetched.cleanup();
  }
}

function chooseSkills(candidates: string[], options: ImportOptions): string[] {
  if (candidates.length === 0) {
    throw new ShelfError(
      "INVALID_ARGUMENT",
      "No SKILL.md found in the source",
      "Point --path at a skill directory",
    );
  }
  if (options.skills?.length) {
    const wanted = new Set(options.skills);
    const chosen = candidates.filter((dir) => wanted.has(basename(dir)));
    const missing = [...wanted].filter((name) => !chosen.some((dir) => basename(dir) === name));
    if (missing.length > 0) {
      throw new ShelfError(
        "SKILL_NOT_FOUND",
        `Not in the source: ${missing.join(", ")}`,
        `Available: ${candidates.map((dir) => basename(dir)).join(", ")}`,
      );
    }
    return chosen;
  }
  if (candidates.length > 1 && !options.all) {
    throw new ShelfError(
      "INVALID_ARGUMENT",
      `The source holds ${candidates.length} skills: ${candidates.map((dir) => basename(dir)).join(", ")}`,
      "Choose with --skill <name> (comma-separated) or take all with --all",
    );
  }
  return candidates;
}

interface ImportPlan {
  readonly dir: string;
  readonly name: string;
  /** The library skill this source would be linked to, if it already exists. */
  readonly existing: Skill | null;
}

async function planImport(ctx: Context, dir: string): Promise<ImportPlan> {
  const { name } = await readSkillMetadata(dir);
  const existing = findSkillByName(ctx.db, name);
  // Importing would continue the archived skill's history with unrelated content.
  if (existing?.archivedAt) {
    throw new ShelfError(
      "SKILL_EXISTS",
      `An archived skill was named "${name}"`,
      `Restore it by moving it from ${ctx.paths.archive} back into the library (\`shelf add\` then links it to this source), or restore it and \`shelf rename\` it to free the name`,
    );
  }
  if (existing && findSkillSource(ctx.db, existing.id)) {
    throw new ShelfError(
      "SKILL_EXISTS",
      `The library's "${name}" is already linked to a source`,
      `Update it from its source with \`shelf pull ${name}\``,
    );
  }
  if (!existing && (await pathExists(librarySkillPath(ctx.paths, name)))) {
    throw new ShelfError(
      "SKILL_EXISTS",
      `The library has a directory named "${name}" that is not a valid skill`,
      "Fix or remove it first (see `shelf doctor`)",
    );
  }
  return { dir, name, existing };
}

async function importOne(
  ctx: Context,
  spec: SkillSourceSpec,
  fetched: FetchedSource,
  dir: string,
  name: string,
  options: ImportOptions,
): Promise<AddResult> {
  const findings = await auditDirectory(dir);
  const base = {
    skill: name,
    source: sourceUrl(spec),
    existing: false,
    files: await listFiles(dir),
    findings,
    diff: [],
  };
  if (!options.yes) return { ...base, status: "review", revision: null };
  if (hasBlockingFindings(findings) && !options.force)
    return { ...base, status: "blocked", revision: null };

  await copyDirectory(dir, librarySkillPath(ctx.paths, name));
  const revision = await snapshotSkill(ctx.paths, name);
  const { description } = await readSkillMetadata(librarySkillPath(ctx.paths, name));
  const now = ctx.clock.now();
  writeTransaction(ctx.db, () => {
    const skill = insertSkill(ctx.db, { name, description, revision, at: now });
    insertRevision(ctx.db, {
      skillId: skill.id,
      hash: revision,
      parent: null,
      source: "import",
      at: now,
    });
    upsertSkillSource(ctx.db, {
      skillId: skill.id,
      url: base.source,
      ref: spec.kind === "git" ? spec.ref : null,
      path: relative(fetched.root, dir) || null,
      commit: fetched.commit,
      revision,
      importedAt: now,
    });
    recordEvent(ctx.db, {
      type: "skill.created",
      actor: ctx.actor,
      at: now,
      skillId: skill.id,
      detail: { revision, source: base.source, commit: fetched.commit, findings: findings.length },
    });
  });
  return { ...base, status: "imported", revision };
}

/**
 * Records where an existing library skill comes from, without changing it. The
 * library's current revision counts as the last import, so the next `shelf pull`
 * offers the source's version as an update (with a diff and a fresh audit).
 */
async function linkOne(
  ctx: Context,
  spec: SkillSourceSpec,
  fetched: FetchedSource,
  dir: string,
  skill: Skill,
  options: ImportOptions,
): Promise<AddResult> {
  const base = {
    skill: skill.name,
    source: sourceUrl(spec),
    existing: true,
    files: await listFiles(dir),
    findings: await auditDirectory(dir),
    diff: await diffDirectories(revisionPath(ctx.paths, skill.latestRevision), dir),
    revision: skill.latestRevision,
  };
  if (!options.yes) return { ...base, status: "review" };

  const now = ctx.clock.now();
  writeTransaction(ctx.db, () => {
    upsertSkillSource(ctx.db, {
      skillId: skill.id,
      url: base.source,
      ref: spec.kind === "git" ? spec.ref : null,
      path: relative(fetched.root, dir) || null,
      commit: fetched.commit,
      revision: skill.latestRevision,
      importedAt: now,
    });
    recordEvent(ctx.db, {
      type: "skill.linked",
      actor: ctx.actor,
      at: now,
      skillId: skill.id,
      detail: { source: base.source, commit: fetched.commit },
    });
  });
  return { ...base, status: "linked" };
}

const sourceUrl = (spec: SkillSourceSpec) => (spec.kind === "git" ? spec.url : spec.dir);

export interface PullResult {
  readonly skill: string;
  readonly status: Exclude<ImportStatus, "linked"> | "current";
  readonly source: string;
  readonly commit: string | null;
  readonly diff: FileDiff[];
  readonly findings: Finding[];
  readonly revision: RevisionHash;
}

/**
 * Re-fetches an imported skill from its recorded source. Like `add`, it reviews
 * first (diff and fresh audit) and changes the library only with `yes`.
 */
export async function pullSkill(
  ctx: Context,
  name: string,
  options: Pick<ImportOptions, "yes" | "force"> = {},
): Promise<PullResult> {
  await refreshLibrary(ctx);
  const skill = requireSkill(ctx, name);
  const source = findSkillSource(ctx.db, skill.id);
  if (!source) {
    throw new ShelfError(
      "INVALID_ARGUMENT",
      `"${name}" was not imported with \`shelf add\`; it has no source to pull from`,
    );
  }
  const spec: SkillSourceSpec = (await pathExists(source.url))
    ? { kind: "local", dir: source.url, path: source.path }
    : { kind: "git", url: source.url, ref: source.ref, path: source.path };

  const fetched = await fetchSource(spec);
  try {
    const dir = source.path ? join(fetched.root, source.path) : fetched.root;
    await readSkillMetadata(dir);
    const base = { skill: name, source: source.url, commit: fetched.commit };
    if ((await hashDirectory(dir)) === skill.latestRevision) {
      return { ...base, status: "current", diff: [], findings: [], revision: skill.latestRevision };
    }
    if (skill.latestRevision !== source.revision && !options.force) {
      throw new ShelfError(
        "CONFLICT",
        `The library's "${name}" was edited since it was imported`,
        "Pulling would replace those edits; re-run with --force to do so",
      );
    }
    const findings = await auditDirectory(dir);
    const diff = await diffDirectories(revisionPath(ctx.paths, skill.latestRevision), dir);
    const review = { ...base, diff, findings, revision: skill.latestRevision };
    if (!options.yes) return { ...review, status: "review" };
    if (hasBlockingFindings(findings) && !options.force) return { ...review, status: "blocked" };
    assertImportAllowed(ctx, spec);

    await replaceDirectory(dir, librarySkillPath(ctx.paths, name));
    const revision = await snapshotSkill(ctx.paths, name);
    const { description } = await readSkillMetadata(librarySkillPath(ctx.paths, name));
    const now = ctx.clock.now();
    writeTransaction(ctx.db, () => {
      updateSkillHead(ctx.db, skill.id, { description, revision });
      insertRevision(ctx.db, {
        skillId: skill.id,
        hash: revision,
        parent: skill.latestRevision,
        source: "import",
        at: now,
      });
      upsertSkillSource(ctx.db, { ...source, commit: fetched.commit, revision, importedAt: now });
      recordEvent(ctx.db, {
        type: "skill.revised",
        actor: ctx.actor,
        at: now,
        skillId: skill.id,
        detail: { revision, source: source.url, commit: fetched.commit },
      });
    });
    return { ...review, status: "imported", revision };
  } finally {
    await fetched.cleanup();
  }
}

function assertImportAllowed(ctx: Context, spec: SkillSourceSpec): void {
  if (spec.kind === "git" && ctx.actor.startsWith("agent:") && !ctx.config.allowAgentImports) {
    throw new ShelfError(
      "NOT_ALLOWED",
      "Agents may review skills from remote sources but not import them",
      "Show the user the review and ask them to run the command with --yes themselves, or to set allowAgentImports in ~/.shelf/config.json",
    );
  }
}
