import { Link } from "@tanstack/react-router";
import { CircleCheck, TriangleAlert, X } from "lucide-react";
import type { AdoptResult } from "../../api/types.ts";
import { IconButton } from "../../components/ui/button.tsx";
import { StatusPill, toneText } from "../../components/ui/status.tsx";
import { Tooltip } from "../../components/ui/tooltip.tsx";
import { CONTENT } from "../loans/states.ts";
import { PathText } from "./path-text.tsx";
import { ADOPTED, plural, summarizeAdopt, tildePath } from "./select.ts";

/** What the last adoption did to each copy: the library outcome and the loan it became. */
export function AdoptResults({
  results,
  home,
  onDismiss,
}: {
  results: readonly AdoptResult[];
  home: string;
  onDismiss: () => void;
}) {
  const { title, detail } = summarizeAdopt(results);
  return (
    <section className="border-border-subtle border-b bg-surface-raised/60">
      <div className="flex items-center gap-2.5 px-4 pt-3 md:px-5">
        <CircleCheck className={`size-4 shrink-0 ${toneText("green")}`} />
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2.5">
          <h2 className="font-medium text-[13px] text-fg">{title}</h2>
          <span className="text-[12.5px] text-fg-muted">{detail}</span>
        </div>
        <Tooltip label="Dismiss">
          <IconButton label="Dismiss" onClick={onDismiss} className="-mr-1.5">
            <X />
          </IconButton>
        </Tooltip>
      </div>
      <ul className="px-4 pt-1 pb-3 md:px-5">
        {results.map((result) => {
          const outcome = ADOPTED[result.library];
          const content = result.loan ? CONTENT[result.loan.content] : null;
          return (
            <li
              key={result.path}
              className="flex flex-col gap-1 border-border-subtle border-t py-2.5 first:border-t-0 md:flex-row md:items-center md:gap-4"
            >
              <div className="min-w-0 flex-1">
                <Link
                  to="/library/$skillName"
                  params={{ skillName: result.skill }}
                  className="font-medium text-fg hover:underline"
                >
                  {result.skill}
                </Link>
                <p className="break-words font-mono text-[12px] text-fg-subtle">
                  <PathText path={tildePath(result.path, home)} />
                </p>
                <p className="text-[12px] text-fg-muted">{outcome.help}</p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <StatusPill tone={outcome.tone}>{outcome.label}</StatusPill>
                {result.loan && content ? (
                  <span className="inline-flex items-center gap-1.5 text-[12px] text-fg-muted">
                    {result.loan.status === "created" ? "borrowed by" : "already in"}{" "}
                    {result.loan.project}
                    <StatusPill tone={content.tone}>{content.label}</StatusPill>
                  </span>
                ) : (
                  <span className="text-[12px] text-fg-muted">No loan: {result.note}</span>
                )}
                {result.findings.length > 0 && (
                  <span
                    className={`inline-flex items-center gap-1 text-[12px] ${toneText("yellow")}`}
                  >
                    <TriangleAlert className="size-3.5" />
                    {plural(result.findings.length, "finding")} to review
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
