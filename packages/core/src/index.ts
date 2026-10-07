/**
 * Public API of @shelf/core. The CLI and the dashboard depend only on this module;
 * anything not exported here is an implementation detail.
 */
export { type Clock, systemClock } from "./clock.ts";
export { type Config, ConfigSchema } from "./config.ts";
export { parseDays, parsePositiveInt } from "./domain/due.ts";
export type * from "./domain/types.ts";
export { ERROR_MEANINGS, type ErrorCode, ShelfError } from "./errors.ts";
export { shortHash } from "./library/hash.ts";
export { type LintIssue, type LintResult, lintSkill } from "./library/lint.ts";
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
  type ArchiveResult,
  archiveLibrarySkill,
  duplicateSkill,
  lintLibrary,
  renameSkill,
  type SkillLint,
} from "./services/authoring.ts";
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
export {
  type GlobalSkill,
  type Insights,
  type InsightsHere,
  insights,
  insightsHere,
  type ProjectInsight,
  type SkillInsight,
} from "./services/insights.ts";
export type { LoanReport } from "./services/inspect.ts";
export {
  type CatalogEntry,
  catalog,
  createSkill,
  type LibraryFile,
  readLibraryFile,
  refreshLibrary,
  type SkillDetail,
  type SkillLoanDays,
  saveLibraryFile,
  saveSkillContent,
  setSkillLoanDays,
  showSkill,
  skillLoanDays,
} from "./services/library.ts";
export {
  type BorrowResult,
  borrow,
  type DueChange,
  detach,
  type KeepResult,
  keep,
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
export {
  type RevisionDetail,
  type RevisionFile,
  readRevisionFile,
  resolveRevision,
  restoreRevision,
  showRevision,
} from "./services/revisions.ts";
export {
  defaultScanRoot,
  type FoundCopy,
  type ScanGroup,
  type ScanReport,
  type ScanVariant,
  scan,
} from "./services/scan.ts";
export {
  type MatchRange,
  type SearchableSkill,
  type SearchMatch,
  type SearchOptions,
  type SearchResult,
  searchableSkills,
  searchLibrary,
  searchSkills,
} from "./services/search.ts";
export { sessionNotice } from "./services/session.ts";
export {
  deleteSet,
  listSets,
  resolveSkillRefs,
  type SkillSet,
  saveSet,
} from "./services/sets.ts";
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
  type ProjectSignal,
  type ProjectSuggestions,
  type Suggestion,
  type SuggestOptions,
  suggestHere,
  suggestSkills,
} from "./services/suggest.ts";
export {
  repairSystem,
  type SystemOptions,
  type SystemReport,
  systemReport,
} from "./services/system.ts";
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
