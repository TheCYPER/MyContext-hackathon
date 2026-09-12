import { ArrowDownLeft, ArrowUpRight, ShieldAlert } from "lucide-react";

import { relationReferences } from "../../lib/model.mjs";
import type { LegacyRelation } from "../../lib/model.mjs";
import type { Entity } from "../../types";
import { Badge } from "../ui/badge";
import { Card, CardContent } from "../ui/card";

export function RelationPanel({ relations, selectedRelationId, focusId, entities }: { relations: LegacyRelation[]; selectedRelationId: string | null; focusId: string; entities: Entity[] }) {
  const byId = new Map(entities.map((entity) => [entity.id, entity]));
  const selected = relations.find((relation) => relation.id === selectedRelationId);
  const references = relationReferences(relations, focusId);
  if (!selected) return <Card><CardContent className="p-5"><h3 className="font-semibold">Relationship context</h3><div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-lg bg-muted p-3"><ArrowUpRight className="size-4 text-primary" /><strong className="mt-2 block text-xl">{references.outgoing.length}</strong><span className="text-xs text-muted-foreground">Outgoing declarations</span></div><div className="rounded-lg bg-muted p-3"><ArrowDownLeft className="size-4 text-primary" /><strong className="mt-2 block text-xl">{references.incoming.length}</strong><span className="text-xs text-muted-foreground">Incoming backlinks</span></div></div><p className="mt-4 text-xs leading-relaxed text-muted-foreground">Select an edge marker to inspect its recorded declaration.</p></CardContent></Card>;
  const declarations = selected.declarations || [];
  return <Card><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div><Badge variant="secondary">Generic legacy link</Badge><h3 className="mt-3 font-semibold">{byId.get(selected.from)?.title || selected.from} ↔ {byId.get(selected.to)?.title || selected.to}</h3></div><ShieldAlert className="size-5 text-amber-600" /></div><dl className="mt-4 grid gap-2 text-sm"><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Evidence</dt><dd>Reason not structured</dd></div><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Review</dt><dd>{selected.review || "not represented"}</dd></div><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Provenance</dt><dd>{selected.provenance || "frontmatter.links"}</dd></div></dl><div className="mt-4 border-t pt-4"><h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recorded declarations</h4>{declarations.length ? declarations.map((item, index) => <p key={`${item.from}-${item.to}-${index}`} className="mt-2 text-xs">{byId.get(item.from)?.title || item.from} → {byId.get(item.to)?.title || item.to}</p>) : <p className="mt-2 text-xs">{byId.get(selected.from)?.title || selected.from} → {byId.get(selected.to)?.title || selected.to}</p>}</div></CardContent></Card>;
}
