import { ArrowRight } from "@phosphor-icons/react/ArrowRight";
import { ShareNetwork as Network } from "@phosphor-icons/react/ShareNetwork";

import { buildRelations, filterRelations, relationTrail } from "../lib/model.mjs";
import type { Entity, GraphEdge } from "../types";
import { Button } from "./ui/button";

export function RelationTrail({ record, entities, edges, onOpenEntity, onOpenGraph }: { record: Entity; entities: Entity[]; edges: GraphEdge[]; onOpenEntity: (id: string) => void; onOpenGraph: (id: string) => void }) {
  const byId = new Map(entities.map((entity) => [entity.id, entity]));
  const relations = filterRelations(buildRelations(entities, edges));
  const items = relationTrail(relations, record.id).slice(0, 4);
  return (
    <div className="mt-4 border-t pt-3">
      <div className="flex items-center justify-between gap-3"><span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Related context</span><Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onOpenGraph(record.id)}><Network />Focus in graph</Button></div>
      {items.length ? <div className="mt-2 flex flex-wrap gap-1.5">{items.map((item) => {
        const related = byId.get(item.otherId);
        if (!related) return null;
        const label = item.relation.semanticStatus === "typed"
          ? `${item.direction} · ${item.relation.kind.replaceAll("_", " ")} · ${item.relation.review}`
          : "Legacy link · Reason not structured";
        return <Button key={`${item.relation.id}-${item.otherId}`} type="button" variant="secondary" size="sm" className="h-7 max-w-full px-2 text-xs" title={label} onClick={() => onOpenEntity(item.otherId)}><ArrowRight className={item.direction === "incoming" ? "size-3 rotate-180" : "size-3"} /><span className="truncate">{related.title}{item.relation.semanticStatus === "typed" ? ` · ${item.relation.kind.replaceAll("_", " ")}` : ""}</span></Button>;
      })}</div> : <p className="mt-2 text-xs text-muted-foreground">No visible canonical links.</p>}
      <p className="mt-2 text-[10px] text-muted-foreground">{items.some((item) => item.relation.semanticStatus === "typed") ? "Recorded relationships · review state is preserved" : "Legacy link · Reason not structured"}</p>
    </div>
  );
}
