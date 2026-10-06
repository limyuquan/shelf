import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui/button.tsx";
import { Dialog, DialogLayout } from "../../components/ui/dialog.tsx";
import { useCreateSkill } from "./authoring.ts";
import { CallError, DescriptionField, NameField } from "./fields.tsx";
import { estimateTokens, LONG_DESCRIPTION, MAX_DESCRIPTION, skillNameProblem } from "./names.ts";
import { skillsQuery } from "./queries.ts";

/** "New skill" for the library header: icon-only on phones. */
export function NewSkillButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)} aria-label="New skill">
        <Plus />
        <span className="max-sm:hidden">New skill</span>
      </Button>
      <NewSkillDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

/** Name and description; the rest of SKILL.md is written on the skill's page. */
export function NewSkillDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const skills = useQuery({ ...skillsQuery(), enabled: open });
  const create = useCreateSkill();
  const nameProblem = skillNameProblem(
    name,
    (skills.data ?? []).map((skill) => skill.name),
  );
  const text = description.trim();
  const descriptionProblem =
    text.length > MAX_DESCRIPTION ? `${MAX_DESCRIPTION} characters at most` : null;
  const ready = name !== "" && text !== "" && !nameProblem && !descriptionProblem;

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      setName("");
      setDescription("");
      create.reset();
    }
  };
  const submit = () => {
    if (ready && !create.isPending) {
      create.mutate({ name, description: text }, { onSuccess: () => close(false) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={close} className="sm:max-w-[520px]">
      <DialogLayout
        title="New skill"
        description="Creates a SKILL.md in your library to fill in."
        footer={
          <>
            <Button variant="ghost" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={!ready || create.isPending} onClick={submit}>
              Create skill
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <NameField value={name} onChange={setName} problem={nameProblem} onSubmit={submit} />
          <DescriptionField
            value={description}
            onChange={setDescription}
            problem={descriptionProblem}
            note={
              <span className={text.length > LONG_DESCRIPTION ? "text-yellow" : undefined}>
                ~{estimateTokens(text)} tokens in every session · {text.length}/{LONG_DESCRIPTION}{" "}
                characters suggested
              </span>
            }
          />
          {create.isError && <CallError error={create.error} />}
        </div>
      </DialogLayout>
    </Dialog>
  );
}
