/**
 * Public API of @shelf/core. The CLI and the dashboard depend only on this module;
 * anything not exported here is an implementation detail.
 */
export { type Clock, systemClock } from "./clock.ts";
export { type Config, ConfigSchema } from "./config.ts";
export { parseDays, parsePositiveInt } from "./domain/due.ts";
export type * from "./domain/types.ts";
export { type ErrorCode, ShelfError } from "./errors.ts";
export { shortHash } from "./library/hash.ts";
export { findHarness, HARNESSES, type Harness } from "./projection/harnesses.ts";
export { LOCKFILE_PATH } from "./projection/lockfile.ts";
export type { Finding, Severity } from "./security/audit.ts";
export type { Action } from "./services/actions.ts";
export { activity } from "./services/activity.ts";
export { type AdoptOptions, type AdoptResult, adopt } from "./services/adopt.ts";
export {
  type AttentionItem,
  type AttentionReason,
  listAttention,
} from "./services/attention.ts";
export { audit, type SkillAudit } from "./services/audit.ts";
export {
  type Context,
  type ContextOptions,
  closeContext,
  createContext,
  withCwd,
} from "./services/context.ts";
export { type DiffResult, diffSkill, type FileDiff } from "./services/diff.ts";
export { type DoctorCheck, doctor } from "./services/doctor.ts";
export { type SkillHistory, skillHistory } from "./services/history.ts";
export type { HookChange, HookHarness } from "./services/hooks.ts";
export {
  type AddResult,
  addSkill,
  type ImportOptions,
  type ImportStatus,
  type PullResult,
  pullSkill,
} from "./services/import.ts";
export type { LoanReport } from "./services/inspect.ts";
export {
  type CatalogEntry,
  catalog,
  createSkill,
  refreshLibrary,
  type SkillDetail,
  saveSkillContent,
  showSkill,
} from "./services/library.ts";
export {
  type BorrowResult,
  borrow,
  type DueChange,
  detach,
  type PromoteResult,
  promote,
  renew,
  returnSkill,
  setDue,
  type UpdateResult,
  update,
} from "./services/loans.ts";
export { listProjectOverviews, type ProjectOverview } from "./services/overview.ts";
export { initProject, requireRegisteredProject } from "./services/project.ts";
export { type PropagateResult, type PropagationStatus, propagate } from "./services/propagate.ts";
export { type ScanGroup, type ScanReport, scan } from "./services/scan.ts";
export { sessionNotice } from "./services/session.ts";
export { type SetupOptions, type SetupResult, setup } from "./services/setup.ts";
export {
  type ProjectReport,
  projectReport,
  type StatusReport,
  type SweepReport,
  type SyncReport,
  status,
  sweep,
  sync,
} from "./services/status.ts";
export {
  changeTargets,
  describeTargets,
  type TargetsChange,
  type TargetsReport,
} from "./services/targets.ts";
export {
  type HookPayload,
  mayUseSkill,
  recordUseFromHook,
  type UseResult,
  used,
} from "./services/usage.ts";
export type { EventRecord } from "./store/events.ts";
