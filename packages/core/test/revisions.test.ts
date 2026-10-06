import { describe, expect, test } from "bun:test";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { revisionKey } from "../src/library/hash.ts";
import { diffSkill } from "../src/services/diff.ts";
import { skillHistory } from "../src/services/history.ts";
import { requireSkill, showSkill } from "../src/services/library.ts";
import { borrow } from "../src/services/loans.ts";
import {
  readRevisionFile,
  resolveRevision,
  restoreRevision,
  showRevision,
} from "../src/services/revisions.ts";
import { status } from "../src/services/status.ts";
import { listEvents } from "../src/store/events.ts";
import { insertRevision } from "../src/store/skills.ts";
import { appendToFile, createTestEnv, setupProject } from "./helpers.ts";

/** A library skill "pdf" with two recorded revisions: v1 (SKILL.md) and v2 (+ a reference). */
async function twoRevisions() {
  const env = await createTestEnv();
  const ctx = await setupProject(env, ["pdf", "git"]);
  const library = join(env.shelfHome, "library/pdf");
  const v1 = (await showSkill(ctx, "pdf")).revision;
  await appendToFile(join(library, "SKILL.md"), "v2 guidance\n");
  await mkdir(join(library, "references"));
  await writeFile(join(library, "references/tables.md"), "# Tables\n");
  const v2 = (await showSkill(ctx, "pdf")).revision;
  return { env, ctx, library, v1, v2 };
}

describe("resolving revisions", () => {
  test("accepts a full hash, bare hex, a unique prefix, or latest", async () => {
    const { ctx, v1, v2 } = await twoRevisions();
    expect(await resolveRevision(ctx, "pdf", v1)).toBe(v1);
    expect(await resolveRevision(ctx, "pdf", revisionKey(v1))).toBe(v1);
    expect(await resolveRevision(ctx, "pdf", revisionKey(v1).slice(0, 6))).toBe(v1);
    expect(await resolveRevision(ctx, "pdf", revisionKey(v2).slice(0, 10).toUpperCase())).toBe(v2);
    expect(await resolveRevision(ctx, "pdf", "latest")).toBe(v2);
  });

  test("rejects short, unknown and ambiguous references with the candidates", async () => {
    const { ctx, v1 } = await twoRevisions();
    const git = (await showSkill(ctx, "git")).revision;

    await expect(resolveRevision(ctx, "pdf", revisionKey(v1).slice(0, 5))).rejects.toMatchObject({
      code: "INVALID_ARGUMENT",
      message: expect.stringContaining("too short"),
    });
    // Another skill's revision is not a revision of this one.
    await expect(resolveRevision(ctx, "pdf", git)).rejects.toMatchObject({
      code: "INVALID_ARGUMENT",
      hint: expect.stringContaining("shelf log pdf"),
    });

    // Real hashes sharing six characters are rare; plant two that do.
    const { id } = requireSkill(ctx, "pdf");
    for (const suffix of ["1", "2"]) {
      const hash = `sha256:abcdef${suffix.repeat(58)}`;
      insertRevision(ctx.db, {
        skillId: id,
        hash,
        parent: null,
        source: "library",
        at: new Date(),
      });
    }
    await expect(resolveRevision(ctx, "pdf", "abcdef")).rejects.toMatchObject({
      code: "INVALID_ARGUMENT",
      message: expect.stringContaining("ambiguous"),
      hint: expect.stringMatching(/Candidates: abcdef(2{4}, abcdef1{4}|1{4}, abcdef2{4})/),
    });
    expect(await resolveRevision(ctx, "pdf", "abcdef2")).toBe(`sha256:abcdef${"2".repeat(58)}`);
  });

  test("diff accepts prefixes and latest on either side", async () => {
    const { ctx, v1 } = await twoRevisions();
    const result = await diffSkill(ctx, "pdf", {
      from: revisionKey(v1).slice(0, 8),
      to: "latest",
    });
    expect(result.from.revision).toBe(v1);
    expect(result.files.map((file) => [file.path, file.status])).toEqual([
      ["SKILL.md", "modified"],
      ["references/tables.md", "added"],
    ]);
  });
});

