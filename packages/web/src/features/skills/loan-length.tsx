import { useQuery } from "@tanstack/react-query";
import { ChevronsUpDown } from "lucide-react";
import type { SkillPage } from "../../api/types.ts";
import { Menu, MenuRadioGroup } from "../../components/ui/menu.tsx";
import { systemQuery } from "../system/queries.ts";
import { useSetLoanDays } from "./queries.ts";

const CHOICES = [7, 14, 30, 60, 90];
const DEFAULT = "default";

const days = (n: number) => `${n} day${n === 1 ? "" : "s"}`;

/**
 * How long this skill's loans last on this machine, and how far a use or renewal
 * moves their due date: the config's `loanDays` or a length of its own.
 */
export function LoanLength({ detail }: { detail: SkillPage["detail"] }) {
  // The settings query carries the config; until it arrives, the server still
  // refuses anything beyond the limit.
  const config = useQuery(systemQuery()).data?.config;
  const setLoanDays = useSetLoanDays(detail.name);
  const custom = detail.customLoanDays;
  const fallback = custom === null ? detail.loanDays : config?.loanDays;
  const defaultLabel = fallback === undefined ? "Default" : `Default (${days(fallback)})`;
  const choices = CHOICES.filter((n) => n <= (config?.maxLoanDays ?? Number.POSITIVE_INFINITY));
  // A length set from the CLI may not be one of the choices; still show it.
  if (custom !== null && !choices.includes(custom)) choices.push(custom);

  return (
    <Menu
      align="start"
      trigger={
        <button
          type="button"
          aria-label={`Loan length: ${custom === null ? defaultLabel : days(custom)}`}
          className="-ml-1.5 flex h-7 max-w-full items-center gap-1 rounded-md px-1.5 text-fg transition-colors hover:bg-surface-hover disabled:opacity-45 pointer-coarse:h-9"
          disabled={setLoanDays.isPending}
        >
          <span className="truncate">{custom === null ? defaultLabel : days(custom)}</span>
          <ChevronsUpDown className="size-3 shrink-0 text-fg-subtle" />
        </button>
      }
    >
      <MenuRadioGroup
        closeOnClick
        value={custom === null ? DEFAULT : String(custom)}
        onChange={(value) => setLoanDays.mutate(value === DEFAULT ? null : Number(value))}
        options={[
          { value: DEFAULT, label: defaultLabel },
          ...choices.sort((a, b) => a - b).map((n) => ({ value: String(n), label: days(n) })),
        ]}
      />
    </Menu>
  );
}
