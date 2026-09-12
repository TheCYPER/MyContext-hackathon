import { ArrowSquareOut as ArrowUpRight } from "@phosphor-icons/react/ArrowSquareOut";
import { CheckSquare as CheckCircle2 } from "@phosphor-icons/react/CheckSquare";

import type { Entity, Workstream } from "../types";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";

export function WorkstreamCard({
  workstream,
  entities,
  onOpenEntity,
}: {
  workstream: Workstream;
  entities: Entity[];
  onOpenEntity: (id: string) => void;
}) {
  const byId = new Map(entities.map((entity) => [entity.id, entity]));
  return (
    <Card className="overflow-hidden">
      <CardContent className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div>
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 text-left text-base font-bold text-foreground"
            onClick={() => onOpenEntity(workstream.id)}
          >
            {workstream.title}
            <ArrowUpRight />
          </Button>
          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
            {workstream.summary ||
              "No summary is available in the tracked canonical record."}
          </p>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {workstream.linkedEntities
              .slice(0, 5)
              .map((id) => byId.get(id))
              .filter(Boolean)
              .map((entity) => (
                <Button
                  key={entity!.id}
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => onOpenEntity(entity!.id)}
                >
                  {entity!.title}
                </Button>
              ))}
          </div>
        </div>
        <div className="border-l-4 border-primary bg-primary/10 p-4">
          <span className="flex items-center gap-2 text-xs font-bold text-foreground">
            <CheckCircle2 className="size-4 text-primary" />
            Recorded next step
          </span>
          <p className="mt-2 text-sm leading-relaxed">
            {workstream.nextAction ||
              workstream.attention[0] ||
              "No next step recorded."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
