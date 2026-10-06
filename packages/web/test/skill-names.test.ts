import { describe, expect, test } from "bun:test";
import {
  estimateTokens,
  normalizeNameInput,
  skillNameProblem,
} from "../src/features/skills/names.ts";

describe("new skill names", () => {
  test("accepts valid names and says what's wrong with others", () => {
    expect(skillNameProblem("")).toBeNull();
    expect(skillNameProblem("pdf-tools2")).toBeNull();
    expect(skillNameProblem("pdf_tools")).toBe("Only lowercase letters, digits and hyphens");
    expect(skillNameProblem("-pdf")).toBe("Hyphens go between words, one at a time");
    expect(skillNameProblem("pdf--tools")).toBe("Hyphens go between words, one at a time");
    expect(skillNameProblem("a".repeat(65))).toBe("64 characters at most");
    expect(skillNameProblem("pdf", ["pdf"])).toBe("Your library already has pdf");
  });

  test("typing is normalised to lowercase hyphens", () => {
    expect(normalizeNameInput("PDF Tools_v2")).toBe("pdf-tools-v2");
  });

  test("tokens are estimated as characters / 4", () => {
    expect(estimateTokens("  12345  ")).toBe(2);
    expect(estimateTokens("")).toBe(0);
  });
});
