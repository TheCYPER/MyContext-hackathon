import { BriefcaseBusiness, CircleGauge, FolderKanban, GitFork, Lightbulb, Network, Settings2, Sparkles, Users } from "lucide-react";
import type { ComponentType } from "react";

import { viewAvailable } from "../../lib/model.mjs";
import { cn } from "../../lib/utils";
import type { ViewName } from "../../hooks/use-hash-view";
import type { CapabilitySet } from "../../types";
import { Button } from "../ui/button";

export const NAV_ITEMS: Array<{ view: ViewName; label: string; icon: ComponentType<{ className?: string }> }> = [
  { view: "desk", label: "Overview", icon: CircleGauge },
  { view: "workstreams", label: "Current focus", icon: Sparkles },
  { view: "ideas", label: "Ideas", icon: Lightbulb },
  { view: "runs", label: "Runs", icon: GitFork },
  { view: "people", label: "People", icon: Users },
  { view: "projects", label: "Projects", icon: FolderKanban },
  { view: "experience", label: "Experience", icon: BriefcaseBusiness },
  { view: "atlas", label: "Graph", icon: Network },
  { view: "system", label: "System", icon: Settings2 },
];

interface NavigationProps {
  view: ViewName;
  capabilities?: CapabilitySet;
  onSelect: (view: ViewName) => void;
}

export function Navigation({ view, capabilities, onSelect }: NavigationProps) {
  return (
    <nav aria-label="Workspace" className="grid gap-1">
      {NAV_ITEMS.filter((item) => viewAvailable(item.view, capabilities)).map(({ view: target, label, icon: Icon }) => (
        <Button
          key={target}
          type="button"
          variant="ghost"
          className={cn("h-10 w-full justify-start px-3 text-muted-foreground", target === view && "bg-accent text-accent-foreground")}
          aria-current={target === view ? "page" : undefined}
          onClick={() => onSelect(target)}
        >
          <Icon className="size-4" />
          {label}
        </Button>
      ))}
    </nav>
  );
}

export function Brand() {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-9 place-items-center rounded-xl bg-primary/12 text-primary"><Network className="size-5" /></span>
      <div>
        <div className="text-sm font-semibold tracking-tight">MyContext</div>
        <div className="text-xs text-muted-foreground">Work &amp; learning</div>
      </div>
    </div>
  );
}

export function Sidebar(props: NavigationProps) {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-card/70 px-4 py-5 backdrop-blur md:flex">
      <Brand />
      <div className="mt-8"><Navigation {...props} /></div>
      <p className="mt-auto rounded-lg bg-muted/70 p-3 text-xs leading-relaxed text-muted-foreground">
        Local, read-only context from committed Git HEAD.
      </p>
    </aside>
  );
}
