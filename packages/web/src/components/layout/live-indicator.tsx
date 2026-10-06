import { useLiveStatus } from "../../api/live.ts";
import { StatusDot } from "../ui/status.tsx";
import { Tooltip } from "../ui/tooltip.tsx";

const LABEL = {
  live: "Live",
  connecting: "Connecting…",
  reconnecting: "Reconnecting…",
} as const;

const DETAIL = {
  live: "Live: updates as agents work",
  connecting: "Connecting to live updates…",
  reconnecting: "Reconnecting to live updates…",
} as const;

/**
 * A dot showing whether live updates are arriving. Screen readers hear it as a
 * status; touch screens, which can't hover for the tooltip, also get the word.
 */
export function LiveIndicator() {
  const status = useLiveStatus();
  return (
    <Tooltip label={DETAIL[status]} side="top">
      <span
        role="status"
        aria-label={DETAIL[status]}
        className="flex size-7 items-center justify-center gap-1.5 rounded-md text-[12px] text-fg-subtle pointer-coarse:size-auto pointer-coarse:h-10 pointer-coarse:px-2"
      >
        <StatusDot tone={status === "live" ? "green" : "neutral"} />
        <span className="hidden pointer-coarse:inline">{LABEL[status]}</span>
      </span>
    </Tooltip>
  );
}
