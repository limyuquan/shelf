import { Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CommandMenu } from "./command-menu.tsx";
import { Sidebar } from "./sidebar.tsx";

/** Sidebar plus an inset main panel, the layout of every page. */
export function AppShell() {
  const [searching, setSearching] = useState(false);

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

  return (
    <div className="flex h-full bg-bg">
      <Sidebar onSearch={() => setSearching(true)} />
      <main className="my-2 mr-2 flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        <Outlet />
      </main>
      <CommandMenu open={searching} onOpenChange={setSearching} />
    </div>
  );
}
