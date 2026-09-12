import { ArrowDownLeft } from "@phosphor-icons/react/ArrowDownLeft";
import { ArrowUpRight } from "@phosphor-icons/react/ArrowUpRight";
import { Info as ShieldAlert } from "@phosphor-icons/react/Info";

import { relationReferences } from "../../lib/model.mjs";
import type { Relation } from "../../lib/model.mjs";
import type { Entity } from "../../types";
import { Badge } from "../ui/badge";
import { Card, CardContent } from "../ui/card";

export function RelationPanel({
  relations,
  selectedRelationId,
  focusId,
  entities,
}: {
  relations: Relation[];
  selectedRelationId: string | null;
  focusId: string;
  entities: Entity[];
}) {
  const byId = new Map(entities.map((entity) => [entity.id, entity]));
  const selected = relations.find(
    (relation) => relation.id === selectedRelationId,
  );
  const references = relationReferences(relations, focusId);
  if (!selected)
    return (
      <Card>
        <CardContent className="p-5">
          <h3 className="font-semibold">Relationship context</h3>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="bg-muted p-3">
              <ArrowUpRight className="size-4 text-primary" />
              <strong className="mt-2 block text-xl">
                {references.outgoing.length}
              </strong>
              <span className="text-xs text-muted-foreground">
                Outgoing declarations
              </span>
            </div>
            <div className="bg-muted p-3">
              <ArrowDownLeft className="size-4 text-primary" />
              <strong className="mt-2 block text-xl">
                {references.incoming.length}
              </strong>
              <span className="text-xs text-muted-foreground">
                Incoming backlinks
              </span>
            </div>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            Select an edge marker to inspect its recorded declaration.
          </p>
        </CardContent>
      </Card>
    );
  const declarations = selected.declarations || [];
  const typed = selected.semanticStatus === "typed";
  const firstDeclaration = declarations[0] || {
    from: selected.from,
    to: selected.to,
  };
  const mutual = declarations.some(
    (item) =>
      item.from === firstDeclaration.to && item.to === firstDeclaration.from,
  );
  const heading = mutual
    ? `${byId.get(selected.from)?.title || selected.from} ↔ ${byId.get(selected.to)?.title || selected.to}`
    : `${byId.get(firstDeclaration.from)?.title || firstDeclaration.from} → ${byId.get(firstDeclaration.to)?.title || firstDeclaration.to}`;
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Badge variant="secondary">{typed ? selected.label || selected.kind.replaceAll("_", " ") : "Generic legacy link"}</Badge>
            <h3 className="mt-3 font-semibold">{heading}</h3>
          </div>
          <ShieldAlert className="size-5 text-signal" />
        </div>
        <dl className="mt-4 grid gap-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Evidence</dt>
            <dd>{typed ? selected.evidence?.replaceAll("_", " ") || "Not recorded" : "Reason not structured"}</dd>
          </div>
          {typed && <>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Sources</dt><dd className="min-w-0 break-words text-right">{selected.sources?.join(", ") || "Not recorded"}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Valid from</dt><dd>{selected.validFrom || "Unbounded"}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Valid to</dt><dd>{selected.validTo || "Unbounded"}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Recorded in</dt><dd className="min-w-0 break-words text-right">{selected.sourcePath}</dd></div>
            {selected.note && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Note</dt><dd className="min-w-0 break-words text-right">{selected.note}</dd></div>}
          </>}
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Review</dt>
            <dd>{selected.review || "not represented"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Provenance</dt>
            <dd>
              {selected.projectedProvenance ||
                selected.provenance ||
                "frontmatter.links"}
            </dd>
          </div>
        </dl>
        <div className="mt-4 border-t pt-4">
          <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Recorded declarations
          </h4>
          {declarations.length ? (
            declarations.map((item, index) => (
              <p
                key={`${item.from}-${item.to}-${index}`}
                className="mt-2 text-xs"
              >
                {byId.get(item.from)?.title || item.from} →{" "}
                {byId.get(item.to)?.title || item.to}
                {item.sourcePath ? ` · ${item.sourcePath}` : ""}
              </p>
            ))
          ) : (
            <p className="mt-2 text-xs">
              {byId.get(selected.from)?.title || selected.from} →{" "}
              {byId.get(selected.to)?.title || selected.to}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