describe("reading revisions", () => {
  test("shows a revision's SKILL.md, files and place in the history", async () => {
    const { ctx, v1, v2 } = await twoRevisions();

    const old = await showRevision(ctx, "pdf", revisionKey(v1).slice(0, 8));
    expect(old).toMatchObject({ skill: "pdf", revision: v1, latest: false, parent: null });
    expect(old.files).toEqual(["SKILL.md"]);
    expect(old.content).not.toContain("v2 guidance");
    expect(old.tokens).toBe(Math.ceil(old.content.length / 4));

    const head = await showRevision(ctx, "pdf", "latest");
    expect(head).toMatchObject({ revision: v2, latest: true, parent: v1, source: "library" });
    expect(head.files).toEqual(["SKILL.md", "references/tables.md"]);
  });

  test("reads files from the snapshot, even after the library moved on", async () => {
    const { ctx, library, v2 } = await twoRevisions();
    await writeFile(join(library, "references/tables.md"), "# Tables, rewritten\n");

    const file = await readRevisionFile(ctx, "pdf", v2, "references/tables.md");
    expect(file).toEqual({
      skill: "pdf",
      path: "references/tables.md",
      content: "# Tables\n",
      size: 9,
      revision: v2,
    });
  });

  test("refuses paths outside the snapshot and files it does not have", async () => {
    const { ctx, v1, v2 } = await twoRevisions();
    const escapes = [
      "../../config.json",
      "/etc/passwd",
      `../${revisionKey(v2)}/references/tables.md`,
      "references/tables.md", // only in v2
      "references",
    ];
    for (const path of escapes) {
      await expect(readRevisionFile(ctx, "pdf", v1, path)).rejects.toMatchObject({
        code: "INVALID_ARGUMENT",
      });
    }
  });
});

describe("restoring revisions", () => {
  test("makes an old revision the head, keeping every revision and unrecorded edits", async () => {
    const { env, ctx, library, v1, v2 } = await twoRevisions();
    await borrow(ctx, ["pdf"]);
    // Edited in the library but not yet recorded by any shelf command.
    await appendToFile(join(library, "SKILL.md"), "unrecorded edit\n");

    const restored = await restoreRevision(ctx, "pdf", revisionKey(v1).slice(0, 8));

    expect(restored.revision).toBe(v1);
    expect(restored.files).toEqual(["SKILL.md"]);
    expect(await readdir(library)).toEqual(["SKILL.md"]);
    const history = await skillHistory(ctx, "pdf");
    expect(history.revisions).toHaveLength(3);
    expect(history.revisions.find((revision) => revision.latest)?.hash).toBe(v1);
    const edit = history.revisions[0]?.hash as string;
    expect(edit).not.toBe(v2);
    expect((await showRevision(ctx, "pdf", edit)).content).toContain("unrecorded edit");

    const [event] = listEvents(ctx.db, { limit: 1, skill: "pdf" });
    expect(event).toMatchObject({ type: "skill.revised", detail: { restoredFrom: v1 } });

    // Borrowers keep their revision until they update.
    const report = await status(await env.context());
    expect(report.initialized && report.loans[0]).toMatchObject({
      revision: v2,
      content: "behind",
    });

    // ...and the restore can itself be undone.
    expect((await restoreRevision(ctx, "pdf", edit)).content).toContain("unrecorded edit");
  });

  test("restoring the head changes nothing", async () => {
    const { ctx, v2 } = await twoRevisions();
    const before = listEvents(ctx.db, { limit: 100, skill: "pdf" }).length;
    const result = await restoreRevision(ctx, "pdf", "latest");
    expect(result.revision).toBe(v2);
    expect(listEvents(ctx.db, { limit: 100, skill: "pdf" })).toHaveLength(before);
  });
});
