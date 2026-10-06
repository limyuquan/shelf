import type { Context, SystemOptions } from "@shelf/core";

/** Request-scoped values available to every route through `c.get(…)`. */
export interface AppEnv {
  Variables: {
    /** The shelf context the server was started with (one per process). */
    ctx: Context;
    /** What the running binary provides: its version, bundled skill, hook command. */
    system: SystemOptions;
  };
}
