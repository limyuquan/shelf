import type { HookStatus } from "../../api/types.ts";
import type { Tone } from "../../components/ui/status.tsx";

export const HOOK_STATUS: Record<
  HookStatus["status"],
  { label: string; tone: Tone; help: string }
> = {
  installed: {
    label: "Installed",
    tone: "green",
    help: "Skills renew when used; loans needing attention are reported at session start.",
  },
  missing: {
    label: "Not installed",
    tone: "yellow",
    help: "Loans only renew when an agent runs `shelf renew`.",
  },
  outdated: {
    label: "Outdated",
    tone: "yellow",
    help: "The hooks point at another shelf binary.",
  },
  invalid: {
    label: "Settings unreadable",
    tone: "red",
    help: "The settings file is not valid JSON; shelf leaves it alone.",
  },
  absent: { label: "Not installed on this machine", tone: "neutral", help: "" },
};

/** Harnesses on this machine whose hooks need attention. */
export function brokenHooks(hooks: readonly HookStatus[]): HookStatus[] {
  return hooks.filter((hook) => hook.status !== "installed" && hook.status !== "absent");
}
