import { ArrowSquareOut as ArrowUpRight } from "@phosphor-icons/react/ArrowSquareOut";

import { cn } from "../lib/utils";
import type { Entity, GraphEdge } from "../types";
import { RelationTrail } from "./relation-trail";
import type { StatusLayout } from "./status-collection";
import { StatusBadge } from "./status-badge";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";

export function RecordCard({
  entity,
  entities,
  edges,
  layout = "standard",
  onOpenEntity,
  onOpenGraph,
}: {
  entity: Entity;
  entities: Entity[];
  edges: GraphEdge[];
  layout?: StatusLayout;
  onOpenEntity: (id: string) => void;
  onOpenGraph: (id: string) => void;
}) {
  if (layout === "compact") {
    return (
      <Card className="min-w-0 border-0">
        <CardContent className="grid min-w-0 gap-4 p-4 sm:grid-cols-[minmax(12rem,0.8fr)_minmax(0,1.2fr)] sm:items-start">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                {entity.type}
              </span>
              <StatusBadge status={entity.status} />
            </div>
            <Button
              type="button"
              variant="link"
              className="h-auto max-w-full justify-start p-0 text-left text-lg font-black text-foreground"
              onClick={() => onOpenEntity(entity.id)}
            >
              <span className="truncate">{entity.title}</span>
              <ArrowUpRight />
            </Button>
          </div>
          <div className="min-w-0">
            <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
              {entity.summary || "No summary available."}
            </p>
            <RelationTrail
              record={entity}
              entities={entities}
              edges={edges}
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
      className={cn(
        "min-w-0 transition-colors hover:border-primary/25",
        layout === "featured" && "border-l-4 border-l-primary",
        layout === "working" && "border-l-4 border-l-signal",
      )}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {entity.type}
              </span>
              <StatusBadge status={entity.status} />
            </div>
            <Button
              type="button"
              variant="link"
              className="h-auto max-w-full justify-start p-0 text-left text-base font-bold text-foreground"
              onClick={() => onOpenEntity(entity.id)}
            >
              <span className="truncate">{entity.title}</span>
              <ArrowUpRight />
            </Button>
            <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
              {entity.summary || "No summary available."}
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {entity.tags.slice(0, 4).map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>
        <RelationTrail
          record={entity}
          entities={entities}
          edges={edges}
          onOpenEntity={onOpenEntity}
          onOpenGraph={onOpenGraph}
        />
      </CardContent>
    </Card>
  );
}
