import { z } from "zod";

/**
 * Request schemas: the inputs half of the API contract. Responses are typed by
 * the core services' return types, so there is no second copy of them here.
 */

export const projectParams = z.object({ id: z.string().min(1) });
export const loanParams = z.object({ id: z.string().min(1), skill: z.string().min(1) });
export const skillParams = z.object({ name: z.string().min(1) });

const days = z.number().int().positive();

export const borrowBody = z.object({
  skills: z.array(z.string().min(1)).min(1),
  days: days.optional(),
});

export const renewBody = z.object({ days: days.optional(), reason: z.string().optional() });
export const dueBody = z.object({ when: z.string().min(1), reason: z.string().optional() });
export const forceBody = z.object({ force: z.boolean().optional() });
export const promoteBody = z.object({
  force: z.boolean().optional(),
  /** Also update every other project borrowing the skill. */
  propagate: z.boolean().optional(),
});
export const pullBody = z.object({ yes: z.boolean().optional(), force: z.boolean().optional() });

export const saveSkillBody = z.object({ content: z.string() });
export const fileQuery = z.object({ path: z.string().min(1) });
export const saveFileBody = z.object({ path: z.string().min(1), content: z.string() });
export const propagateBody = z.object({ projects: z.array(z.string()).optional() });

export const catalogQuery = z.object({ q: z.string().optional() });
export const diffQuery = z.object({ from: z.string().optional(), to: z.string().optional() });

export const activityQuery = z.object({
  limit: z.coerce.number().int().positive().max(1000).optional(),
  project: z.string().optional(),
  skill: z.string().optional(),
});

/** Drops undefined values, for core option bags under `exactOptionalPropertyTypes`. */
export function defined<T extends object>(value: T): { [K in keyof T]?: Exclude<T[K], undefined> } {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as {
    [K in keyof T]?: Exclude<T[K], undefined>;
  };
}
