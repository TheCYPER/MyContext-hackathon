import { AlertCircle, Database } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { entityMatches } from "./components/layout/global-search";
import { AppShell } from "./components/layout/app-shell";
import { Brand } from "./components/layout/sidebar";
import { LoadingState } from "./components/loading-state";
import { Button } from "./components/ui/button";
import { useDashboardData } from "./hooks/use-dashboard-data";
import { useHashView, VIEW_META, type ViewName } from "./hooks/use-hash-view";
import { isSyntheticDemo } from "./lib/model.mjs";
import { ThemeSync } from "./stores/theme-store";
import type { SearchScope } from "./types";
import { GraphView } from "./views/graph-view";
import { IdeasView } from "./views/ideas-view";
import { OverviewView } from "./views/overview-view";
import { RecordsView } from "./views/records-view";
import { RunsView } from "./views/runs-view";
import { SystemView } from "./views/system-view";
import { WorkstreamsView } from "./views/workstreams-view";

function LoadingShell() {
  return <main><div className="border-b bg-card/70 px-6 py-4"><Brand /></div><LoadingState /></main>;
}

export function App() {
  const data = useDashboardData();
  const { view, setView } = useHashView(data.snapshot?.capabilities);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<SearchScope>("all");
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [graphFocusId, setGraphFocusId] = useState<string | null>(null);

  useEffect(() => {
    document.title = `${VIEW_META[view].title} · MyContext`;
  }, [view]);

  const visibleEntities = useMemo(() => data.snapshot?.entities.filter((entity) => entityMatches(entity, query, scope)) || [], [data.snapshot, query, scope]);

  if (data.loading && !data.snapshot) return <><ThemeSync /><LoadingShell /></>;

  if (!data.snapshot) {
    return <main className="grid min-h-screen place-items-center p-6"><ThemeSync /><div role="alert" className="w-full max-w-md rounded-2xl border bg-card p-6 text-center shadow-sm"><AlertCircle className="mx-auto size-7 text-amber-600" /><h1 className="mt-4 text-xl font-semibold">Canonical context is unavailable</h1><p className="mt-2 text-sm text-muted-foreground">{data.snapshotError || "MyContext could not project the selected repository."}</p><Button type="button" variant="outline" className="mt-5" onClick={data.retry}>Try again</Button></div></main>;
  }

  const openGraph = (id: string) => { setGraphFocusId(id); setView("atlas"); };
  const selectOverviewView = (next: "projects" | "experience" | "ideas") => setView(next);
  const renderView = () => {
    const shared = { snapshot: data.snapshot!, onOpenEntity: setSelectedEntityId };
    switch (view) {
      case "desk": return <OverviewView {...shared} onSelectView={selectOverviewView} />;
      case "workstreams": return <WorkstreamsView {...shared} />;
      case "ideas": return <IdeasView {...shared} records={visibleEntities} onOpenGraph={openGraph} />;
      case "people": return <RecordsView {...shared} records={visibleEntities} type="person" onOpenGraph={openGraph} />;
      case "projects": return <RecordsView {...shared} records={visibleEntities} type="project" onOpenGraph={openGraph} />;
      case "experience": return <RecordsView {...shared} records={visibleEntities} type="experience" onOpenGraph={openGraph} />;
      case "runs": return <RunsView snapshot={data.snapshot!} />;
      case "atlas": return <GraphView snapshot={data.snapshot!} />;
      case "system": return <SystemView snapshot={data.snapshot!} repo={data.repo} />;
    }
  };
  const meta = VIEW_META[view];

  return (
    <>
      <ThemeSync />
      <AppShell view={view} onSelectView={(next: ViewName) => setView(next)} snapshot={data.snapshot} repo={data.repo} repoError={data.repoError} query={query} scope={scope} onQueryChange={setQuery} onScopeChange={setScope} onOpenEntity={setSelectedEntityId}>
        <main id="main-content" tabIndex={-1} className="mx-auto max-w-7xl px-4 py-8 outline-none sm:px-6 sm:py-10">
          {isSyntheticDemo(data.snapshot.entities) && <div className="mb-7 flex gap-3 rounded-xl border border-amber-500/20 bg-amber-500/8 p-3 text-xs leading-relaxed text-amber-800 dark:text-amber-200"><Database className="mt-0.5 size-4 shrink-0" />Synthetic academic scenario · The student, people, institutions, and project histories in this demo are fictional.</div>}
          <header className="mb-9 max-w-3xl">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">{meta.kicker}</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{meta.title}</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">{meta.deck}</p>
            {data.repoError && <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">Context loaded; repository status unavailable: {data.repoError}</p>}
          </header>
          {renderView()}
        </main>
      </AppShell>
      <span className="sr-only">{selectedEntityId ? `Selected ${selectedEntityId}` : "No selected record"}{graphFocusId ? ` · graph focus ${graphFocusId}` : ""}</span>
    </>
  );
}
