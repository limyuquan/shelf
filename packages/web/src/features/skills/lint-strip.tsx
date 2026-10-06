import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { CircleAlert, TriangleAlert } from "lucide-react";
import { cn } from "../../lib/cn.ts";
import { lintQuery, useDebounced } from "./authoring.ts";

/**
 * Token cost and problems of the SKILL.md draft, checked by the server's linter
 * as you type (debounced). Shows only the counts when the draft is clean.
 */
export function LintStrip({ skill, content }: { skill: string; content: string }) {
  const draft = useDebounced(content, 400);
  const lint = useQuery({ ...lintQuery(skill, draft), placeholderData: keepPreviousData });
  const result = lint.data;
  if (!result) return <div className="mt-3 mb-1 h-[18px]" />;
  const issues = [...result.issues].sort((a, b) =>
    a.level === b.level ? 0 : a.level === "error" ? -1 : 1,
  );

  return (
    <div className="mt-3 mb-1 flex flex-col gap-1 text-[12px]" aria-live="polite">
      <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-fg-subtle tabular-nums">
        <span title="The description is loaded into every session">
          ~{result.descriptionTokens.toLocaleString()} description tokens
        </span>
        <span title="Loaded when an agent uses the skill">
          ~{result.bodyTokens.toLocaleString()} body tokens
        </span>
      </p>
      {issues.length > 0 && (
        <ul className="flex flex-col gap-0.5">
          {issues.map((issue) => (
            <li
              key={`${issue.level}:${issue.message}`}
              className={cn(
                "flex items-start gap-1.5 leading-[18px]",
                issue.level === "error" ? "text-red" : "text-yellow",
              )}
            >
              {issue.level === "error" ? (
                <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
              ) : (
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
              )}
              <span>
                <span className="sr-only">{issue.level}: </span>
                {issue.message}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
