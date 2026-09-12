import { Search, X } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";

import type { Entity, SearchScope } from "../../types";
import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

interface GlobalSearchProps {
  entities: Entity[];
  query: string;
  scope: SearchScope;
  onQueryChange: (query: string) => void;
  onScopeChange: (scope: SearchScope) => void;
  onOpenEntity: (id: string) => void;
}

export function entityMatches(entity: Entity, query: string, scope: SearchScope) {
  if (scope !== "all" && entity.type !== scope) return false;
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return true;
  return [entity.title, entity.id, entity.summary, ...entity.aliases, ...entity.tags].filter(Boolean).join(" ").toLocaleLowerCase().includes(needle);
}

export function GlobalSearch({ entities, query, scope, onQueryChange, onScopeChange, onOpenEntity }: GlobalSearchProps) {
  const input = useRef<HTMLInputElement>(null);
  const results = useMemo(() => query.trim() ? entities.filter((entity) => entityMatches(entity, query, scope)).slice(0, 8) : [], [entities, query, scope]);

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      const target = event.target;
      if (event.key !== "/" || target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
      event.preventDefault();
      input.current?.focus();
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  return (
    <div className="relative flex min-w-0 flex-1 items-center gap-2">
      <label className="relative min-w-0 flex-1">
        <span className="sr-only">Search context</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={input}
          type="search"
          aria-label="Search context"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search people, ideas, and projects…"
          className="h-9 w-full rounded-lg border bg-background/80 pl-9 pr-9 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
        />
        {query && <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 size-9" aria-label="Clear search" onClick={() => onQueryChange("")}><X /></Button>}
      </label>
      <Select value={scope} onValueChange={(value) => onScopeChange(value as SearchScope)}>
        <SelectTrigger aria-label="Filter search scope" className="hidden w-36 sm:flex"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All context</SelectItem><SelectItem value="person">People</SelectItem><SelectItem value="project">Projects</SelectItem><SelectItem value="idea">Ideas</SelectItem><SelectItem value="experience">Experience</SelectItem><SelectItem value="domain">Domains</SelectItem><SelectItem value="draft">Drafts</SelectItem>
        </SelectContent>
      </Select>
      {query.trim() && (
        <div className="absolute left-0 right-0 top-11 z-40 max-h-96 overflow-auto rounded-xl border bg-popover p-2 shadow-xl sm:right-38" role="listbox" aria-label="Search results">
          {results.length ? results.map((entity) => (
            <button key={entity.id} type="button" className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => onOpenEntity(entity.id)}>
              <span className="mt-0.5 rounded bg-secondary px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">{entity.type}</span>
              <span className="min-w-0"><strong className="block truncate text-sm">{entity.title}</strong><span className="line-clamp-1 text-xs text-muted-foreground">{entity.summary || entity.id}</span></span>
            </button>
          )) : <p className="px-3 py-5 text-center text-sm text-muted-foreground">No matching context.</p>}
        </div>
      )}
    </div>
  );
}
