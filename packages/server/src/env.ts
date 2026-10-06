import type { Context } from "@shelf/core";

/** Request-scoped values available to every route through `c.get(…)`. */
export interface AppEnv {
  Variables: {
    /** The shelf context the server was started with (one per process). */
    ctx: Context;
  };
}
