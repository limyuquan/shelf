import { zValidator } from "@hono/zod-validator";
import type { ValidationTargets } from "hono";
import { z } from "zod";
import { errorBody } from "./errors.ts";

/**
 * Validates part of a request against a zod schema. Failures use the same error
 * envelope as every other error, with the CLI's `INVALID_ARGUMENT` code.
 */
export function validate<Target extends keyof ValidationTargets, Schema extends z.ZodType>(
  target: Target,
  schema: Schema,
) {
  return zValidator(target, schema, (result, c) => {
    if (!result.success) {
      return c.json(errorBody("INVALID_ARGUMENT", z.prettifyError(result.error)), 400);
    }
  });
}
