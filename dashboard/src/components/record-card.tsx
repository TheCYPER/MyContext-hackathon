import { ArrowSquareOut as ArrowUpRight } from "@phosphor-icons/react/ArrowSquareOut";

import type { Entity, GraphEdge } from "../types";
import { RelationTrail } from "./relation-trail";
import { StatusBadge } from "./status-badge";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";

export function RecordCard({
  entity,
  entities,
  edges,
  onOpenEntity,
  onOpenGraph,
}: {
  entity: Entity;
  entities: Entity[];
  edges: GraphEdge[];
  onOpenEntity: (id: string) => void;
  onOpenGraph: (id: string) => void;
}) {
  return (
    <Card className="transition-colors hover:border-primary/25">
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
