import type { Context, SystemOptions } from "@shelf/core";
import type { ChangeFeed } from "./changes.ts";

/** Request-scoped values available to every route through `c.get(…)`. */
export interface AppEnv {
  Variables: {
    /** The shelf context the server was started with (one per process). */
    ctx: Context;
    /** What the running binary provides: its version, bundled skill, hook command. */
    system: SystemOptions;
    /** Database and library changes from any process, for `/api/events`. */
    changes: ChangeFeed;
  };
}
