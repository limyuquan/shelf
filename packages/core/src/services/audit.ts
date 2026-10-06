import { librarySkillPath } from "../library/library.ts";
import { auditDirectory, type Finding } from "../security/audit.ts";
import { listSkills } from "../store/skills.ts";
import type { Context } from "./context.ts";
import { refreshLibrary, requireSkill } from "./library.ts";

export interface SkillAudit {
  readonly skill: string;
  readonly findings: Finding[];
}

/** Scans library skills (all, or the named ones) for risky content. */
export async function audit(ctx: Context, names: readonly string[] = []): Promise<SkillAudit[]> {
  await refreshLibrary(ctx);
  const skills =
    names.length > 0 ? names.map((name) => requireSkill(ctx, name)) : listSkills(ctx.db);
  const results: SkillAudit[] = [];
  for (const skill of skills) {
    results.push({
      skill: skill.name,
      findings: await auditDirectory(librarySkillPath(ctx.paths, skill.name)),
    });
  }
  return results;
}
