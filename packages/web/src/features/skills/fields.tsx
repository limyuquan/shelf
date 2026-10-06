import { type ReactNode, useId } from "react";
import { ApiError } from "../../api/client.ts";
import { cn } from "../../lib/cn.ts";
import { normalizeNameInput } from "./names.ts";

const FIELD =
  "w-full rounded-md border bg-surface px-2.5 text-[13px] text-fg outline-none transition-colors placeholder:text-fg-subtle focus-visible:border-accent";

/** A labelled field with a line below for help, counts or a problem. */
function Field({
  label,
  note,
  problem,
  children,
}: {
  label: string;
  note?: ReactNode;
  problem?: string | null;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-medium text-[12.5px] text-fg">
        {label}
      </label>
      {children(id)}
      <p
        className={cn(
          "min-h-[18px] text-[12px] leading-[18px]",
          problem ? "text-red" : "text-fg-subtle",
        )}
        aria-live="polite"
      >
        {problem ?? note}
      </p>
    </div>
  );
}

/** A skill name input: lowercased and hyphenated as you type. */
export function NameField({
  value,
  onChange,
  problem,
  label = "Name",
  onSubmit,
}: {
  value: string;
  onChange: (value: string) => void;
  problem: string | null;
  label?: string;
  onSubmit?: () => void;
}) {
  return (
    <Field
      label={label}
      problem={problem}
      note="Lowercase letters, digits and hyphens, e.g. pdf-tools"
    >
      {(id) => (
        <input
          id={id}
          // biome-ignore lint/a11y/noAutofocus: only rendered in dialogs opened to type a name
          autoFocus
          value={value}
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="off"
          maxLength={80}
          onChange={(event) => onChange(normalizeNameInput(event.target.value))}
          onKeyDown={(event) => event.key === "Enter" && onSubmit?.()}
          aria-invalid={problem ? true : undefined}
          className={cn(
            FIELD,
            "h-9 font-mono pointer-coarse:h-11",
            problem ? "border-red" : "border-border",
          )}
        />
      )}
    </Field>
  );
}

/** A failed call's message and, from the server, the hint that resolves it. */
export function CallError({ error, children }: { error: Error; children?: ReactNode }) {
  return (
    <div className="rounded-md border border-red/30 bg-red/5 px-3 py-2.5 text-[13px]">
      <p className="text-red">{error.message}</p>
      {children}
      {error instanceof ApiError && error.hint && (
        <p className="mt-1.5 text-fg-muted">{error.hint}</p>
      )}
    </div>
  );
}

export function DescriptionField({
  value,
  onChange,
  note,
  problem,
}: {
  value: string;
  onChange: (value: string) => void;
  note: ReactNode;
  problem: string | null;
}) {
  return (
    <Field label="Description" note={note} problem={problem}>
      {(id) => (
        <textarea
          id={id}
          value={value}
          rows={3}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Use when … (agents decide whether to load the skill from this)"
          className={cn(
            FIELD,
            "resize-y py-2 leading-relaxed",
            problem ? "border-red" : "border-border",
          )}
        />
      )}
    </Field>
  );
}
