import { readFile, stat } from "node:fs/promises";
import { extname, join } from "node:path";
import { listFiles } from "../library/hash.ts";

/**
 * A local, offline scanner for risky content in skills. It is a tripwire for
 * review, not a guarantee: `high` findings block `shelf add` / `shelf pull`
 * unless forced, everything else is shown to the user.
 */
export type Severity = "high" | "medium" | "low";

export interface Finding {
  readonly severity: Severity;
  readonly rule: string;
  readonly message: string;
  readonly file: string;
  readonly line: number | null;
  readonly excerpt: string | null;
}

interface TextRule {
  readonly id: string;
  readonly severity: Severity;
  readonly message: string;
  readonly pattern: RegExp;
}

const TEXT_RULES: readonly TextRule[] = [
  {
    id: "pipe-to-shell",
    severity: "high",
    message: "Downloads and executes a script",
    pattern:
      /\b(curl|wget|iwr|Invoke-WebRequest)\b[^\n|]*\|\s*(sudo\s+)?(ba|z|da)?sh\b|\b(iex|Invoke-Expression)\b/i,
  },
  {
    id: "decode-and-run",
    severity: "high",
    message: "Decodes data and executes it",
    pattern:
      /base64\s+(-d|--decode)[^\n]*\|\s*(sudo\s+)?(ba|z)?sh\b|\beval\s*\(\s*(atob|Buffer\.from)\b/i,
  },
  {
    id: "prompt-injection",
    severity: "high",
    message: "Tries to override the agent's other instructions",
    pattern:
      /\b(ignore|disregard|forget|override)\b[^\n]{0,30}\b(previous|prior|above|earlier|all|other|system)\b[^\n]{0,20}\b(instructions|rules|prompts?|guidelines)\b/i,
  },
  {
    // Medium, not high: phrasing like "don't tell the user to run X" is common and benign.
    id: "conceal-from-user",
    severity: "medium",
    message: "May ask the agent to hide what it does from the user",
    pattern: /\b(do not|don't|never)\s+(tell|inform|notify|alert)\s+the\s+user\b/i,
  },
  {
    id: "upload-files",
    severity: "high",
    message: "Uploads local files to a remote server",
    pattern: /\bcurl\b[^\n]*\s(-d|--data(-binary)?|-F|--form|-T|--upload-file)\s+['"]?@/i,
  },
  {
    id: "credential-access",
    severity: "medium",
    message: "Reads credentials or secrets",
    pattern:
      /(~|\$HOME|%USERPROFILE%)[/\\]\.(ssh|aws|gnupg|kube|docker[/\\]config)|\bid_(rsa|ed25519|ecdsa)\b|\b(cat|less|head|tail|source)\s+[^\n]*\.env\b|security\s+find-generic-password/i,
  },
  {
    id: "raw-ip-url",
    severity: "medium",
    message: "Contacts a raw IP address",
    pattern: /\bhttps?:\/\/\d{1,3}(\.\d{1,3}){3}\b/,
  },
  {
    id: "encoded-blob",
    severity: "medium",
    message: "Contains a long encoded blob",
    pattern: /[A-Za-z0-9+/]{200,}={0,2}/,
  },
  {
    id: "destructive-command",
    severity: "medium",
    message: "Runs a destructive command",
    pattern:
      /\brm\s+-[a-z]*r[a-z]*f?\s+(\/|~|\$HOME)(\s|$)|\bmkfs(\.\w+)?\s|\bdd\s+[^\n]*of=\/dev\//i,
  },
];

/** Zero-width, bidirectional-control and Unicode "tag" characters: invisible to a reviewer. */
const HIDDEN_CHARACTERS = /[​-‏‪-‮⁠-⁤⁦-⁩﻿]|[\u{E0000}-\u{E007F}]/u;

const SCRIPT_EXTENSIONS = new Set([
  ".sh",
  ".bash",
  ".zsh",
  ".fish",
  ".py",
  ".js",
  ".mjs",
  ".cjs",
  ".ts",
  ".rb",
  ".pl",
  ".php",
  ".ps1",
  ".bat",
  ".cmd",
]);
const NATIVE_EXTENSIONS = new Set([".exe", ".dll", ".so", ".dylib", ".bin", ".app", ".msi"]);

const SEVERITY_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
const MAX_EXCERPT = 120;

/** Scans every file in a skill directory. Findings are sorted most severe first. */
export async function auditDirectory(dir: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  for (const file of await listFiles(dir)) {
    const path = join(dir, file);
    const bytes = await readFile(path);
    const extension = extname(file).toLowerCase();
    const executable = ((await stat(path)).mode & 0o111) !== 0;

    if (NATIVE_EXTENSIONS.has(extension) || bytes.includes(0)) {
      findings.push(finding("high", "binary-file", "Contains a binary or native executable", file));
      continue;
    }
    if (SCRIPT_EXTENSIONS.has(extension) || executable) {
      findings.push(
        finding("low", "script-file", "Contains a script the agent may be told to run", file),
      );
    }
    findings.push(...auditText(file, bytes.toString("utf8")));
  }
  return findings.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

export function auditText(file: string, text: string): Finding[] {
  const findings: Finding[] = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (HIDDEN_CHARACTERS.test(line)) {
      findings.push(
        finding(
          "high",
          "hidden-characters",
          "Contains invisible or text-direction characters",
          file,
          index + 1,
          line.replace(new RegExp(HIDDEN_CHARACTERS, "gu"), "⟨?⟩"),
        ),
      );
    }
    for (const rule of TEXT_RULES) {
      if (rule.pattern.test(line)) {
        findings.push(finding(rule.severity, rule.id, rule.message, file, index + 1, line));
      }
    }
  });
  return findings;
}

export function hasBlockingFindings(findings: readonly Finding[]): boolean {
  return findings.some((f) => f.severity === "high");
}

function finding(
  severity: Severity,
  rule: string,
  message: string,
  file: string,
  line: number | null = null,
  excerpt: string | null = null,
): Finding {
  const trimmed = excerpt?.trim() ?? null;
  return {
    severity,
    rule,
    message,
    file,
    line,
    excerpt:
      trimmed && trimmed.length > MAX_EXCERPT ? `${trimmed.slice(0, MAX_EXCERPT - 1)}…` : trimmed,
  };
}
