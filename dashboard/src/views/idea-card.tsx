import type { DashboardSnapshot, Entity } from "../types";
import { cn } from "../lib/utils";
import { RelationTrail } from "../components/relation-trail";
import { StatusBadge } from "../components/status-badge";
import type { StatusLayout } from "../components/status-collection";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";

export function EntityIdeaCard({
  idea,
  snapshot,
  layout = "standard",
  onOpenEntity,
  onOpenGraph,
}: {
  idea: Entity;
  snapshot: DashboardSnapshot;
  layout?: StatusLayout;
  onOpenEntity: (id: string) => void;
  onOpenGraph: (id: string) => void;
}) {
  const title =
    idea.ideaKind === "research"
      ? idea.submission?.projectTitle || idea.title
      : idea.title;
  const stateSurface =
    idea.status === "active" ||
    idea.status === "draft" ||
    idea.status === "archived"
      ? idea.status
      : "other";
  const stateShadow = {
    active: "shadow-[var(--shadow-active-card)]",
    draft: "shadow-[var(--shadow-draft-card)]",
    archived: "shadow-[var(--shadow-archived-card)]",
    other: "shadow-[var(--shadow-card)]",
  }[stateSurface];

  if (layout === "compact") {
    return (
      <Card
        data-state-surface={stateSurface}
        className={cn("min-w-0 border-0", stateShadow)}
      >
        <CardContent className="grid min-w-0 gap-4 p-4 sm:grid-cols-[minmax(12rem,0.8fr)_minmax(0,1.2fr)]">
          <div className="min-w-0">
            <StatusBadge status={idea.status} />
            <Button
              type="button"
              variant="link"
              className="mt-2 h-auto min-w-0 max-w-full justify-start whitespace-normal break-words p-0 text-left text-lg font-black leading-tight text-foreground"
              onClick={() => onOpenEntity(idea.id)}
            >
              {title}
            </Button>
          </div>
          <div className="min-w-0">
            <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
              {idea.summary || "No problem statement is projected."}
            </p>
            <RelationTrail
              record={idea}
              entities={snapshot.entities}
              edges={snapshot.graph.edges}
              onOpenEntity={onOpenEntity}
              onOpenGraph={onOpenGraph}
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      data-state-surface={stateSurface}
      className={cn(
        "min-w-0 transition-shadow",
        stateShadow,
        layout === "featured" && "border-l-4 border-l-primary",
        layout === "working" && "border-l-4 border-l-signal",
      )}
    >
      <CardContent className="min-w-0 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Badge variant="secondary">
            {idea.ideaKind === "research"
              ? "Research question"
              : "Project idea"}
          </Badge>
          <StatusBadge status={idea.status} />
        </div>
        <Button
          type="button"
          variant="link"
          className="mt-5 h-auto min-w-0 max-w-full justify-start whitespace-normal break-words p-0 text-left text-xl font-black leading-tight text-foreground sm:text-2xl"
          onClick={() => onOpenEntity(idea.id)}
        >
          {title}
        </Button>
        {idea.ideaKind === "research" ? (
          <div className="mt-4 grid gap-3">
            <div className="bg-muted/60 p-3">
              <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Project description
              </h4>
              <p className="mt-1 text-sm leading-relaxed">
                {idea.submission?.projectDescription || idea.summary}
              </p>
            </div>
            <div className="bg-muted/60 p-3">
              <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Advisor help
              </h4>
              <p className="mt-1 text-sm leading-relaxed">
                {idea.submission?.advisorHelp ||
                  "No advisor-help statement is projected."}
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {idea.summary || "No problem statement is projected."}
          </p>
        )}
        <RelationTrail
          record={idea}
          entities={snapshot.entities}
          edges={snapshot.graph.edges}
          onOpenEntity={onOpenEntity}
          onOpenGraph={onOpenGraph}
        />
      </CardContent>
    </Card>
  );
}
