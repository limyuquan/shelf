import { useEffect, useState } from "preact/hooks";
import type { DiffResult, PropagateResult, SkillPageData } from "../../contract.ts";
import { type ApiError, api, useApi } from "../api.ts";
import {
  DiffView,
  ErrorBanner,
  formatDate,
  formatDateTime,
  Loading,
  MarkdownEditor,
  Section,
  shortHash,
} from "../components.tsx";

const PROPAGATION_LABELS = {
  updated: "behind — can be updated",
  current: "up to date",
  "skipped-local-changes": "has local edits — not touched",
  "skipped-missing-project": "project directory missing",
} as const;

export function SkillView({ name }: { name: string }) {
  const path = `/api/skills/${encodeURIComponent(name)}`;
  const page = useApi<SkillPageData>(path);
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [diff, setDiff] = useState<{ revision: string; result: DiffResult } | null>(null);

  const saved = page.data?.detail.content ?? "";
  const dirty = draft !== null && draft !== saved;

  // Preselect every borrower that can be updated safely.
  useEffect(() => {
    const updatable = page.data?.propagation.projects.filter((p) => p.status === "updated") ?? [];
    setSelected(new Set(updatable.map((p) => p.path)));
  }, [page.data]);

  const save = async () => {
    if (draft === null) return;
    try {
      page.set(await api<SkillPageData>("PUT", path, { content: draft }));
      setDraft(null);
      setError(null);
      setNotice("Saved as a new revision.");
    } catch (failure) {
      setError(failure as ApiError);
    }
  };

  const propagateSelected = async () => {
    try {
      const result = await api<PropagateResult>("POST", `${path}/propagate`, {
        projects: [...selected],
      });
      const updated = result.projects.filter((p) => p.status === "updated").map((p) => p.project);
      setNotice(updated.length > 0 ? `Updated ${updated.join(", ")}.` : "Nothing to update.");
      setError(null);
      page.reload();
    } catch (failure) {
      setError(failure as ApiError);
    }
  };

  const showDiff = async (revision: string) => {
    try {
      const result = await api<DiffResult>(
        "GET",
        `${path}/diff?from=${encodeURIComponent(revision)}&to=library`,
      );
      setDiff({ revision, result });
    } catch (failure) {
      setError(failure as ApiError);
    }
  };

  if (page.error) return <ErrorBanner error={page.error} />;
  if (!page.data) return <Loading />;
  const { detail, history, propagation } = page.data;

  return (
    <>
      <p class="crumbs">
        <a href="#/library">Library</a> /
      </p>
      <h1>{detail.name}</h1>
      <p class="muted">
        Revision <code>{shortHash(detail.revision)}</code> · {detail.revisions} revisions · ~
        {detail.tokens} tokens · <span class="path">{detail.path}</span>
      </p>
      <ErrorBanner error={error} />
      {notice && <p class="notice">{notice}</p>}

      <Section title="SKILL.md">
        <MarkdownEditor value={draft ?? saved} onChange={setDraft} />
        <div class="buttons">
          <button type="button" disabled={!dirty} onClick={save}>
            Save
          </button>
          <button type="button" class="secondary" disabled={!dirty} onClick={() => setDraft(null)}>
            Discard changes
          </button>
          {detail.files.length > 1 && (
            <span class="muted">
              Other files: {detail.files.filter((f) => f !== "SKILL.md").join(", ")}
            </span>
          )}
        </div>
      </Section>

      <Section title="Borrowing projects">
        {propagation.projects.length === 0 ? (
          <p class="muted">No project borrows this skill.</p>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th />
                  <th>Project</th>
                  <th>State</th>
                </tr>
              </thead>
              <tbody>
                {propagation.projects.map((entry) => (
                  <tr key={entry.path}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Update ${entry.project}`}
                        disabled={entry.status !== "updated"}
                        checked={selected.has(entry.path)}
                        onChange={(event) => {
                          const next = new Set(selected);
                          if (event.currentTarget.checked) next.add(entry.path);
                          else next.delete(entry.path);
                          setSelected(next);
                        }}
                      />
                    </td>
                    <td>{entry.project}</td>
                    <td>{PROPAGATION_LABELS[entry.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button type="button" disabled={selected.size === 0} onClick={propagateSelected}>
              Update selected projects to {shortHash(propagation.revision)}
            </button>
          </>
        )}
      </Section>

      <Section title="Revisions">
        <table>
          <thead>
            <tr>
              <th>Revision</th>
              <th>Date</th>
              <th>Source</th>
              <th>Borrowed by</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {history.revisions.map((revision) => (
              <tr key={revision.hash}>
                <td>
                  <code>{shortHash(revision.hash)}</code>
                  {revision.latest && <span class="muted"> latest</span>}
                </td>
                <td title={formatDateTime(revision.createdAt)}>{formatDate(revision.createdAt)}</td>
                <td>{revision.source}</td>
                <td>{revision.borrowers.join(", ")}</td>
                <td>
                  {!revision.latest && (
                    <button type="button" class="secondary" onClick={() => showDiff(revision.hash)}>
                      Diff to latest
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {diff && (
          <>
            <h3>{shortHash(diff.revision)} → latest</h3>
            {diff.result.files.length === 0 ? (
              <p class="muted">No differences.</p>
            ) : (
              diff.result.files.map((file) => <DiffView key={file.path} patch={file.patch} />)
            )}
          </>
        )}
      </Section>
    </>
  );
}
