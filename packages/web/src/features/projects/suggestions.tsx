import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import type { Suggestion } from "../../api/types.ts";
import { Section } from "../../components/layout/page.tsx";
import { Button } from "../../components/ui/button.tsx";
import { useBorrow } from "../loans/mutations.ts";
import { projectSuggestionsQuery } from "./queries.ts";

/**
 * Library skills that match what the project uses (its dependencies and files),
 * each borrowable in one click. Loads after the page and stays hidden when there
 * is nothing to suggest, so it never delays or clutters the loans above it.
 */
export function ProjectSuggestions({ projectId }: { projectId: string }) {
  const { data: suggestions = [] } = useQuery(projectSuggestionsQuery(projectId));
  const borrow = useBorrow();
  if (suggestions.length === 0) return null;
  return (
    <Section title="Suggested for this project" count={suggestions.length}>
      {suggestions.map((suggestion) => (
        <SuggestionRow
          key={suggestion.skill}
          suggestion={suggestion}
          pending={borrow.isPending && borrow.variables.skills.includes(suggestion.skill)}
          onBorrow={() => borrow.mutate({ projectId, skills: [suggestion.skill] })}
        />
      ))}
    </Section>
  );
}

function SuggestionRow({
  suggestion,
  pending,
  onBorrow,
}: {
  suggestion: Suggestion;
  pending: boolean;
  onBorrow: () => void;
}) {
  // Not the catalog's SKILL.md size: only the name and description load every session.
  const cost = `~${suggestion.descriptionTokens.toLocaleString()} tok per session`;
  return (
    <div className="flex items-center gap-3 border-border-subtle border-b px-4 py-2.5 transition-colors hover:bg-surface-hover md:h-11 md:gap-4 md:px-5 md:py-0">
      {/* One line on wide screens; reasons and cost go under the name on phones. */}
      <div className="min-w-0 flex-1 md:flex md:items-center md:gap-4">
        <Link
          to="/library/$skillName"
          params={{ skillName: suggestion.skill }}
          className="block truncate font-medium text-fg hover:underline max-md:text-[14px] md:w-56 md:shrink-0"
        >
          {suggestion.skill}
        </Link>
        <p className="mt-0.5 line-clamp-2 text-[12px] text-fg-muted md:mt-0 md:min-w-0 md:flex-1 md:truncate">
          {suggestion.reasons.join(" · ")}
          <span className="text-fg-subtle md:hidden"> · {cost}</span>
        </p>
      </div>
      <span className="shrink-0 text-[12px] text-fg-subtle tabular-nums max-md:hidden">{cost}</span>
      <Button
        size="sm"
        onClick={onBorrow}
        disabled={pending}
        aria-label={`Borrow ${suggestion.skill}`}
      >
        <Plus />
        Borrow
      </Button>
    </div>
  );
}
