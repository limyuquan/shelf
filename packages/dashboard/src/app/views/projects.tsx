import { useState } from "preact/hooks";
import type { OverviewData, SweepResult } from "../../contract.ts";
import { type ApiError, api, useApi } from "../api.ts";
import { ErrorBanner, formatDateTime, Loading } from "../components.tsx";

export function ProjectsView() {
  const overview = useApi<OverviewData>("/api/overview");
  const [error, setError] = useState<ApiError | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const syncAll = async () => {
    try {
      const result = await api<SweepResult>("POST", "/api/sweep");
      const returned = result.synced.flatMap((sync) => sync.expired);
      setMessage(
        returned.length > 0 ? `Returned overdue: ${returned.join(", ")}` : "Everything is in sync.",
      );
      setError(null);
      overview.reload();
    } catch (failure) {
      setError(failure as ApiError);
    }
  };

  if (overview.error) return <ErrorBanner error={overview.error} />;
  if (!overview.data) return <Loading />;
  const { projects } = overview.data;

  return (
    <>
      <div class="title-row">
        <h1>Projects</h1>
        <button type="button" onClick={syncAll}>
          Sync all projects
        </button>
      </div>
      <ErrorBanner error={error} />
      {message && <p class="notice">{message}</p>}
      {projects.length === 0 ? (
        <p class="muted">No projects yet. Run `shelf init` inside a project.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Project</th>
              <th>Skills</th>
              <th>Due soon</th>
              <th>Overdue</th>
              <th>Last seen</th>
              <th>Path</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.id}>
                <td>
                  <a href={`#/projects/${project.id}`}>{project.name}</a>
                </td>
                <td>{project.loans}</td>
                <td class={project.dueSoon > 0 ? "warn" : ""}>{project.dueSoon}</td>
                <td class={project.overdue > 0 ? "danger" : ""}>{project.overdue}</td>
                <td>{formatDateTime(project.lastSeenAt)}</td>
                <td class="path">
                  {project.path}
                  {!project.exists && <span class="danger"> (missing)</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
