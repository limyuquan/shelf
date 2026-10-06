import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { ProjectAvatar } from "../../components/project-avatar.tsx";
import { IconButton } from "../../components/ui/button.tsx";
import { Menu, MenuItem } from "../../components/ui/menu.tsx";
import { Tooltip } from "../../components/ui/tooltip.tsx";
import { useBorrow } from "../loans/mutations.ts";
import { projectsQuery } from "../projects/queries.ts";

/** Borrow this skill into a project that doesn't have it yet. */
export function BorrowInto({ skill, borrowers }: { skill: string; borrowers: readonly string[] }) {
  const projects = useQuery(projectsQuery());
  const borrow = useBorrow();
  const candidates = (projects.data ?? []).filter(
    (project) => project.exists && !borrowers.includes(project.name),
  );
  if (candidates.length === 0) return null;
  return (
    <Menu
      align="end"
      trigger={
        <Tooltip label="Borrow into a project">
          <IconButton label="Borrow into a project" className="-mr-1.5 size-6">
            <Plus />
          </IconButton>
        </Tooltip>
      }
    >
      {candidates.map((project) => (
        <MenuItem
          key={project.id}
          icon={<ProjectAvatar name={project.name} />}
          onClick={() => borrow.mutate({ projectId: project.id, skills: [skill] })}
        >
          {project.name}
        </MenuItem>
      ))}
    </Menu>
  );
}
