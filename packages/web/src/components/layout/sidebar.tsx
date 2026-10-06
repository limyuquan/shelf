import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  BookOpen,
  FolderGit2,
  Inbox,
  Keyboard,
  Monitor,
  Moon,
  Search,
  Settings,
  Sun,
  SunMoon,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { attentionQuery } from "../../features/attention/queries.ts";
import { projectsQuery } from "../../features/projects/queries.ts";
import { getThemePreference, setThemePreference, type ThemePreference } from "../../lib/theme.ts";
import { ProjectAvatar } from "../project-avatar.tsx";
import { IconButton } from "../ui/button.tsx";
import { Kbd } from "../ui/kbd.tsx";
import { Menu, MenuRadioGroup } from "../ui/menu.tsx";
import { Tooltip } from "../ui/tooltip.tsx";

export function Sidebar({
  onSearch,
  onShortcuts,
}: {
  onSearch: () => void;
  onShortcuts: () => void;
}) {
  const attention = useQuery(attentionQuery());
  const projects = useQuery(projectsQuery());

  return (
    <aside className="flex w-[236px] shrink-0 flex-col px-2.5 py-2.5">
      <div className="flex h-9 items-center justify-between pr-0.5 pl-2">
        <Link to="/" className="flex items-center gap-2 font-semibold text-[14px] text-fg">
          <Logo />
          shelf
        </Link>
        <Tooltip label="Search" shortcut="⌘K">
          <IconButton label="Search" onClick={onSearch}>
            <Search />
          </IconButton>
        </Tooltip>
      </div>

      <nav className="mt-3 flex flex-col gap-px">
        <NavItem to="/" icon={<Inbox />} label="Attention" count={attention.data?.length} />
        <NavItem to="/projects" icon={<FolderGit2 />} label="Projects" />
        <NavItem to="/library" icon={<BookOpen />} label="Library" />
        <NavItem to="/activity" icon={<Activity />} label="Activity" />
      </nav>

      <div className="mt-6 flex items-center px-2 font-medium text-[12px] text-fg-subtle">
        Projects
      </div>
      <nav className="mt-1 flex min-h-0 flex-col gap-px overflow-y-auto">
        {projects.data?.map((project) => (
          <Link
            key={project.id}
            to="/projects/$projectId"
            params={{ projectId: project.id }}
            className="group flex h-[30px] items-center gap-2.5 rounded-md px-2 text-[13px] text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg data-[status=active]:bg-surface-hover data-[status=active]:text-fg pointer-coarse:h-11 pointer-coarse:text-[15px]"
          >
            <ProjectAvatar name={project.name} />
            <span className="flex-1 truncate">{project.name}</span>
            <span className="text-[11.5px] text-fg-subtle">{project.loans}</span>
          </Link>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-px pt-3">
        <NavItem to="/settings" icon={<Settings />} label="Settings" />
        <div className="mt-1 flex items-center justify-between px-1">
          <button
            type="button"
            onClick={onSearch}
            className="flex h-7 items-center gap-2 rounded-md px-1.5 text-[12px] text-fg-subtle hover:text-fg-muted pointer-coarse:invisible"
          >
            <Kbd>⌘K</Kbd> Commands
          </button>
          <div className="flex items-center">
            <Tooltip label="Keyboard shortcuts" shortcut="?" side="top">
              <IconButton
                label="Keyboard shortcuts"
                onClick={onShortcuts}
                className="pointer-coarse:hidden"
              >
                <Keyboard />
              </IconButton>
            </Tooltip>
            <ThemeMenu />
          </div>
        </div>
      </div>
    </aside>
  );
}

function NavItem({
  to,
  icon,
  label,
  count,
}: {
  to: "/" | "/projects" | "/library" | "/activity" | "/settings";
  icon: ReactNode;
  label: string;
  count?: number | undefined;
}) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: to === "/" }}
      className="flex h-[30px] items-center gap-2.5 rounded-md px-2 text-[13px] text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg data-[status=active]:bg-surface-hover data-[status=active]:font-medium data-[status=active]:text-fg [&_svg]:size-4 pointer-coarse:h-11 pointer-coarse:text-[15px]"
    >
      {icon}
      <span className="flex-1">{label}</span>
      {count ? (
        <span className="rounded-full bg-accent-soft px-1.5 font-medium text-[11px] text-accent">
          {count}
        </span>
      ) : null}
    </Link>
  );
}

function ThemeMenu() {
  const [theme, setTheme] = useState<ThemePreference>(getThemePreference);
  return (
    <Menu
      side="top"
      align="end"
      trigger={
        <IconButton label="Theme">
          <SunMoon />
        </IconButton>
      }
    >
      <MenuRadioGroup
        value={theme}
        onChange={(next) => {
          setThemePreference(next);
          setTheme(next);
        }}
        options={[
          { value: "system", label: "System", icon: <Monitor /> },
          { value: "light", label: "Light", icon: <Sun /> },
          { value: "dark", label: "Dark", icon: <Moon /> },
        ]}
      />
    </Menu>
  );
}

/** Three book spines: the shelf. */
export function Logo() {
  return (
    <svg viewBox="0 0 32 32" className="size-[22px]" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--accent)" />
      <path d="M9 9h3v14H9zM14.5 9h3v14h-3zM20.2 9.6l2.9-.8 3.6 13.5-2.9.8z" fill="#fff" />
    </svg>
  );
}
