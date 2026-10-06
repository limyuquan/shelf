import { setDefaultTimeout } from "bun:test";

// Tests create real SQLite databases, git repositories and processes. On a busy
// machine fsync alone can take seconds, which trips the 5 s default and makes
// slow runs look like failures.
setDefaultTimeout(60_000);
