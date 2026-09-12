import { Route, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { EmptyState } from "../components/empty-state";
import { FocusGraph } from "../components/graph/focus-graph";
import { GlobalGraph } from "../components/graph/global-graph";
import { RelationPanel } from "../components/graph/relation-panel";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { buildLegacyRelations, chooseFocusNode, layoutFocusGraph, shortestPath } from "../lib/model.mjs";
import type { LegacyRelation } from "../lib/model.mjs";
import type { DashboardSnapshot, GraphNode } from "../types";
import { SectionHeading } from "./section-heading";

export function GraphView({ snapshot, initialFocusId, onOpenEntity }: { snapshot: DashboardSnapshot; initialFocusId?: string | null; onOpenEntity?: (id: string) => void }) {
  const nodes = snapshot.graph.nodes;
  const relations = useMemo(() => {
    const nodeIds = new Set(nodes.map((node) => node.id));
    return buildLegacyRelations(snapshot.entities, snapshot.graph.edges)
      .filter((relation) => nodeIds.has(relation.from) && nodeIds.has(relation.to));
  }, [nodes, snapshot.entities, snapshot.graph.edges]);
  const [focusId, setFocusId] = useState(() => chooseFocusNode(nodes, relations, initialFocusId) as string | null);
  const [depth, setDepth] = useState<1 | 2>(1);
  const [selectedRelationId, setSelectedRelationId] = useState<string | null>(null);
  const [targetId, setTargetId] = useState("");
  const [path, setPath] = useState<{ nodeIds: string[]; relationIds: string[] } | null>(null);
  const [traceAttempted, setTraceAttempted] = useState(false);

  useEffect(() => {
    if (initialFocusId && nodes.some((node) => node.id === initialFocusId)) setFocusId(initialFocusId);
  }, [initialFocusId, nodes]);

  if (!nodes.length || !focusId) return <section><SectionHeading title="Context graph" note="One hop by default · connections follow recorded links" /><EmptyState title="No visible relationship exists yet." description="The graph only uses visible canonical frontmatter links." /></section>;

  const layout = layoutFocusGraph(nodes, relations, focusId, depth) as { nodes: GraphNode[]; relations: LegacyRelation[]; positions: Map<string, { x: number; y: number; width: number; height: number }>; width: number; height: number; distances: Map<string, number> };
  const focus = nodes.find((node) => node.id === focusId)!;
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const trace = () => { setTraceAttempted(true); setPath(targetId ? shortestPath(nodes, relations, focusId, targetId) : null); };
  const changeFocus = (id: string) => { setFocusId(id); setSelectedRelationId(null); setTargetId(""); setPath(null); setTraceAttempted(false); };
  const nearbyNodes = layout.nodes.filter((node) => node.id !== focusId);

  return <div className="space-y-5"><section><SectionHeading title="Context graph" note="One hop by default · connections follow recorded links" /><div className="rounded-xl border bg-card p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div><div className="flex items-center gap-2"><Badge variant="secondary">Focused record</Badge><span className="text-xs text-muted-foreground">{focus.type}</span></div><h2 className="mt-2 text-lg font-semibold">{focus.title}</h2></div><div className="flex flex-wrap items-center gap-2"><Button type="button" variant={depth === 1 ? "secondary" : "ghost"} size="sm" onClick={() => setDepth(1)}>1 hop</Button><Button type="button" variant={depth === 2 ? "secondary" : "outline"} size="sm" onClick={() => setDepth(2)}>Expand to 2</Button><label className="sr-only" htmlFor="connection-target">Connection target</label><select id="connection-target" aria-label="Connection target" value={targetId} onChange={(event) => { setTargetId(event.target.value); setTraceAttempted(false); setPath(null); }} className="h-8 max-w-48 rounded-md border bg-background px-2 text-xs"><option value="">Find connection…</option>{nodes.filter((node) => node.id !== focusId).sort((a, b) => a.title.localeCompare(b.title)).map((node) => <option key={node.id} value={node.id}>{node.title}</option>)}</select><Button type="button" variant="outline" size="sm" disabled={!targetId} onClick={trace}><Route />Trace</Button></div></div><p className="mt-4 text-xs leading-relaxed text-muted-foreground">The aperture highlights at most two hops through visible legacy frontmatter links. It explains reachability, not meaning.</p><div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]"><FocusGraph nodes={layout.nodes} relations={layout.relations} positions={layout.positions} width={layout.width} height={layout.height} focusId={focusId} pathNodeIds={new Set(path?.nodeIds || [])} pathRelationIds={new Set(path?.relationIds || [])} selectedRelationId={selectedRelationId} onFocus={changeFocus} onInspect={(id) => onOpenEntity?.(id)} onSelectRelation={setSelectedRelationId} /><RelationPanel relations={relations} selectedRelationId={selectedRelationId} focusId={focusId} entities={snapshot.entities} /></div><div className="mt-4 rounded-xl bg-muted/55 p-4 lg:hidden"><h3 className="text-sm font-medium">Records within {depth === 1 ? "one hop" : "two hops"}</h3><ul className="mt-2 grid gap-1">{nearbyNodes.map((node) => <li key={node.id}><Button type="button" variant="ghost" size="sm" className="w-full justify-between" onClick={() => changeFocus(node.id)}>{node.title}<span className="text-xs text-muted-foreground">{layout.distances.get(node.id)} hop</span></Button></li>)}</ul></div></div></section>{traceAttempted && <section className="rounded-xl border bg-card p-5"><div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold">{path ? "Connection path" : "No recorded connection path"}</h3><p className="mt-1 text-xs text-muted-foreground">Boundary: this view explains reachability only. It does not infer endorsement, causality, research fit, or evidence quality.</p></div><Button type="button" variant="ghost" size="sm" onClick={() => { setPath(null); setTargetId(""); setTraceAttempted(false); }}><X />Clear path</Button></div>{path && <ol className="mt-4 flex flex-wrap items-center gap-2 text-sm">{path.nodeIds.map((id, index) => <li key={id} className="flex items-center gap-2"><Button type="button" variant="secondary" size="sm" onClick={() => changeFocus(id)}>{nodeById.get(id)?.title || id}</Button>{index < path.nodeIds.length - 1 && <span className="text-muted-foreground">→</span>}</li>)}</ol>}</section>}<GlobalGraph nodes={nodes} relations={relations} onFocus={changeFocus} /></div>;
}
