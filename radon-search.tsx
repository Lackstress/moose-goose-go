import { GameList } from "../components/GameList";
import { games } from "../util/games";
import { filterSearch } from "../util/filterSearch";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "motion/react";

export const Route = createFileRoute("/search")({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      q: (search.q as string) || ""
    };
  }
});

function RouteComponent() {
  const { q } = Route.useSearch();
  const searchResults = q ? filterSearch(q, games) : games;

  return (
    <motion.main
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="px-8 md:px-16 lg:px-32 xl:px-48"
    >
      <GameList 
        title={q ? `Search Results for "${q}"` : "All Games"} 
        games={searchResults} 
      />
      {q && searchResults.length === 0 && (
        <p className="mt-5 text-center text-lg">
          No games found for "{q}". Try a different search term.
        </p>
      )}
    </motion.main>
  );
}
