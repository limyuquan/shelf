/**
 * Public API of @shelf/core. The CLI and the dashboard depend only on this module;
 * anything not exported here is an implementation detail.
 */
export { type Clock, systemClock } from "./clock.ts";
export { type Config, ConfigSchema } from "./config.ts";
export { parseDays } from "./domain/due.ts";
export type * from "./domain/types.ts";
export { type ErrorCode, ShelfError } from "./errors.ts";
export { shortHash } from "./library/hash.ts";
export { HARNESSES, type Harness } from "./projection/harnesses.ts";
export { LOCKFILE_PATH } from "./projection/lockfile.ts";
export type { Action } from "./services/actions.ts";
export {
  type Context,
  type ContextOptions,
  closeContext,
  createContext,
} from "./services/context.ts";
export type { LoanReport } from "./services/inspect.ts";
export {
  type CatalogEntry,
  catalog,
  createSkill,
  refreshLibrary,
  type SkillDetail,
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
export { initProject } from "./services/project.ts";
export { type SetupResult, setup } from "./services/setup.ts";
export { type StatusReport, type SyncReport, status, sync } from "./services/status.ts";
