import { CircleCheck, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import type { Finding } from "../../api/types.ts";
import { DiffView } from "../../components/diff-view.tsx";
import { Button } from "../../components/ui/button.tsx";
import { Checkbox } from "../../components/ui/checkbox.tsx";
import { Dialog, DialogLayout } from "../../components/ui/dialog.tsx";
import { Skeleton } from "../../components/ui/skeleton.tsx";
import { cn } from "../../lib/cn.ts";
import { sourceLabel } from "../../lib/format.ts";
import { usePull } from "./queries.ts";

const SEVERITY: Record<Finding["severity"], string> = {
  high: "text-red",
  medium: "text-orange",
  low: "text-yellow",
};

/**
 * Fetches a linked skill's source, then shows the diff and a fresh audit before
 * anything changes. High-severity findings need an explicit override.
 */
export function PullDialog({
  open,
  onOpenChange,
  skill,
  source,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skill: string;
  source: string;
}) {
  const review = usePull(skill);
  const apply = usePull(skill);
  const [override, setOverride] = useState(false);
  const result = review.data;

  // Fetch as soon as the dialog opens; reset when it closes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: run once per opening
  useEffect(() => {
    if (open) review.mutate({});
    else {
      review.reset();
      setOverride(false);
    }
  }, [open]);

  const blocked =
    result?.status === "blocked" || result?.findings.some((f) => f.severity === "high");
  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="w-[min(860px,calc(100vw-32px))]">
      <DialogLayout
        title={`Updates for ${skill}`}
        description={`From ${sourceLabel(source)}`}
        footer={
          result && result.status !== "current" ? (
            <>
              {blocked && (
                <label className="mr-auto flex items-center gap-2 text-[13px] text-fg-muted">
                  <Checkbox
                    label="Apply despite high-severity findings"
                    checked={override}
                    onChange={setOverride}
                  />
                  Apply despite high-severity findings
                </label>
              )}
              <Button
                variant="primary"
                disabled={apply.isPending || (blocked && !override)}
                onClick={() =>
                  apply.mutate(
                    { yes: true, force: override },
                    { onSuccess: () => onOpenChange(false) },
                  )
                }
              >
                Apply to library
              </Button>
            </>
          ) : undefined
        }
      >
        {review.isPending && (
          <div className="flex flex-col gap-2">
            <p className="text-[13px] text-fg-muted">Fetching and auditing the source…</p>
            <Skeleton className="h-9" />
            <Skeleton className="h-40" />
          </div>
        )}
        {review.isError && <p className="text-red">{review.error.message}</p>}
        {result?.status === "current" && (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <CircleCheck className="size-6 text-green" />
            <p className="text-fg">Up to date with its source.</p>
          </div>
        )}
        {result && result.status !== "current" && (
          <div className="flex flex-col gap-5">
            <section>
              <h3 className="mb-2 flex items-center gap-2 font-medium text-[13px] text-fg">
                <ShieldAlert className="size-4 text-fg-muted" />
                Audit ·{" "}
                {result.findings.length === 0
                  ? "no findings"
                  : `${result.findings.length} finding(s)`}
              </h3>
              {result.findings.map((finding) => (
                <div
                  key={`${finding.file}:${finding.line}:${finding.rule}`}
                  className="border-border-subtle border-b py-2 text-[12.5px] last:border-0"
                >
                  <span className={cn("font-medium uppercase", SEVERITY[finding.severity])}>
                    {finding.severity}
                  </span>{" "}
                  <span className="text-fg">{finding.message}</span>{" "}
                  <span className="font-mono text-fg-subtle">
                    {finding.file}
                    {finding.line ? `:${finding.line}` : ""}
                  </span>
                  {finding.excerpt && (
                    <pre className="mt-1 overflow-x-auto font-mono text-fg-muted">
                      {finding.excerpt}
                    </pre>
                  )}
                </div>
              ))}
            </section>
            <DiffView files={result.diff} />
          </div>
        )}
      </DialogLayout>
    </Dialog>
  );
}
