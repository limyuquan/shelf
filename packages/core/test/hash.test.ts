import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hashDirectory } from "../src/library/hash.ts";

async function makeSkill(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "shelf-hash-"));
  for (const [path, content] of Object.entries(files)) {
    await mkdir(join(dir, path, ".."), { recursive: true });
    await writeFile(join(dir, path), content);
  }
  return dir;
}

describe("hashDirectory", () => {
  test("is stable across copies with identical content", async () => {
    const files = { "SKILL.md": "# a\n", "scripts/run.sh": "echo hi\n" };
    expect(await hashDirectory(await makeSkill(files))).toBe(
      await hashDirectory(await makeSkill(files)),
    );
  });

  test("detects content, path and newline changes", async () => {
    const original = await hashDirectory(await makeSkill({ "SKILL.md": "# a\n" }));
    expect(await hashDirectory(await makeSkill({ "SKILL.md": "# b\n" }))).not.toBe(original);
    expect(await hashDirectory(await makeSkill({ "README.md": "# a\n" }))).not.toBe(original);
    expect(await hashDirectory(await makeSkill({ "SKILL.md": "# a\r\n" }))).not.toBe(original);
  });

  test("ignores OS clutter", async () => {
    const clean = await hashDirectory(await makeSkill({ "SKILL.md": "# a\n" }));
    const cluttered = await makeSkill({ "SKILL.md": "# a\n", ".DS_Store": "junk" });
    expect(await hashDirectory(cluttered)).toBe(clean);
  });
});
