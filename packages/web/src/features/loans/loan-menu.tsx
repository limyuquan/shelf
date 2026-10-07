import {
  ArrowUpCircle,
  CalendarClock,
  FileDiff,
  MoreHorizontal,
  Pin,
  PinOff,
  RotateCcw,
  Undo2,
} from "lucide-react";
import { useState } from "react";
import type { ContentState } from "../../api/types.ts";
import { IconButton } from "../../components/ui/button.tsx";
import { Menu, MenuItem, MenuSeparator } from "../../components/ui/menu.tsx";
import { ChangesDialog } from "./changes-dialog.tsx";
import { useLoanAction } from "./mutations.ts";
import { ReturnDialog } from "./return-dialog.tsx";

/** Every action on one loan, behind a "…" button. */
export function LoanMenu({
  projectId,
  projectName,
  skill,
  content,
  kept,
  loanDays,
}: {
  projectId: string;
  projectName: string;
  skill: string;
  content: ContentState;
  /** Kept loans never come due, so renewing them is pointless. */
  kept: boolean;
  /** How far a renewal moves the due date. */
  loanDays: number;
}) {
  const action = useLoanAction();
  const [reviewing, setReviewing] = useState(false);
  // Returning an edited loan deletes the edits, so it is confirmed like a bulk return.
  const [returning, setReturning] = useState(false);
  const target = { projectId, skill };
  const edited = content === "modified" || content === "diverged";
  return (
    <>
      <Menu
        align="end"
        trigger={
          <IconButton label={`Actions for ${skill}`}>
            <MoreHorizontal />
          </IconButton>
        }
      >
        {(edited || content === "behind") && (
          <MenuItem icon={<FileDiff />} onClick={() => setReviewing(true)}>
            {edited ? "Review edits…" : "Review library changes…"}
          </MenuItem>
        )}
        {!kept && (
          <>
            <MenuItem
              icon={<RotateCcw />}
              onClick={() => action.mutate({ target, action: { kind: "renew" } })}
            >
              Renew for {loanDays} days
            </MenuItem>
            <MenuItem
              icon={<CalendarClock />}
              onClick={() => action.mutate({ target, action: { kind: "due", when: "+7d" } })}
            >
              Extend by a week
            </MenuItem>
          </>
        )}
        <MenuItem
          icon={kept ? <PinOff /> : <Pin />}
          onClick={() => action.mutate({ target, action: { kind: "keep", keep: !kept } })}
        >
          {kept ? "Stop keeping" : "Keep — never expires"}
        </MenuItem>
        {content === "behind" && (
          <MenuItem
            icon={<ArrowUpCircle />}
            onClick={() => action.mutate({ target, action: { kind: "update" } })}
          >
            Update to latest
          </MenuItem>
        )}
        <MenuSeparator />
        <MenuItem
          icon={<Undo2 />}
          danger
          onClick={() =>
            edited
              ? setReturning(true)
              : action.mutate({ target, action: { kind: "return", force: false } })
          }
        >
          {edited ? "Return and delete edits…" : "Return"}
        </MenuItem>
      </Menu>
      <ChangesDialog
        open={reviewing}
        onOpenChange={setReviewing}
        projectId={projectId}
        projectName={projectName}
        skill={skill}
        content={content}
      />
      {returning && (
        <ReturnDialog
          loans={[{ skill, content, kept }]}
          where={projectName}
          label={(loan) => loan.skill}
          pending={action.isPending}
          onOpenChange={setReturning}
          onConfirm={() =>
            action.mutate(
              { target, action: { kind: "return", force: true } },
              { onSuccess: () => setReturning(false) },
            )
          }
        />
      )}
    </>
  );
}
