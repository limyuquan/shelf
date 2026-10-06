import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Command, defaultFilter, useCommandState } from "cmdk";
import {
  Activity,
  BookOpen,
  ChartColumn,
  FileText,
  FolderGit2,
  FolderSearch,
  Inbox,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
} from "lucide-react";
import type { ReactNode } from "react";
import { projectsQuery } from "../../features/projects/queries.ts";
import { matchSearch, shortSnippet } from "../../features/search/describe.ts";
import { useContentSearch } from "../../features/search/queries.ts";
import { Highlighted } from "../../features/search/search-results.tsx";
import { skillsQuery } from "../../features/skills/queries.ts";
import { setThemePreference } from "../../lib/theme.ts";
import { ProjectAvatar } from "../project-avatar.tsx";
import { Dialog } from "../ui/dialog.tsx";

/** ⌘K: jump to any page, project or skill. */
export function CommandMenu({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const projects = useQuery({ ...projectsQuery(), enabled: open });
  const skills = useQuery({ ...skillsQuery(), enabled: open });

  const go = (action: () => void) => () => {
    onOpenChange(false);
    action();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} label="Command menu" placement="top">
      <Command loop filter={filter} className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center gap-2.5 border-border border-b px-4">
          <Search className="size-4 text-fg-subtle" />
          <Command.Input
            autoFocus
            placeholder="Search projects, skills, pages…"
            className="h-12 flex-1 bg-transparent text-[14px] text-fg outline-none placeholder:text-fg-subtle"
          />
        </div>
        <Command.List className="max-h-[360px] overflow-y-auto p-1.5 max-sm:max-h-none max-sm:flex-1">
          <Command.Empty className="px-3 py-8 text-center text-fg-muted">No results</Command.Empty>
          <Group heading="Go to">
            <Item icon={<Inbox />} onSelect={go(() => navigate({ to: "/" }))}>
              Attention
            </Item>
            <Item icon={<FolderGit2 />} onSelect={go(() => navigate({ to: "/projects" }))}>
              Projects
            </Item>
            <Item icon={<BookOpen />} onSelect={go(() => navigate({ to: "/library" }))}>
              Library
            </Item>
            <Item
              value="find existing skills scan adopt"
              icon={<FolderSearch />}
              onSelect={go(() => navigate({ to: "/find-skills" }))}
            >
              Find existing skills
            </Item>
            <Item icon={<Activity />} onSelect={go(() => navigate({ to: "/activity" }))}>
              Activity
            </Item>
            <Item icon={<ChartColumn />} onSelect={go(() => navigate({ to: "/insights" }))}>
              Insights
            </Item>
            <Item icon={<Settings />} onSelect={go(() => navigate({ to: "/settings" }))}>
              Settings
            </Item>
          </Group>
          {projects.data && projects.data.length > 0 && (
            <Group heading="Borrow">
              {projects.data.map((project) => (
                <Item
                  key={project.id}
                  value={`borrow skills into ${project.name}`}
                  icon={<Plus />}
                  onSelect={go(() =>
                    navigate({
                      to: "/projects/$projectId",
                      params: { projectId: project.id },
                      search: { borrow: true },
                    }),
                  )}
                >
                  Borrow skills into {project.name}
                </Item>
              ))}
            </Group>
          )}
          {projects.data && projects.data.length > 0 && (
            <Group heading="Projects">
              {projects.data.map((project) => (
                <Item
                  key={project.id}
                  value={`project ${project.name}`}
                  icon={<ProjectAvatar name={project.name} />}
                  onSelect={go(() =>
                    navigate({ to: "/projects/$projectId", params: { projectId: project.id } }),
                  )}
                >
                  {project.name}
                </Item>
              ))}
            </Group>
          )}
          {skills.data && skills.data.length > 0 && (
            <Group heading="Skills">
              {skills.data.map((skill) => (
                <Item
                  key={skill.name}
                  value={`skill ${skill.name} ${skill.description}`}
                  icon={<BookOpen />}
                  onSelect={go(() =>
                    navigate({ to: "/library/$skillName", params: { skillName: skill.name } }),
                  )}
                >
                  {skill.name}
                </Item>
              ))}
            </Group>
          )}
          <ContentHits go={go} />
          <Group heading="Theme">
            <Item icon={<Sun />} onSelect={go(() => setThemePreference("light"))}>
              Light theme
            </Item>
            <Item icon={<Moon />} onSelect={go(() => setThemePreference("dark"))}>
              Dark theme
            </Item>
          </Group>
        </Command.List>
      </Command>
    </Dialog>
  );
}

/** Content hits are matched by the server: keep them, ranked below name matches. */
const CONTENT = "content:";
const filter: typeof defaultFilter = (value, search, keywords) =>
  value.startsWith(CONTENT) ? 0.001 : defaultFilter(value, search, keywords);

/** The top skills whose content mentions the query, once it has 3+ characters. */
function ContentHits({ go }: { go: (action: () => void) => () => void }) {
  const navigate = useNavigate();
  const search = useCommandState((state) => state.search);
  const { results } = useContentSearch(search, { limit: 5, minLength: 3 });
  if (!results?.length) return null;
  return (
    <Group heading="In skill content">
      {results.map(({ name, matches: [match] }) => {
        const short = match && shortSnippet(match.snippet, match.ranges);
        return (
          <Item
            key={name}
            value={`${CONTENT}${name}`}
            icon={<FileText />}
            onSelect={go(() =>
              navigate({
                to: "/library/$skillName",
                params: { skillName: name },
                search: match ? matchSearch(match) : {},
              }),
            )}
          >
            <span className="shrink-0">{name}</span>
            {short && (
              <span className="min-w-0 flex-1 truncate text-[12px] text-fg-muted">
                <Highlighted text={short.snippet} ranges={short.ranges} />
              </span>
            )}
          </Item>
        );
      })}
    </Group>
  );
}

function Group({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <Command.Group
      heading={heading}
      className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pt-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[11.5px] [&_[cmdk-group-heading]]:text-fg-subtle"
    >
      {children}
    </Command.Group>
  );
}

function Item({
  icon,
  children,
  onSelect,
  value,
}: {
  icon: ReactNode;
  children: ReactNode;
  onSelect: () => void;
  value?: string;
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      {...(value ? { value } : {})}
      className="flex h-9 cursor-default items-center gap-2.5 rounded-md px-2.5 text-[13px] text-fg data-[selected=true]:bg-surface-hover [&_svg]:size-4 [&_svg]:text-fg-muted pointer-coarse:h-11 pointer-coarse:text-[15px]"
    >
      {icon}
      {children}
    </Command.Item>
  );
}
