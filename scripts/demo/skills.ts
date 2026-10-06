/** Sample skills for the demo library. */
export interface DemoSkill {
  readonly name: string;
  readonly description: string;
  readonly steps: string[];
  readonly rules: string[];
}

export const DEMO_SKILLS: DemoSkill[] = [
  {
    name: "react-best-practices",
    description:
      "Component structure, hooks rules and rendering performance for React 19 apps. Use when writing or reviewing React components.",
    steps: [
      "Keep components small and named after what they render",
      "Derive state instead of syncing it with effects",
      "Colocate data fetching with the route that needs it",
    ],
    rules: ["Never call hooks conditionally", "Prefer composition over prop drilling"],
  },
  {
    name: "playwright-testing",
    description:
      "Write reliable end-to-end tests with Playwright: locators, fixtures and flake-free waits.",
    steps: [
      "Locate elements by role and accessible name",
      "Use web-first assertions instead of manual waits",
      "Isolate state with per-test fixtures",
    ],
    rules: ["No fixed timeouts", "One user journey per test"],
  },
  {
    name: "git-hygiene",
    description: "Focused commits, clean branches and conventional commit messages.",
    steps: [
      "Stage related changes only",
      "Write the subject in the imperative, under 72 characters",
      "Rebase feature branches before opening a PR",
    ],
    rules: ["Never force-push shared branches", "Never commit secrets"],
  },
  {
    name: "accessibility-audit",
    description: "Audit interfaces for WCAG 2.2 issues: contrast, focus order, labels and motion.",
    steps: ["Tab through every flow", "Check contrast of text and icons", "Verify labels"],
    rules: ["Every control needs an accessible name"],
  },
  {
    name: "api-design",
    description:
      "Design consistent HTTP APIs: resource naming, error envelopes, pagination and versioning.",
    steps: [
      "Model resources as nouns",
      "Return one error shape everywhere",
      "Paginate with opaque cursors",
    ],
    rules: ["Never break a published response shape"],
  },
  {
    name: "sql-migrations",
    description:
      "Plan safe, reversible database migrations with expand-and-contract and zero downtime.",
    steps: ["Expand the schema", "Backfill in batches", "Switch reads, then contract"],
    rules: ["Every migration must be reversible", "Never lock large tables"],
  },
  {
    name: "release-notes",
    description: "Draft release notes from merged pull requests, grouped by user impact.",
    steps: ["Collect merged PRs since the last tag", "Group by feature, fix and breaking change"],
    rules: ["Write for users, not maintainers"],
  },
  {
    name: "pdf-tools",
    description: "Extract text, tables and form fields from PDFs, and fill or merge PDF files.",
    steps: ["Detect whether the PDF has a text layer", "Extract tables page by page"],
    rules: ["Never upload documents to third-party services"],
  },
];

export function renderSkill(skill: DemoSkill): string {
  const title = skill.name
    .split("-")
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
  return `---
name: ${skill.name}
description: ${JSON.stringify(skill.description)}
---

# ${title}

${skill.description}

## When to use

- The task matches the description above
- The user asks for this kind of work explicitly

## Workflow

${skill.steps.map((step, index) => `${index + 1}. ${step}`).join("\n")}

## Rules

${skill.rules.map((rule) => `- ${rule}`).join("\n")}
`;
}
