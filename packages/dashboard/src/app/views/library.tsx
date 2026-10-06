import type { OverviewData } from "../../contract.ts";
import { useApi } from "../api.ts";
import { ErrorBanner, Loading } from "../components.tsx";

export function LibraryView() {
  const overview = useApi<OverviewData>("/api/overview");
  if (overview.error) return <ErrorBanner error={overview.error} />;
  if (!overview.data) return <Loading />;
  const { skills } = overview.data;

  return (
    <>
      <h1>Library</h1>
      {skills.length === 0 ? (
        <p class="muted">The library is empty. Create a skill with `shelf new`.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Skill</th>
              <th>Description</th>
              <th>Tokens</th>
              <th>Revisions</th>
            </tr>
          </thead>
          <tbody>
            {skills.map((skill) => (
              <tr key={skill.name}>
                <td>
                  <a href={`#/library/${skill.name}`}>{skill.name}</a>
                </td>
                <td>{skill.description}</td>
                <td>~{skill.tokens}</td>
                <td>{skill.revisions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
