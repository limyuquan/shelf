import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { ContentState } from "../../api/types.ts";
import { DiffView } from "../../components/diff-view.tsx";
import { Button } from "../../components/ui/button.tsx";
import { Checkbox } from "../../components/ui/checkbox.tsx";
import { Dialog, DialogLayout } from "../../components/ui/dialog.tsx";
import { Skeleton } from "../../components/ui/skeleton.tsx";
import { loanDiffQuery, useLoanAction, usePromote } from "./mutations.ts";

const COPY: Partial<Record<ContentState, { title: string; description: string }>> = {
  modified: {
    title: "Local edits",
    description: "This project's copy differs from the revision it borrowed.",
  },
  diverged: {
    title: "Edited here and in the library",
    description: "Both changed since this project borrowed it. Keep one version.",
  },
  behind: {
    title: "Library update",
    description: "The library has changed since this project borrowed it.",
  },
};

/**
 * Shows what changed in a borrowed copy and offers the matching way forward:
 * promote or discard local edits, or take the library's newer revision.
 */
export function ChangesDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  skill,
  content,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  skill: string;
  content: ContentState;
}) {
  const diff = useQuery({ ...loanDiffQuery(projectId, skill), enabled: open });
  const promote = usePromote();
  const action = useLoanAction();
  const [everywhere, setEverywhere] = useState(true);
  const target = { projectId, skill };
  const close = () => onOpenChange(false);
  const busy = promote.isPending || action.isPending;
  const copy = COPY[content] ?? { title: "Changes", description: "" };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="w-[min(860px,calc(100vw-32px))]">
      <DialogLayout
        title={`${skill} · ${copy.title}`}
        description={`${projectName}: ${copy.description}`}
        footer={
          <>
            {content === "modified" && (
              <label className="mr-auto flex items-center gap-2 text-[13px] text-fg-muted">
                <Checkbox
                  label="Also update other projects"
                  checked={everywhere}
                  onChange={setEverywhere}
                />
                Also update other projects that borrow it
              </label>
            )}
            {(content === "modified" || content === "diverged") && (
              <Button
                variant="danger"
                disabled={busy}
                onClick={() =>
                  action.mutate(
                    { target, action: { kind: "update", force: true } },
                    { onSuccess: close },
                  )
                }
              >
                {content === "diverged" ? "Take the library's" : "Discard edits"}
              </Button>
            )}
            {(content === "modified" || content === "diverged") && (
              <Button
                variant="primary"
                disabled={busy}
                onClick={() =>
                  promote.mutate(
                    { target, force: content === "diverged", propagate: everywhere },
                    { onSuccess: close },
                  )
                }
              >
                {content === "diverged" ? "Keep this project's" : "Promote to library"}
              </Button>
            )}
            {content === "behind" && (
              <Button
                variant="primary"
                disabled={busy}
                onClick={() =>
                  action.mutate({ target, action: { kind: "update" } }, { onSuccess: close })
                }
              >
                Update to latest
              </Button>
            )}
          </>
        }
      >
        {diff.data ? (
          <DiffView files={diff.data.files} />
        ) : (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-9" />
            <Skeleton className="h-40" />
          </div>
        )}
      </DialogLayout>
    </Dialog>
  );
}
