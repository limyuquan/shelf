import { type UseMutationResult, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Archive, Copy, MoreHorizontal, PenLine } from "lucide-react";
import { useEffect, useState } from "react";
import { ApiError } from "../../api/client.ts";
import type { SkillPage } from "../../api/types.ts";
import { ProjectAvatar } from "../../components/project-avatar.tsx";
import { Button, IconButton } from "../../components/ui/button.tsx";
import { Dialog, DialogLayout } from "../../components/ui/dialog.tsx";
import { Menu, MenuItem, MenuSeparator } from "../../components/ui/menu.tsx";
import { useShortPath } from "../system/short-path.ts";
import { useArchiveSkill, useDuplicateSkill, useRenameSkill } from "./authoring.ts";
import { CallError, NameField } from "./fields.tsx";
import { skillNameProblem } from "./names.ts";
import { skillsQuery } from "./queries.ts";

type Action = "rename" | "duplicate" | "archive";

/** Rename, duplicate or archive the skill, behind a "…" button in the page header. */
export function SkillActionsMenu({ page }: { page: SkillPage }) {
  const [action, setAction] = useState<Action | null>(null);
  const name = page.detail.name;
  const close = (open: boolean) => !open && setAction(null);
  return (
    <>
      <Menu
        align="end"
        trigger={
          <IconButton label={`Actions for ${name}`}>
            <MoreHorizontal />
          </IconButton>
        }
      >
        <MenuItem icon={<PenLine />} onClick={() => setAction("rename")}>
          Rename…
        </MenuItem>
        <MenuItem icon={<Copy />} onClick={() => setAction("duplicate")}>
          Duplicate…
        </MenuItem>
        <MenuSeparator />
        <MenuItem icon={<Archive />} danger onClick={() => setAction("archive")}>
          Archive…
        </MenuItem>
      </Menu>
      <RenameDialog page={page} open={action === "rename"} onOpenChange={close} />
      <DuplicateDialog page={page} open={action === "duplicate"} onOpenChange={close} />
      <ArchiveDialog page={page} open={action === "archive"} onOpenChange={close} />
    </>
  );
}

interface ActionDialogProps {
  page: SkillPage;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function RenameDialog({ page, open, onOpenChange }: ActionDialogProps) {
  const name = page.detail.name;
  const rename = useRenameSkill(name);
  return (
    <NameDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Rename ${name}`}
      description="Renames its folder and the name in SKILL.md. History and activity stay with it."
      current={name}
      initial={name}
      submitLabel="Rename"
      mutation={rename}
      borrowers={page.propagation.projects.map((project) => project.project)}
    />
  );
}

function DuplicateDialog({ page, open, onOpenChange }: ActionDialogProps) {
  const name = page.detail.name;
  const duplicate = useDuplicateSkill(name);
  return (
    <NameDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Duplicate ${name}`}
      description="Copies every file into a new skill with its own history."
      current={name}
      initial={`${name}-copy`}
      submitLabel="Duplicate"
      mutation={duplicate}
      borrowers={[]}
    />
  );
}

/** Asks for a new name; shared by rename and duplicate. */
function NameDialog({
  open,
  onOpenChange,
  title,
  description,
  current,
  initial,
  submitLabel,
  mutation,
  borrowers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /** The skill's name now; the new one must differ. */
  current: string;
  initial: string;
  submitLabel: string;
  mutation: UseMutationResult<unknown, Error, string>;
  /** Shown when the server refuses because projects borrow the skill. */
  borrowers: readonly string[];
}) {
  const [to, setTo] = useState(initial);
  const skills = useQuery({ ...skillsQuery(), enabled: open });
  // The skill's own name is "taken" too, but typing it back isn't worth an error.
  const taken = (skills.data ?? []).map((skill) => skill.name).filter((n) => n !== current);
  const problem = skillNameProblem(to, taken);
  const ready = to !== "" && to !== current && !problem;
  // Start from the current name each time: after a rename the page stays mounted.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset once per opening
  useEffect(() => {
    if (open) {
      setTo(initial);
      mutation.reset();
    }
  }, [open]);
  const close = (next: boolean) => onOpenChange(next);
  const submit = () => {
    if (ready && !mutation.isPending) mutation.mutate(to, { onSuccess: () => close(false) });
  };
  return (
    <Dialog open={open} onOpenChange={close} className="sm:max-w-[480px]">
      <DialogLayout
        title={title}
        description={description}
        footer={
          <>
            <Button variant="ghost" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={!ready || mutation.isPending} onClick={submit}>
              {submitLabel}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <NameField
            label="New name"
            value={to}
            onChange={setTo}
            problem={problem}
            onSubmit={submit}
          />
          {mutation.isError && (
            <CallError error={mutation.error}>
              {isConflict(mutation.error) && <BorrowerList names={borrowers} />}
            </CallError>
          )}
        </div>
      </DialogLayout>
    </Dialog>
  );
}

function ArchiveDialog({ page, open, onOpenChange }: ActionDialogProps) {
  const name = page.detail.name;
  const archive = useArchiveSkill(name);
  const shortPath = useShortPath();
  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) archive.reset();
  };
  return (
    <Dialog open={open} onOpenChange={close} className="sm:max-w-[480px]">
      <DialogLayout
        title={`Archive ${name}?`}
        description="It leaves your library; nothing is deleted."
        footer={
          <>
            <Button variant="ghost" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={archive.isPending}
              onClick={() => archive.mutate(undefined, { onSuccess: () => close(false) })}
            >
              Archive
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3 text-[13px] text-fg-muted">
          <p>
            The folder moves to{" "}
            <code className="font-mono text-[12px] text-fg">
              {shortPath(page.detail.path.replace(/library[/\\][^/\\]+$/, "archive"))}
            </code>{" "}
            and its {page.detail.revisions} revision{page.detail.revisions === 1 ? "" : "s"} stay
            recorded. To restore it, move the folder back into the library.
          </p>
          {archive.isError && (
            <CallError error={archive.error}>
              {isConflict(archive.error) && (
                <BorrowerList names={page.propagation.projects.map((p) => p.project)} />
              )}
            </CallError>
          )}
        </div>
      </DialogLayout>
    </Dialog>
  );
}

const isConflict = (error: Error) => error instanceof ApiError && error.code === "CONFLICT";

/** Who still borrows the skill, linked so they can be returned. */
function BorrowerList({ names }: { names: readonly string[] }) {
  if (names.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-col gap-1">
      {names.map((project) => (
        <li key={project}>
          <Link
            to="/projects/$projectId"
            params={{ projectId: project }}
            className="inline-flex items-center gap-2 font-medium text-fg hover:underline"
          >
            <ProjectAvatar name={project} className="size-4 text-[9px]" />
            {project}
          </Link>
        </li>
      ))}
    </ul>
  );
}
