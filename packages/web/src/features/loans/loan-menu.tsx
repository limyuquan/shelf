import {
  ArrowUpCircle,
  CalendarClock,
  FileDiff,
  MoreHorizontal,
  RotateCcw,
  Undo2,
} from "lucide-react";
import { useState } from "react";
import type { ContentState } from "../../api/types.ts";
import { IconButton } from "../../components/ui/button.tsx";
import { Menu, MenuItem, MenuSeparator } from "../../components/ui/menu.tsx";
import { ChangesDialog } from "./changes-dialog.tsx";
import { useLoanAction } from "./mutations.ts";

/** Every action on one loan, behind a "…" button. */
export function LoanMenu({
  projectId,
  projectName,
  skill,
  content,
}: {
  projectId: string;
  projectName: string;
  skill: string;
  content: ContentState;
}) {
  const action = useLoanAction();
  const [reviewing, setReviewing] = useState(false);
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
        <MenuItem
          icon={<RotateCcw />}
          onClick={() => action.mutate({ target, action: { kind: "renew" } })}
        >
          Renew for 30 days
        </MenuItem>
        <MenuItem
          icon={<CalendarClock />}
          onClick={() => action.mutate({ target, action: { kind: "due", when: "+7d" } })}
        >
          Extend by a week
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
          onClick={() => action.mutate({ target, action: { kind: "return", force: edited } })}
        >
          {edited ? "Return and delete edits" : "Return"}
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
    </>
  );
}
