import type { ReactNode } from "react";

import type { ViewName } from "../../hooks/use-hash-view";
import type { DashboardSnapshot, RepoStatus, SearchScope } from "../../types";
import { Header } from "./header";
import { Sidebar } from "./sidebar";

interface AppShellProps {
  children: ReactNode;
  view: ViewName;
  onSelectView: (view: ViewName) => void;
  snapshot: DashboardSnapshot;
  repo: RepoStatus | null;
  repoError: string | null;
  query: string;
  scope: SearchScope;
  onQueryChange: (value: string) => void;
  onScopeChange: (value: SearchScope) => void;
  onOpenEntity: (id: string) => void;
}

export function AppShell({ children, ...props }: AppShellProps) {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <a href="#main-content" className="fixed left-3 top-3 z-[100] -translate-y-20 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground focus:translate-y-0">Skip to main content</a>
      <Sidebar view={props.view} capabilities={props.snapshot.capabilities} onSelect={props.onSelectView} />
      <div className="min-w-0 flex-1">
        <Header {...props} entities={props.snapshot.entities} />
        {children}
      </div>
    </div>
  );
}
