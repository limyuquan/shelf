import { type ErrorComponentProps, Link } from "@tanstack/react-router";
import { CircleAlert, Compass, KeyRound } from "lucide-react";
import { useState } from "react";
import { ApiError } from "../api/client.ts";
import { saveToken } from "../api/token.ts";
import { Button } from "../components/ui/button.tsx";
import { EmptyState } from "../components/ui/empty-state.tsx";

export function NotFound() {
  return (
    <EmptyState icon={<Compass />} title="Nothing here">
      <Link to="/" className="text-accent hover:underline">
        Back to Attention
      </Link>
    </EmptyState>
  );
}

export function RouteError({ error }: ErrorComponentProps) {
  if (error instanceof ApiError && error.status === 401) return <Connect />;
  return (
    <EmptyState
      icon={<CircleAlert />}
      title={error instanceof Error ? error.message : "Something went wrong"}
    >
      {error instanceof ApiError && error.hint}
    </EmptyState>
  );
}

/**
 * Shown when this browser has no valid token: open the link `shelf ui` printed,
 * or paste its token (e.g. on a phone, or in a home-screen app).
 */
function Connect() {
  const [token, setToken] = useState("");
  return (
    <EmptyState icon={<KeyRound />} title="Connect to shelf">
      <p>
        Open the link printed by <code className="font-mono text-fg">shelf ui</code>, or paste the
        token from it (the part after <code className="font-mono text-fg">?token=</code>).
      </p>
      <form
        className="mt-5 flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          saveToken(token);
          location.reload();
        }}
      >
        <input
          value={token}
          onChange={(event) => setToken(event.target.value)}
          placeholder="Access token"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          className="h-9 rounded-md border border-border bg-surface px-3 font-mono text-[13px] text-fg outline-none placeholder:font-sans placeholder:text-fg-subtle focus:border-border-strong sm:flex-1 pointer-coarse:h-11"
        />
        <Button type="submit" variant="primary" size="md" disabled={token.trim().length < 32}>
          Connect
        </Button>
      </form>
    </EmptyState>
  );
}
