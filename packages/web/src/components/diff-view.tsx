import { FileText } from "lucide-react";
import type { FileDiff } from "../api/types.ts";
import { cn } from "../lib/cn.ts";

const LINE: Record<string, string> = {
  "+": "bg-green/10 text-green",
  "-": "bg-red/10 text-red",
  "@": "text-blue",
};

/** Unified diffs, one card per file, with added and removed lines tinted. */
export function DiffView({ files }: { files: readonly FileDiff[] }) {
  if (files.length === 0) {
    return <p className="py-8 text-center text-fg-muted">No differences.</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      {files.map((file) => (
        <div key={file.path} className="overflow-hidden rounded-lg border border-border">
          <div className="flex h-9 items-center gap-2 border-border border-b bg-surface-raised px-3 text-[12.5px]">
            <FileText className="size-3.5 text-fg-subtle" />
            <span className="font-medium text-fg">{file.path}</span>
            <span className="text-fg-subtle">{file.status}</span>
          </div>
          <pre className="overflow-x-auto py-1.5 font-mono text-[12px] leading-[1.6]">
            {file.patch
              .split("\n")
              .filter((line) => !line.startsWith("---") && !line.startsWith("+++"))
              .map((line, index) => (
                <div
                  // Lines of a patch have no identity beyond their position.
                  // biome-ignore lint/suspicious/noArrayIndexKey: static, never reordered
                  key={index}
                  className={cn("px-3", LINE[line[0] ?? ""] ?? "text-fg-muted")}
                >
                  {line || " "}
                </div>
              ))}
          </pre>
        </div>
      ))}
    </div>
  );
}
