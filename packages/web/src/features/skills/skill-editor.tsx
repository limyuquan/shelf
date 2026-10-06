import { markdown } from "@codemirror/lang-markdown";
import { yamlFrontmatter } from "@codemirror/lang-yaml";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { basicSetup, EditorView } from "codemirror";
import { useEffect, useRef } from "react";

/** Editor chrome drawn from the design tokens, so it follows the app theme. */
const theme = EditorView.theme({
  "&": { backgroundColor: "transparent", color: "var(--fg)", fontSize: "13px" },
  ".cm-content": {
    fontFamily: "var(--font-mono)",
    padding: "14px 0",
    caretColor: "var(--accent)",
  },
  ".cm-line": { padding: "0 18px 0 6px", lineHeight: "1.7" },
  ".cm-gutters": {
    backgroundColor: "transparent",
    color: "var(--fg-subtle)",
    border: "none",
    paddingLeft: "8px",
  },
  ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "var(--surface-hover)" },
  ".cm-cursor": { borderLeftColor: "var(--accent)" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
    backgroundColor: "var(--accent-soft) !important",
  },
  ".cm-foldGutter span": { color: "var(--fg-subtle)" },
  "&.cm-focused": { outline: "none" },
});

const highlight = HighlightStyle.define([
  { tag: tags.heading, color: "var(--fg)", fontWeight: "600" },
  { tag: tags.strong, fontWeight: "600" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: [tags.link, tags.url], color: "var(--blue)" },
  { tag: tags.monospace, color: "var(--violet)" },
  { tag: [tags.propertyName, tags.definition(tags.propertyName)], color: "var(--accent)" },
  { tag: [tags.string, tags.content], color: "var(--fg)" },
  { tag: [tags.meta, tags.processingInstruction, tags.punctuation], color: "var(--fg-subtle)" },
  { tag: tags.list, color: "var(--fg-muted)" },
  { tag: tags.quote, color: "var(--fg-muted)", fontStyle: "italic" },
]);

/**
 * CodeMirror editing the raw SKILL.md. It edits text byte for byte (unlike WYSIWYG
 * editors), so frontmatter and hashes are never altered behind the user.
 */
export function SkillEditor({
  value,
  onChange,
  onSave,
}: {
  value: string;
  onChange: (next: string) => void;
  onSave: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const callbacks = useRef({ onChange, onSave });
  callbacks.current = { onChange, onSave };

  // Created once; later `value` changes are applied by the effect below.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the editor owns its document after mount
  useEffect(() => {
    if (!host.current) return;
    view.current = new EditorView({
      parent: host.current,
      doc: value,
      extensions: [
        basicSetup,
        theme,
        syntaxHighlighting(highlight),
        yamlFrontmatter({ content: markdown() }),
        EditorView.lineWrapping,
        EditorView.domEventHandlers({
          keydown: (event) => {
            if (event.key === "s" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              callbacks.current.onSave();
              return true;
            }
            return false;
          },
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) callbacks.current.onChange(update.state.doc.toString());
        }),
      ],
    });
    return () => view.current?.destroy();
  }, []);

  // Adopt external changes (after saving or a refetch) without recreating the editor.
  useEffect(() => {
    const editor = view.current;
    if (editor && editor.state.doc.toString() !== value) {
      editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value } });
    }
  }, [value]);

  return <div ref={host} className="min-h-[420px]" />;
}
