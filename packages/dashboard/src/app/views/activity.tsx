import type { ActivityData, Json } from "../../contract.ts";
import { useApi } from "../api.ts";
import { ErrorBanner, formatDateTime, Loading } from "../components.tsx";

type Event = Json<ActivityData>["events"][number];

export function ActivityView() {
  const activity = useApi<ActivityData>("/api/activity");
  if (activity.error) return <ErrorBanner error={activity.error} />;
  if (!activity.data) return <Loading />;
  return (
    <>
      <h1>Activity</h1>
      <ActivityTable events={activity.data.events} showProject />
    </>
  );
}

export function ActivityTable({ events, showProject }: { events: Event[]; showProject: boolean }) {
  if (events.length === 0) return <p class="muted">Nothing yet.</p>;
  return (
    <table>
      <thead>
        <tr>
          <th>When</th>
          <th>Event</th>
          {showProject && <th>Project</th>}
          <th>Skill</th>
          <th>By</th>
          <th>Details</th>
        </tr>
      </thead>
      <tbody>
        {events.map((event) => (
          <tr key={event.id}>
            <td>{formatDateTime(event.at)}</td>
            <td>{event.type}</td>
            {showProject && <td>{event.project ?? ""}</td>}
            <td>{event.skill ?? ""}</td>
            <td>{event.actor}</td>
            <td class="muted">{describe(event)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function describe(event: Event): string {
  const detail = event.detail ?? {};
  if (event.type === "loan.due-changed") {
    const to = String(detail.to ?? "").slice(0, 10);
    return detail.reason ? `due ${to}: ${String(detail.reason)}` : `due ${to}`;
  }
  if (typeof detail.reason === "string") return detail.reason;
  if (typeof detail.source === "string") return `from ${detail.source}`;
  return "";
}
