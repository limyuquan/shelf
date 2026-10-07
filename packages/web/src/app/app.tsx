import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { useEffect } from "react";
import { Toaster } from "sonner";
import { startLive } from "../api/live.ts";
import { TooltipProvider } from "../components/ui/tooltip.tsx";
import { queryClient } from "./query-client.ts";
import { router } from "./router.tsx";

export function App() {
  useEffect(() => startLive(queryClient), []);
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delay={400}>
        <RouterProvider router={router} />
      </TooltipProvider>
      <Toaster
        position="bottom-right"
        toastOptions={{
          className:
            "!bg-surface-overlay !text-fg !border-border-strong !shadow-popup !font-sans !text-[13px]",
          // sonner colours descriptions for its own light theme; follow ours instead.
          classNames: { description: "!text-fg-muted" },
        }}
      />
    </QueryClientProvider>
  );
}
