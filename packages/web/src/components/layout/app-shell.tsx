import { Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useHotkeys } from "../../lib/hotkeys.ts";
import { CommandMenu } from "./command-menu.tsx";
import { ShortcutsDialog } from "./shortcuts-dialog.tsx";
import { Sidebar } from "./sidebar.tsx";

const GO_TO = {
  a: "/",
  p: "/projects",
  l: "/library",
  y: "/activity",
  s: "/settings",
} as const;

/** Sidebar plus an inset main panel, the layout of every page. */
export function AppShell() {
  const navigate = useNavigate();
  const [searching, setSearching] = useState(false);
  const [helping, setHelping] = useState(false);
  // "g" then a letter jumps to a page, like Linear and Gmail.
  const awaitingGoTo = useRef<number | null>(null);

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

  return (
    <div className="flex h-full bg-bg">
      <Sidebar onSearch={() => setSearching(true)} onShortcuts={() => setHelping(true)} />
      <main className="my-2 mr-2 flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        <Outlet />
      </main>
      <CommandMenu open={searching} onOpenChange={setSearching} />
      <ShortcutsDialog open={helping} onOpenChange={setHelping} />
    </div>
  );
}
