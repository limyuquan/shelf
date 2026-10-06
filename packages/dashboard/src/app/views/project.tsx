import { useState } from "preact/hooks";
import type { Json, OverviewData, ProjectPageData } from "../../contract.ts";
import { ApiError, api, useApi } from "../api.ts";
import {
  Badge,
  daysLeftLabel,
  ErrorBanner,
  formatDate,
  Loading,
  Section,
  shortHash,
} from "../components.tsx";
import { ActivityTable } from "./activity.tsx";

type Loan = Json<ProjectPageData>["report"]["loans"][number];

export function ProjectView({ id }: { id: string }) {
  const page = useApi<ProjectPageData>(`/api/projects/${encodeURIComponent(id)}`);
  const overview = useApi<OverviewData>("/api/overview");
  const [error, setError] = useState<ApiError | null>(null);
  const [toBorrow, setToBorrow] = useState("");

  const post = (path: string, body: Record<string, unknown> = {}) =>
    api("POST", `/api/projects/${encodeURIComponent(id)}${path}`, body);
  const loanPath = (loan: Loan, action: string) =>
    `/loans/${encodeURIComponent(loan.skill)}/${action}`;

  /** Runs a mutation, then reloads; failures are shown in the banner. */
  const run = async (path: string, body: Record<string, unknown> = {}) => {
    try {
      await post(path, body);
      setError(null);
      page.reload();
      return true;
    } catch (failure) {
      setError(failure as ApiError);
      return false;
    }
  };

  const loanAction = (loan: Loan, action: string, body: Record<string, unknown> = {}) =>
    run(loanPath(loan, action), body);

  const renew = (loan: Loan) => {
    const reason = prompt(`Why renew ${loan.skill}? (optional)`);
    if (reason !== null) void loanAction(loan, "renew", reason ? { reason } : {});
  };

  const returnSkill = async (loan: Loan) => {
    if (!confirm(`Return ${loan.skill}? Its copies will be removed from this project.`)) return;
    try {
      await post(loanPath(loan, "return"));
      setError(null);
      page.reload();
    } catch (failure) {
      const local = failure instanceof ApiError && failure.code === "LOCAL_CHANGES";
      if (local && confirm(`${loan.skill} has local edits. Discard them and return it anyway?`)) {
        await loanAction(loan, "return", { force: true });
      } else {
        setError(failure as ApiError);
      }
    }
  };

  if (page.error) return <ErrorBanner error={page.error} />;
  if (!page.data) return <Loading />;
  const { report, events } = page.data;
  const borrowed = new Set(report.loans.map((loan) => loan.skill));
  const available = (overview.data?.skills ?? []).filter((skill) => !borrowed.has(skill.name));

  return (
    <>
      <p class="crumbs">
        <a href="#/">Projects</a> /
      </p>
      <h1>{report.project.name}</h1>
      <p class="path muted">{report.project.path}</p>
      <ErrorBanner error={error} />

      {report.actions.length > 0 && (
        <Section title="Next steps">
          <ul class="actions">
            {report.actions.map((action) => (
              <li key={action.command}>
                <code>{action.command}</code>
                <div class="muted">{action.reason}</div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Borrowed skills">
        {report.loans.length === 0 ? (
          <p class="muted">No skills borrowed.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Skill</th>
                <th>Content</th>
                <th>Due</th>
                <th>Due date</th>
                <th>Revision</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {report.loans.map((loan) => (
                <tr key={loan.skill}>
                  <td>
                    <a href={`#/library/${loan.skill}`}>{loan.skill}</a>
                    {loan.policy === "follow" && <span class="muted"> (follow)</span>}
                  </td>
                  <td>
                    <Badge value={loan.content} />
                  </td>
                  <td>
                    <Badge value={loan.due} />{" "}
                    <span class="muted">{daysLeftLabel(loan.daysLeft)}</span>
                  </td>
                  <td>
                    <input
                      type="date"
                      value={formatDate(loan.dueAt)}
                      onChange={(event) =>
                        void loanAction(loan, "due", { when: event.currentTarget.value })
                      }
                    />
                  </td>
                  <td>
                    <code>{shortHash(loan.revision)}</code>
                  </td>
                  <td class="buttons">
                    <button type="button" onClick={() => renew(loan)}>
                      Renew
                    </button>
                    {loan.content === "behind" && (
                      <button type="button" onClick={() => void loanAction(loan, "update")}>
                        Update
                      </button>
                    )}
                    <button type="button" class="secondary" onClick={() => void returnSkill(loan)}>
                      Return
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {available.length > 0 && (
          <form
            class="inline-form"
            onSubmit={async (event) => {
              event.preventDefault();
              if (toBorrow && (await run("/borrow", { skills: [toBorrow] }))) setToBorrow("");
            }}
          >
            <select value={toBorrow} onChange={(event) => setToBorrow(event.currentTarget.value)}>
              <option value="">Borrow a skill…</option>
              {available.map((skill) => (
                <option key={skill.name} value={skill.name}>
                  {skill.name}
                </option>
              ))}
            </select>
            <button type="submit" disabled={!toBorrow}>
              Borrow
            </button>
          </form>
        )}
      </Section>

      <Section title="Recent activity">
        <ActivityTable events={events} showProject={false} />
      </Section>
    </>
  );
}
