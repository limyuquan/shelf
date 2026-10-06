import { Fragment } from "react";

/** A path that wraps after slashes rather than mid-name on narrow screens. */
export function PathText({ path }: { path: string }) {
  return path.split("/").map((part, index, parts) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: segments of one static string
    <Fragment key={index}>
      {part}
      {index < parts.length - 1 && (
        <>
          /<wbr />
        </>
      )}
    </Fragment>
  ));
}
