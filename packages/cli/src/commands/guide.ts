import { defineCommand } from "citty";
import guide from "../guide.md" with { type: "text" };
import { SCHEMA_VERSION } from "../output.ts";

/** Static text: needs no shelf home, database or project, so it never fails. */
export const guideCommand = defineCommand({
  meta: { name: "guide", description: "Print the full guide for agents" },
  args: { json: { type: "boolean", description: "Print as a JSON envelope" } },
  run({ args }) {
    console.log(
      args.json
        ? JSON.stringify({ schemaVersion: SCHEMA_VERSION, ok: true, data: { guide } })
        : guide,
    );
  },
});
