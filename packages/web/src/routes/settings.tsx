import { useSuspenseQuery } from "@tanstack/react-query";
import { createRoute } from "@tanstack/react-router";
import { CircleAlert, CircleCheck, Wrench } from "lucide-react";
import type { ReactNode } from "react";
import { rootRoute } from "../app/root-route.tsx";
import { PageBody, PageHeader } from "../components/layout/page.tsx";
import { Button } from "../components/ui/button.tsx";
import { StatusPill } from "../components/ui/status.tsx";
import { HOOK_STATUS } from "../features/system/hook-label.ts";
import { systemQuery, useRepair } from "../features/system/queries.ts";
import { shortPath } from "../lib/format.ts";

export const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  loader: ({ context }) => context.queryClient.ensureQueryData(systemQuery()),
  component: SettingsPage,
});

/** Readable names for `shelf doctor`'s checks. */
const CHECKS: Record<string, string> = {
  library: "Library skills",
  "bundled-skill": "Bundled shelf skill",
  hooks: "Agent hooks",
  projects: "Registered projects",
  staging: "Interrupted writes",
  revisions: "Borrowed revisions",
  objects: "Object store",
};

const CONFIG_HELP: Record<string, string> = {
  loanDays: "Loan length, and how far a use or renewal moves the due date",
  maxLoanDays: "Due dates can't be set further out than this",
  dueSoonDays: "When a loan counts as due soon",
  allowAgentImports: "Agents may import skills from remote sources",
  hooks: "Install harness hooks with `shelf setup`",
  mode: "copy: a copy per directory · link: one copy, symlinks elsewhere",
  targets: "Where borrowed skills are written",
};

function SettingsPage() {
  const { data: system } = useSuspenseQuery(systemQuery());
  const repair = useRepair();
  const problems = system.checks.filter((check) => check.status === "warn").length;

  return (
    <>
      <PageHeader crumbs={[{ label: "Settings" }]} />
      <PageBody>
        <div className="mx-auto flex max-w-[760px] flex-col gap-10 px-4 py-6 md:px-8 md:py-8">
          <Group title="shelf" description={`Version ${system.version}`}>
            <Row label="Home">
              <Mono>{shortPath(system.home)}</Mono>
            </Row>
            <Row label="Library">
              <Mono>{shortPath(system.library)}</Mono>
            </Row>
          </Group>

          <Group
            title="Agent hooks"
            description="Hooks renew skills when agents use them and report loans that need attention at the start of a session."
          >
            {system.hooks.map((hook) => {
              const status = HOOK_STATUS[hook.status];
              return (
                <Row key={hook.harness} label={hook.label}>
                  <div className="flex flex-col items-start gap-1 sm:items-end">
                    <StatusPill tone={status.tone}>{status.label}</StatusPill>
                    {hook.status === "installed" && hook.needsTrust && (
                      <span className="text-[12px] text-fg-subtle">
                        Trust them once with /hooks in Codex
                      </span>
                    )}
                    {hook.status !== "installed" && status.help && (
                      <span className="text-[12px] text-fg-subtle">{status.help}</span>
                    )}
                  </div>
                </Row>
              );
            })}
          </Group>

          <Group
            title="Health"
            description={
              problems === 0 ? "Everything checks out." : `${problems} check(s) found problems.`
            }
            action={
              problems > 0 && (
                <Button
                  variant="primary"
                  onClick={() => repair.mutate()}
                  disabled={repair.isPending}
                >
                  <Wrench />
                  Repair
                </Button>
              )
            }
          >
            {system.checks.map((check) => (
              <div key={check.id} className="border-border-subtle border-b py-3 last:border-0">
                <div className="flex items-center gap-2.5 text-[13px]">
                  {check.status === "ok" ? (
                    <CircleCheck className="size-4 text-green" />
                  ) : (
                    <CircleAlert className="size-4 text-yellow" />
                  )}
                  <span className="text-fg">{CHECKS[check.id] ?? check.id}</span>
                  <span className="text-fg-muted">{check.message}</span>
                </div>
                {check.problems.length > 0 && (
                  <ul className="mt-1.5 ml-6.5 flex flex-col gap-1 text-[12.5px] text-fg-muted">
                    {check.problems.map((problem) => (
                      <li key={problem}>{problem}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </Group>

          <Group
            title="Configuration"
            description={
              <>
                Edit <Mono>{shortPath(`${system.home}/config.json`)}</Mono> to change these.
              </>
            }
          >
            {Object.entries(system.config).map(([key, value]) => (
              <Row key={key} label={key} help={CONFIG_HELP[key]}>
                <Mono>{Array.isArray(value) ? value.join(", ") : String(value)}</Mono>
              </Row>
            ))}
          </Group>
        </div>
      </PageBody>
    </>
  );
}

function Group({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-semibold text-[15px] text-fg">{title}</h2>
          {description && <p className="mt-1 text-[13px] text-fg-muted">{description}</p>}
        </div>
        {action}
      </div>
      <div className="rounded-lg border border-border bg-surface-raised px-4">{children}</div>
    </section>
  );
}

function Row({
  label,
  help,
  children,
}: {
  label: string;
  help?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-12 flex-col gap-1.5 border-border-subtle border-b py-2.5 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div>
        <div className="text-[13px] text-fg">{label}</div>
        {help && <div className="text-[12px] text-fg-subtle">{help}</div>}
      </div>
      <div className="min-w-0 break-all sm:text-right">{children}</div>
    </div>
  );
}

function Mono({ children }: { children: ReactNode }) {
  return <code className="font-mono text-[12px] text-fg-muted">{children}</code>;
}
