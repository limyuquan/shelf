import { Link } from "@tanstack/react-router";
import { BookOpen, FileText, Search } from "lucide-react";
import type { SearchMatch, SearchResult } from "../../api/types.ts";
import { EmptyState } from "../../components/ui/empty-state.tsx";
import { cn } from "../../lib/cn.ts";
import { navigableRow, type useListNavigation } from "../../lib/hotkeys.ts";
import { highlightParts, matchLocation, matchSearch, type Range } from "./describe.ts";

type RowProps = ReturnType<typeof useListNavigation>["rowProps"];

/** Snippets shown per skill in the library list. */
const SNIPPETS = 2;

/** Text with its search hits marked. */
export function Highlighted({ text, ranges }: { text: string; ranges: readonly Range[] }) {
  return highlightParts(text, ranges).map((part, index) =>
    part.hit ? (
      // biome-ignore lint/suspicious/noArrayIndexKey: parts are positional and never reorder
      <mark key={index} className="rounded-[3px] bg-accent-soft px-px text-fg">
        {part.text}
      </mark>
    ) : (
      // biome-ignore lint/suspicious/noArrayIndexKey: parts are positional and never reorder
      <span key={index}>{part.text}</span>
    ),
  );
}

/** The library list while filtering: skills whose content matches, with where it matched. */
export function SearchResults({
  results,
  rowProps,
}: {
  results: readonly SearchResult[];
  rowProps: RowProps;
}) {
  if (results.length === 0) {
    return (
      <EmptyState icon={<Search />} title="No matching skills">
        No skill mentions all of those words. Try fewer, or quote a phrase: "error envelope".
      </EmptyState>
    );
  }
  return results.map((result, index) => (
    <div
      key={result.name}
      {...rowProps(index)}
      className={cn(
        "border-border-subtle border-b px-4 py-3 transition-colors hover:bg-surface-hover md:px-5",
        navigableRow,
      )}
    >
      <Link
        to="/library/$skillName"
        params={{ skillName: result.name }}
        className="flex items-start gap-4"
      >
        <BookOpen className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
        <div className="min-w-0 flex-1">
          <span className="font-medium text-fg">{result.name}</span>
          <p className="text-[12.5px] text-fg-muted max-md:line-clamp-2 md:truncate">
            {result.description}
          </p>
        </div>
      </Link>
      {result.matches.length > 0 && (
        <div className="mt-1.5 flex flex-col gap-1 pl-8">
          {result.matches.slice(0, SNIPPETS).map((match) => (
            <MatchLink key={`${match.file}:${match.line}`} skill={result.name} match={match} />
          ))}
        </div>
      )}
    </div>
  ));
}

/** One matching line; opens the skill on the file it is in. */
function MatchLink({ skill, match }: { skill: string; match: SearchMatch }) {
  const location = matchLocation(match);
  return (
    <Link
      to="/library/$skillName"
      params={{ skillName: skill }}
      search={matchSearch(match)}
      title={`${match.file}:${match.line}`}
      className="flex min-w-0 items-baseline gap-2 border-border border-l-2 py-0.5 pl-2.5 text-[12.5px] text-fg-muted transition-colors hover:border-accent hover:text-fg max-md:flex-col max-md:gap-0.5 pointer-coarse:py-1.5"
    >
      {location && (
        <span className="flex shrink-0 items-center gap-1 font-mono text-[11.5px] text-fg-subtle">
          <FileText className="size-3" />
          {location}
        </span>
      )}
      <span className="min-w-0 max-md:line-clamp-2 md:truncate">
        <Highlighted text={match.snippet} ranges={match.ranges} />
      </span>
    </Link>
  );
}
