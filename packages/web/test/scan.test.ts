import { describe, expect, test } from "bun:test";
import type { AdoptResult, FoundCopy, ScanGroup, ScanVariant } from "../src/api/types.ts";
import {
  adoptionOrder,
  copyLabel,
  expandTilde,
  groupSelection,
  managedCount,
  pruneSelection,
  sortGroups,
  summarizeAdopt,
  tildePath,
  toggleItems,
  unmanagedPaths,
  versionLabel,
} from "../src/features/scan/select.ts";

const HOME = "/home/me";

function copy(project: string, name: string, managed = false): FoundCopy {
  const root = `${HOME}/code/${project}`;
  return { path: `${root}/.claude/skills/${name}`, root, target: ".claude/skills", managed };
}

function variant(revision: string, copies: FoundCopy[], latest = false): ScanVariant {
  return { revision, isLibraryLatest: latest, inLibraryHistory: latest, copies };
}

function group(name: string, variants: ScanVariant[], inLibrary = false): ScanGroup {
  const copies = variants.reduce((total, v) => total + v.copies.length, 0);
  return { name, inLibrary, copies, variants };
}

// review: two versions; the less common one is the library's latest.
const review = group(
  "review",
  [
    variant("sha256:common", [copy("a", "review"), copy("b", "review")]),
    variant("sha256:latest", [copy("c", "review"), copy("d", "review", true)], true),
  ],
  true,
);
const pdf = group("pdf", [variant("sha256:p", [copy("a", "pdf", true)], true)], true);
const notes = group("notes", [variant("sha256:n", [copy("b", "notes")])]);

describe("paths", () => {
  test("shows the home directory as ~ and expands it back", () => {
    expect(tildePath(`${HOME}/code/app`, HOME)).toBe("~/code/app");
    expect(tildePath(HOME, HOME)).toBe("~");
    expect(tildePath("/home/meadow/x", HOME)).toBe("/home/meadow/x");
    expect(expandTilde("~/code", HOME)).toBe(`${HOME}/code`);
    expect(expandTilde("~", HOME)).toBe(HOME);
    expect(expandTilde("/srv/code", HOME)).toBe("/srv/code");
  });

  test("splits a copy into its project and its place in it", () => {
    expect(copyLabel(copy("app", "review"), HOME)).toEqual({
      project: "~/code/app",
      rest: "/.claude/skills/review",
    });
    const loose = { path: `${HOME}/skills/x`, root: null, target: null, managed: false };
    expect(copyLabel(loose, HOME)).toEqual({ project: "~/skills/x", rest: "" });
  });
});

describe("selection", () => {
  test("only unmanaged copies can be selected", () => {
    expect(unmanagedPaths(review)).toHaveLength(3);
    expect(managedCount(review)).toBe(1);
    expect(unmanagedPaths(pdf)).toEqual([]);
  });

  test("a group's checkbox reflects its adoptable copies", () => {
    const [first, second, third] = unmanagedPaths(review) as [string, string, string];
    expect(groupSelection(review, new Set())).toBe("none");
    expect(groupSelection(review, new Set([first]))).toBe("some");
    expect(groupSelection(review, new Set([first, second, third]))).toBe("all");
    expect(groupSelection(pdf, new Set())).toBe("none");
  });

  test("toggling adds and removes items; pruning drops what is no longer adoptable", () => {
    const all = toggleItems(new Set(), unmanagedPaths(review), true);
    expect(all.size).toBe(3);
    expect(toggleItems(all, unmanagedPaths(review).slice(0, 1), false).size).toBe(2);
    const stale = new Set([...all, copy("a", "pdf").path, "/gone"]);
    expect(pruneSelection(stale, [review, pdf])).toEqual(all);
  });

  test("groups with copies left to adopt come first", () => {
    expect(sortGroups([pdf, review, notes]).map((g) => g.name)).toEqual(["review", "notes", "pdf"]);
  });
});

describe("adoption order", () => {
  test("each group starts with its library-latest version, then the most common", () => {
    const selected = new Set([...unmanagedPaths(notes), ...unmanagedPaths(review)]);
    expect(adoptionOrder([review, notes], selected)).toEqual([
      copy("c", "review").path,
      copy("a", "review").path,
      copy("b", "review").path,
      copy("b", "notes").path,
    ]);
  });

  test("labels versions by their place in the library", () => {
    expect(versionLabel(variant("sha256:x", [], true))?.label).toBe("library latest");
    expect(
      versionLabel({ revision: "x", isLibraryLatest: false, inLibraryHistory: true, copies: [] })
        ?.label,
    ).toBe("old library revision");
    expect(versionLabel(variant("sha256:y", []))).toBeNull();
  });
});

describe("adopt summary", () => {
  const result = (library: AdoptResult["library"]): AdoptResult => ({
    path: "/p",
    skill: "review",
    library,
    revision: "sha256:a",
    loan: null,
    note: null,
    findings: [],
  });

  test("counts outcomes in a fixed order", () => {
    expect(summarizeAdopt([result("older"), result("imported"), result("older")])).toEqual({
      title: "Adopted 3 copies",
      detail: "1 imported · 2 older",
    });
    expect(summarizeAdopt([result("matched")]).title).toBe("Adopted 1 copy");
  });
});
