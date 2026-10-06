import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useHotkeys } from "../../lib/hotkeys.ts";
import { CommandMenu } from "./command-menu.tsx";
import { ShellContext } from "./shell-context.ts";
import { ShortcutsDialog } from "./shortcuts-dialog.tsx";
import { Sidebar } from "./sidebar.tsx";

const GO_TO = {
  a: "/",
  p: "/projects",
  l: "/library",
  y: "/activity",
  s: "/settings",
} as const;

/**
 * Sidebar plus an inset main panel. Below the `lg` breakpoint the sidebar becomes
 * a drawer (opened from each page header) and the main panel goes full-bleed.
 */
export function AppShell() {
  const navigate = useNavigate();
  const [searching, setSearching] = useState(false);
  const [helping, setHelping] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  // "g" then a letter jumps to a page, like Linear and Gmail.
  const awaitingGoTo = useRef<number | null>(null);

  // Choosing a page in the drawer should reveal it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: close on every navigation
  useEffect(() => setNavigating(false), [pathname]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setSearching((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useHotkeys({
    "?": () => setHelping(true),
    g: () => {
      awaitingGoTo.current = window.setTimeout(() => {
        awaitingGoTo.current = null;
      }, 1000);
    },
    ...Object.fromEntries(
      Object.entries(GO_TO).map(([key, to]) => [
        key,
        () => {
          if (awaitingGoTo.current === null) return;
          window.clearTimeout(awaitingGoTo.current);
          awaitingGoTo.current = null;
          void navigate({ to });
        },
      ]),
    ),
  });

  const shell = useMemo(
    () => ({ openNavigation: () => setNavigating(true), openSearch: () => setSearching(true) }),
    [],
  );
  const sidebar = (
    <Sidebar
      onSearch={() => {
        setNavigating(false);
        setSearching(true);
      }}
      onShortcuts={() => setHelping(true)}
    />
  );

  return (
    <ShellContext.Provider value={shell}>
      <div className="flex h-full bg-bg">
        <div className="hidden lg:flex">{sidebar}</div>
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-surface lg:my-2 lg:mr-2 lg:rounded-xl lg:border lg:border-border lg:shadow-sm">
          <Outlet />
        </main>
        <BaseDialog.Root open={navigating} onOpenChange={setNavigating}>
          <BaseDialog.Portal>
            <BaseDialog.Backdrop className="fixed inset-0 z-40 bg-black/50 transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 lg:hidden" />
            <BaseDialog.Popup
              aria-label="Navigation"
              className="fixed inset-y-0 left-0 z-50 flex w-[min(300px,85vw)] bg-bg pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] shadow-popup outline-none transition-transform data-[ending-style]:-translate-x-full data-[starting-style]:-translate-x-full lg:hidden [&>aside]:w-full"
            >
              {sidebar}
            </BaseDialog.Popup>
          </BaseDialog.Portal>
        </BaseDialog.Root>
        <CommandMenu open={searching} onOpenChange={setSearching} />
        <ShortcutsDialog open={helping} onOpenChange={setHelping} />
      </div>
    </ShellContext.Provider>
  );
}
