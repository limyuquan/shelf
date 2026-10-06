import type {
  CatalogEntry,
  DiffResult,
  EventRecord,
  ProjectOverview,
  ProjectReport,
  PropagateResult,
  SkillDetail,
  SkillHistory,
  SweepReport,
} from "@shelf/core";

/** Response bodies of the dashboard API, shared by the server and the browser app. */
export interface OverviewData {
  readonly projects: ProjectOverview[];
  readonly skills: CatalogEntry[];
}

export interface ProjectPageData {
  readonly report: ProjectReport;
  readonly events: EventRecord[];
}

export interface SkillPageData {
  readonly detail: SkillDetail;
  readonly history: SkillHistory;
  /** Dry run: what pushing the latest revision to each borrower would do. */
  readonly propagation: PropagateResult;
}

export interface ActivityData {
  readonly events: EventRecord[];
}

export type { DiffResult, PropagateResult, SweepReport as SweepResult };

/** A type as it arrives over JSON: Dates become ISO strings. */
export type Json<T> = T extends Date
  ? string
  : T extends readonly (infer Item)[]
    ? Json<Item>[]
    : T extends object
      ? { [K in keyof T]: Json<T[K]> }
      : T;
