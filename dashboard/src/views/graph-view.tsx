import { Path as Route } from "@phosphor-icons/react/Path";
import { X } from "@phosphor-icons/react/X";
import { useEffect, useMemo, useState } from "react";

import { EmptyState } from "../components/empty-state";
import { FocusGraph } from "../components/graph/focus-graph";
import { GlobalGraph } from "../components/graph/global-graph";
import { RelationPanel } from "../components/graph/relation-panel";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  buildRelations,
  chooseFocusNode,
  filterRelations,
  layoutFocusGraph,
  shortestPath,
} from "../lib/model.mjs";
import type { Relation } from "../lib/model.mjs";
import type { DashboardSnapshot, GraphNode } from "../types";
import { SectionHeading } from "./section-heading";

export function GraphView({
  snapshot,
  initialFocusId,
  onOpenEntity,
}: {
  snapshot: DashboardSnapshot;
  initialFocusId?: string | null;
  onOpenEntity?: (id: string) => void;
}) {
  const nodes = snapshot.graph.nodes;
  const allRelations = useMemo(() => {
    const nodeIds = new Set(nodes.map((node) => node.id));
    return buildRelations(snapshot.entities, snapshot.graph.edges).filter(
      (relation) => nodeIds.has(relation.from) && nodeIds.has(relation.to),
    );
  }, [nodes, snapshot.entities, snapshot.graph.edges]);
  const [predicate, setPredicate] = useState("");
  const [review, setReview] = useState("");
  const [evidence, setEvidence] = useState<"" | "present" | "missing">("");
  const [includeRejected, setIncludeRejected] = useState(false);
  const [includeOutOfValidity, setIncludeOutOfValidity] = useState(false);
  const [pathMode, setPathMode] = useState<"undirected" | "directed">("undirected");
  const relations = useMemo(() => filterRelations(allRelations, {
    predicates: predicate ? [predicate] : [],
    reviews: review ? [review] : [],
    evidence,
    includeRejected,
    includeOutOfValidity,
  }), [allRelations, predicate, review, evidence, includeRejected, includeOutOfValidity]);
  const [focusId, setFocusId] = useState(
    () => chooseFocusNode(nodes, relations, initialFocusId) as string | null,
  );
  const [depth, setDepth] = useState<1 | 2>(1);
  const [selectedRelationId, setSelectedRelationId] = useState<string | null>(
    null,
  );
  const [targetId, setTargetId] = useState("");
  const [path, setPath] = useState<{
    nodeIds: string[];
    relationIds: string[];
  } | null>(null);
  const [traceAttempted, setTraceAttempted] = useState(false);

  useEffect(() => {
    setPath(null);
    setTraceAttempted(false);
    setSelectedRelationId(null);
  }, [relations, pathMode, initialFocusId]);

  useEffect(() => {
    if (initialFocusId && nodes.some((node) => node.id === initialFocusId))
      setFocusId(initialFocusId);
  }, [initialFocusId, nodes]);

  if (!nodes.length || !focusId)
    return (
      <section>
        <SectionHeading
          title="Context graph"
          note="One hop by default · connections follow recorded links"
        />
        <EmptyState
          title="No visible relationship exists yet."
          description="The graph only uses visible canonical declarations."
        />
      </section>
    );

  const layout = layoutFocusGraph(nodes, relations, focusId, depth) as {
    nodes: GraphNode[];
    relations: Relation[];
    positions: Map<
      string,
      { x: number; y: number; width: number; height: number }
    >;
    width: number;
    height: number;
    distances: Map<string, number>;
  };
  const focus = nodes.find((node) => node.id === focusId)!;
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const trace = () => {
    setTraceAttempted(true);
    setPath(
      targetId ? shortestPath(nodes, relations, focusId, targetId, {
        mode: pathMode, includeRejected, includeOutOfValidity,
      }) : null,
    );
  };
  const changeFocus = (id: string) => {
    setFocusId(id);
    setSelectedRelationId(null);
    setTargetId("");
    setPath(null);
    setTraceAttempted(false);
  };
  const nearbyNodes = layout.nodes.filter((node) => node.id !== focusId);

  return (
    <div className="space-y-5">
      <section>
        <SectionHeading
          title="Context graph"
          note="One hop by default · connections follow recorded links"
        />
        <div className="border bg-card p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Focused record</Badge>
                <span className="text-xs text-muted-foreground">
                  {focus.type}
                </span>
              </div>
              <h2 className="mt-2 text-lg font-semibold">{focus.title}</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant={depth === 1 ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setDepth(1)}
              >
                1 hop
              </Button>
              <Button
                type="button"
                variant={depth === 2 ? "secondary" : "outline"}
                size="sm"
                onClick={() => setDepth(2)}
              >
                Expand to 2
              </Button>
              <label className="sr-only" htmlFor="connection-target">
                Connection target
              </label>
              <select
                id="connection-target"
                aria-label="Connection target"
                value={targetId}
                onChange={(event) => {
                  setTargetId(event.target.value);
                  setTraceAttempted(false);
                  setPath(null);
                }}
                className="h-8 max-w-48 border bg-background px-2 text-xs"
              >
                <option value="">Find connection…</option>
                {nodes
                  .filter((node) => node.id !== focusId)
                  .sort((a, b) => a.title.localeCompare(b.title))
                  .map((node) => (
                    <option key={node.id} value={node.id}>
                      {node.title}
                    </option>
                  ))}
              </select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!targetId}
                onClick={trace}
              >
                <Route />
                Trace
              </Button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
            <label className="grid gap-1">Predicate
              <select aria-label="Relationship predicate" className="h-8 border bg-background px-2" value={predicate} onChange={(event) => setPredicate(event.target.value)}>
                <option value="">All predicates</option>
                {[...new Set(allRelations.map((relation) => relation.kind))].sort().map((kind) => <option key={kind} value={kind}>{kind.replaceAll("_", " ")}</option>)}
              </select>
            </label>
            <label className="grid gap-1">Review
              <select aria-label="Relationship review" className="h-8 border bg-background px-2" value={review} onChange={(event) => setReview(event.target.value)}>
                <option value="">All reviews</option>
                {[...new Set(allRelations.map((relation) => relation.review))].sort().map((state) => <option key={state} value={state}>{state.replaceAll("_", " ")}</option>)}
              </select>
            </label>
            <label className="grid gap-1">Evidence
              <select aria-label="Relationship evidence" className="h-8 border bg-background px-2" value={evidence} onChange={(event) => setEvidence(event.target.value as typeof evidence)}>
                <option value="">All evidence</option><option value="present">Recorded</option><option value="missing">Missing</option>
              </select>
            </label>
            <label className="grid gap-1">Trace mode
              <select aria-label="Trace mode" className="h-8 border bg-background px-2" value={pathMode} onChange={(event) => setPathMode(event.target.value as typeof pathMode)}>
                <option value="undirected">Undirected reachability</option><option value="directed">Directed typed relations</option>
              </select>
            </label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={includeRejected} onChange={(event) => setIncludeRejected(event.target.checked)} />Include rejected</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={includeOutOfValidity} onChange={(event) => setIncludeOutOfValidity(event.target.checked)} />Include outside validity</label>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            The aperture highlights at most two hops through visible recorded
            relationships. Typed predicates retain their recorded meaning and direction;
            legacy links record a connection without a structured reason.
          </p>
          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
            <FocusGraph
              nodes={layout.nodes}
              relations={layout.relations}
              positions={layout.positions}
              width={layout.width}
              height={layout.height}
              focusId={focusId}
              pathNodeIds={new Set(path?.nodeIds || [])}
              pathRelationIds={new Set(path?.relationIds || [])}
              selectedRelationId={selectedRelationId}
              onFocus={changeFocus}
              onInspect={(id) => onOpenEntity?.(id)}
              onSelectRelation={setSelectedRelationId}
            />
            <RelationPanel
              relations={relations}
              selectedRelationId={selectedRelationId}
              focusId={focusId}
              entities={snapshot.entities}
            />
          </div>
          <div className="mt-4 bg-muted/55 p-4 lg:hidden">
            <h3 className="text-sm font-medium">
              Records within {depth === 1 ? "one hop" : "two hops"}
            </h3>
            <ul className="mt-2 grid min-w-0 gap-1">
              {nearbyNodes.map((node) => (
                <li key={node.id} className="min-w-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="min-w-0 max-w-full justify-between gap-3"
                    onClick={() => changeFocus(node.id)}
                  >
                    <span className="truncate text-left">{node.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {layout.distances.get(node.id)} hop
                    </span>
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
      {traceAttempted && (
        <section className="border bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold">
                {path ? "Connection path" : "No recorded connection path"}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Boundary: this view explains reachability only. It does not
                infer endorsement, causality, research fit, or evidence quality.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setPath(null);
                setTargetId("");
                setTraceAttempted(false);
              }}
            >
              <X />
              Clear path
            </Button>
          </div>
          {path && (
            <ol className="mt-4 flex flex-wrap items-center gap-2 text-sm">
              {path.nodeIds.map((id, index) => (
                <li key={id} className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => changeFocus(id)}
                  >
                    {nodeById.get(id)?.title || id}
                  </Button>
                  {index < path.nodeIds.length - 1 && (
                    <span className="text-muted-foreground">→</span>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
      <GlobalGraph nodes={nodes} relations={relations} onFocus={changeFocus} />
    </div>
  );
}
