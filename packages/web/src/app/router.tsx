import { createRouter } from "@tanstack/react-router";
import { activityRoute } from "../routes/activity.tsx";
import { attentionRoute } from "../routes/attention.tsx";
import { insightsRoute } from "../routes/insights.tsx";
import { libraryRoute } from "../routes/library.tsx";
import { projectRoute } from "../routes/project.tsx";
import { projectsRoute } from "../routes/projects.tsx";
import { revisionRoute } from "../routes/revision.tsx";
import { settingsRoute } from "../routes/settings.tsx";
import { skillRoute } from "../routes/skill.tsx";
import { queryClient } from "./query-client.ts";
import { rootRoute } from "./root-route.tsx";

const routeTree = rootRoute.addChildren([
  attentionRoute,
  projectsRoute,
  projectRoute,
  libraryRoute,
  skillRoute,
  revisionRoute,
  activityRoute,
  insightsRoute,
  settingsRoute,
]);

export const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: "intent",
  // Loaders only warm the query cache; components read from it.
  defaultPreloadStaleTime: 0,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
