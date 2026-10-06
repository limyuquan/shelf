import { useSuspenseQuery } from "@tanstack/react-query";
import { createRoute } from "@tanstack/react-router";
import { Activity } from "lucide-react";
import { rootRoute } from "../app/root-route.tsx";
import { PageBody, PageHeader } from "../components/layout/page.tsx";
import { EmptyState } from "../components/ui/empty-state.tsx";
import { activityQuery } from "../features/activity/queries.ts";
import { Timeline } from "../features/activity/timeline.tsx";

export const activityRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/activity",
  loader: ({ context }) => context.queryClient.ensureQueryData(activityQuery({ limit: 300 })),
  component: ActivityPage,
});

function ActivityPage() {
  const { data: events } = useSuspenseQuery(activityQuery({ limit: 300 }));
  return (
    <>
      <PageHeader crumbs={[{ label: "Activity" }]} />
      <PageBody>
        {events.length === 0 ? (
          <EmptyState icon={<Activity />} title="No activity yet" />
        ) : (
          <div className="mx-auto max-w-[760px] px-8 py-6">
            <Timeline events={events} />
          </div>
        )}
      </PageBody>
    </>
  );
}
