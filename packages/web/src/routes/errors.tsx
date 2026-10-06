import { type ErrorComponentProps, Link } from "@tanstack/react-router";
import { CircleAlert, Compass } from "lucide-react";
import { ApiError } from "../api/client.ts";
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
  return (
    <EmptyState
      icon={<CircleAlert />}
      title={error instanceof Error ? error.message : "Something went wrong"}
    >
      {error instanceof ApiError && error.hint}
      {error instanceof ApiError && error.status === 401 && (
        <p>Open the dashboard with the link `shelf ui` printed; it carries the access token.</p>
      )}
    </EmptyState>
  );
}
