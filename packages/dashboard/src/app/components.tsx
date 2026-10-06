import { markdown } from "@codemirror/lang-markdown";
import { yamlFrontmatter } from "@codemirror/lang-yaml";
import { basicSetup, EditorView } from "codemirror";
import type { ComponentChildren } from "preact";
import { useEffect, useRef } from "preact/hooks";
import type { ApiError } from "./api.ts";

export function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function shortHash(hash: string): string {
  return hash.replace(/^sha256:/, "").slice(0, 10);
}

export function daysLeftLabel(days: number): string {
  if (days < 0) return `${-days}d overdue`;
  if (days === 0) return "due today";
  return `${days}d left`;
}

/** When an agent last used a borrowed skill (recorded by harness hooks). */
export function lastUsedLabel(iso: string | null): string {
  if (!iso) return "never";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return days <= 0 ? "today" : `${days}d ago`;
}

/** A state such as `current`, `behind` or `overdue`, coloured by its CSS class. */
export function Badge({ value }: { value: string }) {
  return <span class={`badge badge-${value}`}>{value}</span>;
}

export function ErrorBanner({ error }: { error: ApiError | Error | null }) {
  if (!error) return null;
  const hint = "hint" in error ? error.hint : null;
  return (
    <div class="error" role="alert">
      <strong>{error.message}</strong>
      {hint && <div class="hint">{hint}</div>}
    </div>
  );
}

export function Loading() {
  return <p class="muted">Loading…</p>;
}

export function Section({ title, children }: { title: string; children: ComponentChildren }) {
  return (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function diffLineClass(line: string): string {
  if (line.startsWith("@@")) return "hunk";
  if (line.startsWith("+")) return "add";
  if (line.startsWith("-")) return "del";
  return "";
}

/** Renders a unified diff with added and removed lines highlighted. */
export function DiffView({ patch }: { patch: string }) {
  return (
    <pre class="diff">
      {patch.split("\n").map((line, index) => (
        <div key={index} class={diffLineClass(line)}>
          {line || " "}
        </div>
      ))}
    </pre>
  );
}

/**
 * CodeMirror 6 editing the raw SKILL.md. It edits text byte for byte (unlike
 * WYSIWYG editors), so frontmatter and hashes are never altered behind the user.
 */
export function MarkdownEditor({
  value,
  onChange,
}: {
  value: string;
  onChange(next: string): void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Created once; later `value` changes are applied by the effect below.
  useEffect(() => {
    if (!host.current) return;
    view.current = new EditorView({
      parent: host.current,
      doc: value,
      extensions: [
        basicSetup,
        yamlFrontmatter({ content: markdown() }),
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChangeRef.current(update.state.doc.toString());
        }),
      ],
    });
    return () => view.current?.destroy();
  }, []);

  // Adopt external changes (e.g. after saving or reloading) without losing the editor.
  useEffect(() => {
    const editor = view.current;
    if (editor && editor.state.doc.toString() !== value) {
      editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value } });
    }
  }, [value]);

  return <div class="editor" ref={host} />;
}
