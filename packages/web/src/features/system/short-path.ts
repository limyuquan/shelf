import { useQuery } from "@tanstack/react-query";
import { shortPath } from "../../lib/format.ts";
import { systemQuery } from "./queries.ts";

/** `shortPath` with the user's home directory, so paths read `~/code/app`. */
export function useShortPath(): (path: string) => string {
  const userHome = useQuery(systemQuery()).data?.userHome;
  return (path) => shortPath(path, userHome);
}
