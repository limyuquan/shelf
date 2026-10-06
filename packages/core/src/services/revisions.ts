import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { RevisionHash, RevisionSource, Skill } from "../domain/types.ts";
import { ShelfError } from "../errors.ts";
import { pathExists, replaceDirectory } from "../library/fs.ts";
import { listFiles, revisionKey, shortHash } from "../library/hash.ts";
import { librarySkillPath, revisionPath } from "../library/library.ts";
import { parseSkillMetadata, SKILL_FILE } from "../library/skill-file.ts";
import { listRevisions, type RevisionRecord } from "../store/skills.ts";
import type { Context } from "./context.ts";
import {
  type LibraryFile,
  readSkillFile,
  recordRevision,
  refreshLibrary,
  requireSkill,
  resolveSkillFile,
  type SkillDetail,
  showSkill,
} from "./library.ts";

/** Shorter prefixes are too likely to become ambiguous as a skill accumulates revisions. */
const MIN_PREFIX = 6;

/**
 * The revision of `skill` that `ref` names: `latest`, a full `sha256:…` hash, its
 * bare hex, or a unique hex prefix of at least six characters. Only that skill's
 * revisions are candidates. Callers refresh the library first.
 */
export function matchRevision(ctx: Context, skill: Skill, ref: string): RevisionRecord {
  const revisions = listRevisions(ctx.db, skill.id);
  const wanted = ref.trim().toLowerCase();
  const head = skill.latestRevision;
  const key = wanted === "latest" ? revisionKey(head) : revisionKey(wanted);
  const matches = /^[0-9a-f]+$/.test(key)
    ? revisions.filter((revision) => revisionKey(revision.hash).startsWith(key))
    : [];
  const listed = (candidates: readonly RevisionRecord[]) =>
    candidates
      .slice(0, 8)
      .map((revision) => shortHash(revision.hash))
      .join(", ");
  const hint = (candidates: readonly RevisionRecord[]) =>
    `${candidates.length > 0 ? `Candidates: ${listed(candidates)}. ` : ""}Run \`shelf log ${skill.name}\` to list its revisions`;

  if (key.length < MIN_PREFIX) {
    throw new ShelfError(
      "INVALID_ARGUMENT",
      `Revision "${ref}" is too short: use at least ${MIN_PREFIX} characters of the hash`,
      hint(matches),
    );
  }
  if (matches.length > 1) {
    throw new ShelfError(
      "INVALID_ARGUMENT",
      `Revision "${ref}" is ambiguous: ${matches.length} revisions of "${skill.name}" start with it`,
      hint(matches),
    );
  }
  const [match] = matches;
  if (!match) {
    throw new ShelfError(
      "INVALID_ARGUMENT",
      `Unknown revision "${ref}" of "${skill.name}"`,
      hint(revisions),
    );
  }
  return match;
}

/** Resolves a revision reference (see `matchRevision`) to a full hash. */
export async function resolveRevision(
  ctx: Context,
  name: string,
  ref: string,
): Promise<RevisionHash> {
  await refreshLibrary(ctx);
  return matchRevision(ctx, requireSkill(ctx, name), ref).hash;
}

export interface RevisionDetail {
  readonly skill: string;
  readonly revision: RevisionHash;
  readonly source: RevisionSource;
  readonly createdAt: Date;
  /** Whether this is the library's current head. */
  readonly latest: boolean;
  readonly parent: RevisionHash | null;
  /** Relative POSIX paths of every file in the snapshot, sorted. */
  readonly files: string[];
  /** The snapshot's SKILL.md. */
  readonly content: string;
  /** Rough size of SKILL.md in tokens (chars / 4). */
  readonly tokens: number;
}

/** One recorded revision of a skill, read from the object store. */
export async function showRevision(
  ctx: Context,
  name: string,
  ref: string,
): Promise<RevisionDetail> {
  const { skill, revision, dir } = await openRevision(ctx, name, ref);
  const content = await readFile(join(dir, SKILL_FILE), "utf8");
  return {
    skill: name,
    revision: revision.hash,
    source: revision.source,
    createdAt: revision.createdAt,
    latest: revision.hash === skill.latestRevision,
    parent: revision.parent,
    files: await listFiles(dir),
    content,
    tokens: Math.ceil(content.length / 4),
  };
}

export interface RevisionFile extends LibraryFile {
  readonly revision: RevisionHash;
}

/** One file of a recorded revision, with the same rules as `readLibraryFile`. */
export async function readRevisionFile(
  ctx: Context,
  name: string,
  ref: string,
  path: string,
): Promise<RevisionFile> {
  const { revision, dir } = await openRevision(ctx, name, ref);
  const short = shortHash(revision.hash);
  const file = await resolveSkillFile(
    dir,
    `${name}@${short}`,
    path,
    `Run \`shelf show ${name} --revision ${short} --json\` to list its files`,
  );
  return { ...(await readSkillFile(name, file)), revision: revision.hash };
}

/**
 * Makes an earlier revision the library's head by copying its snapshot over the
 * working copy. Unrecorded edits are recorded first, so nothing is lost: every
 * revision stays in the history and can be restored in turn. Borrowers keep the
 * revision they have until they update.
 */
export async function restoreRevision(
  ctx: Context,
  name: string,
  ref: string,
): Promise<SkillDetail> {
  const { skill, revision, dir } = await openRevision(ctx, name, ref);
  if (revision.hash === skill.latestRevision) return showSkill(ctx, name);

  const content = await readFile(join(dir, SKILL_FILE), "utf8");
  const { description } = parseSkillMetadata(content, name, join(dir, SKILL_FILE));
  await replaceDirectory(dir, librarySkillPath(ctx.paths, name));
  recordRevision(ctx, {
    name,
    description,
    revision: revision.hash,
    existing: skill,
    detail: { restoredFrom: revision.hash },
  });
  return showSkill(ctx, name);
}

/** Refreshes the library, resolves `ref` and locates its snapshot. */
async function openRevision(ctx: Context, name: string, ref: string) {
  await refreshLibrary(ctx);
  const skill = requireSkill(ctx, name);
  const revision = matchRevision(ctx, skill, ref);
  const dir = revisionPath(ctx.paths, revision.hash);
  if (!(await pathExists(dir))) {
    throw new ShelfError(
      "CONFLICT",
      `The snapshot of ${name} ${shortHash(revision.hash)} is missing from the object store`,
      "Run `shelf doctor`",
    );
  }
  return { skill, revision, dir };
}
