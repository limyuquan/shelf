import type { InferResponseType } from "hono/client";
import type { api } from "./client.ts";

/**
 * Response types, derived from the server contract rather than redeclared, so
 * they can never drift. Dates arrive as ISO strings.
 */
export type AttentionItem = InferResponseType<typeof api.attention.$get, 200>[number];
export type AttentionReason = AttentionItem["reasons"][number];
export type ProjectOverview = InferResponseType<typeof api.projects.$get, 200>[number];
export type ProjectPage = InferResponseType<(typeof api.projects)[":id"]["$get"], 200>;
export type Loan = ProjectPage["report"]["loans"][number];
export type ContentState = Loan["content"];
export type DueState = Loan["due"];
export type Suggestion = InferResponseType<
  (typeof api.projects)[":id"]["suggestions"]["$get"],
  200
>[number];
export type CatalogEntry = InferResponseType<typeof api.skills.$get, 200>[number];
export type SkillPage = InferResponseType<(typeof api.skills)[":name"]["$get"], 200>;
export type ActivityEvent = InferResponseType<typeof api.activity.$get, 200>[number];
export type LoanDiff = InferResponseType<
  (typeof api.projects)[":id"]["loans"][":skill"]["diff"]["$get"],
  200
>;
export type FileDiff = LoanDiff["files"][number];
export type PromoteResult = InferResponseType<
  (typeof api.projects)[":id"]["loans"][":skill"]["promote"]["$post"],
  200
>;
export type PullResult = InferResponseType<(typeof api.skills)[":name"]["pull"]["$post"], 200>;
export type Finding = PullResult["findings"][number];
export type LibraryFile = InferResponseType<(typeof api.skills)[":name"]["file"]["$get"], 200>;
export type Insights = InferResponseType<typeof api.insights.$get, 200>;
export type SkillInsight = Insights["skills"][number];
export type ProjectInsight = Insights["projects"][number];
export type GlobalSkill = Insights["globalSkills"][number];
export type Revision = InferResponseType<
  (typeof api.skills)[":name"]["revisions"][":revision"]["$get"],
  200
>;
export type ScanResponse = InferResponseType<typeof api.scan.$get, 200>;
export type ScanGroup = ScanResponse["report"]["groups"][number];
export type ScanVariant = ScanGroup["variants"][number];
export type FoundCopy = ScanVariant["copies"][number];
export type AdoptResult = InferResponseType<typeof api.adopt.$post, 200>[number];
export type SystemReport = InferResponseType<typeof api.system.$get, 200>;
export type HookStatus = SystemReport["hooks"][number];
export type DoctorCheck = SystemReport["checks"][number];
