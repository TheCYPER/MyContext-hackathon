import { List as Menu } from "@phosphor-icons/react/List";
import { useRef, useState } from "react";

import type { ViewName } from "../../hooks/use-hash-view";
import type { DashboardSnapshot, Entity, RepoStatus, SearchScope } from "../../types";
import { Button } from "../ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "../ui/sheet";
import { Brand, Navigation } from "./sidebar";
import { GlobalSearch } from "./global-search";
import { RepositoryStatus } from "./repository-status";
import { ReviewSheet } from "./review-sheet";
import { ThemeMenu } from "./theme-menu";

interface HeaderProps {
  view: ViewName;
  onSelectView: (view: ViewName) => void;
  snapshot: DashboardSnapshot;
  repo: RepoStatus | null;
  repoError: string | null;
  entities: Entity[];
  query: string;
  scope: SearchScope;
  onQueryChange: (value: string) => void;
  onScopeChange: (value: SearchScope) => void;
  onOpenEntity: (id: string) => void;
}

export function Header(props: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const routeSelected = useRef(false);
  return (
    <header className="sticky top-0 z-30 border-b bg-background px-4 py-3 sm:px-6">
      <div className="mx-auto flex max-w-7xl items-center gap-2">
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild><Button type="button" variant="ghost" size="icon" className="md:hidden" aria-label="Open navigation"><Menu /></Button></SheetTrigger>
          <SheetContent side="left" onCloseAutoFocus={(event) => { if (routeSelected.current) { event.preventDefault(); routeSelected.current = false; document.getElementById("main-content")?.focus(); } }}><SheetHeader><SheetTitle><Brand /></SheetTitle></SheetHeader><div className="mt-4"><Navigation view={props.view} capabilities={props.snapshot.capabilities} onSelect={(view) => { routeSelected.current = true; setMenuOpen(false); props.onSelectView(view); }} /></div></SheetContent>
        </Sheet>
        <div className="min-w-0 flex-1 md:max-w-xl"><GlobalSearch entities={props.entities} query={props.query} scope={props.scope} onQueryChange={props.onQueryChange} onScopeChange={props.onScopeChange} onOpenEntity={props.onOpenEntity} /></div>
        <div className="ml-auto hidden xl:block"><RepositoryStatus repo={props.repo} snapshot={props.snapshot} error={props.repoError} /></div>
        <ThemeMenu />
        <ReviewSheet items={props.snapshot.reviewItems} onOpenEntity={props.onOpenEntity} />
      </div>
    </header>
  );
}
