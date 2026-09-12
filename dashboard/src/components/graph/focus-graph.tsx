import type { GraphEdge, GraphNode } from "../../types";

type Box = { x: number; y: number; width: number; height: number };

export function FocusGraph({
  nodes,
  relations,
  positions,
  width,
  height,
  focusId,
  pathNodeIds,
  pathRelationIds,
  selectedRelationId,
  onFocus,
  onInspect,
  onSelectRelation,
}: {
  nodes: GraphNode[];
  relations: GraphEdge[];
  positions: Map<string, Box>;
  width: number;
  height: number;
  focusId: string;
  pathNodeIds: Set<string>;
  pathRelationIds: Set<string>;
  selectedRelationId: string | null;
  onFocus: (id: string) => void;
  onInspect: (id: string) => void;
  onSelectRelation: (id: string) => void;
}) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const center = (id: string) => {
    const box = positions.get(id)!;
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };
  const activate = (
    event: React.KeyboardEvent<SVGGElement>,
    action: () => void,
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      action();
    }
  };
  return (
    <div className="graph-scroll min-w-0 max-w-full overflow-auto border bg-[var(--graph-background)]">
      <svg
        className="block min-w-[900px]"
        viewBox={`0 0 ${width} ${height}`}
        role="group"
        aria-label="Focused context relationships"
      >
        {relations.map((relation) => {
          const from = center(relation.from);
          const to = center(relation.to);
          const parallels = relations.filter((candidate) =>
            (candidate.from === relation.from && candidate.to === relation.to) ||
            (candidate.from === relation.to && candidate.to === relation.from));
          const offset = (parallels.indexOf(relation) - (parallels.length - 1) / 2) * 24;
          const direction = relation.from < relation.to ? 1 : -1;
          const distance = Math.hypot(to.x - from.x, to.y - from.y) || 1;
          const shift = { x: -(to.y - from.y) / distance * offset * direction, y: (to.x - from.x) / distance * offset * direction };
          const mid = { x: (from.x + to.x) / 2 + shift.x, y: (from.y + to.y) / 2 + shift.y };
          const typed = relation.semanticStatus === "typed";
          const path = pathRelationIds.has(relation.id);
          return (
            <g key={relation.id}>
              <path
                d={`M ${from.x} ${from.y} Q ${mid.x + shift.x} ${mid.y + shift.y} ${to.x} ${to.y}`}
                fill="none"
                className={path ? "graph-edge graph-edge-path" : "graph-edge"}
              />
              <g
                role="button"
                tabIndex={0}
                aria-label={typed
                  ? `Relationship ${nodeById.get(relation.from)?.title} → ${nodeById.get(relation.to)?.title}: ${relation.kind.replaceAll("_", " ")} (${relation.review})`
                  : `Relationship ${nodeById.get(relation.from)?.title} and ${nodeById.get(relation.to)?.title}`}
                className="graph-relation-control"
                onClick={() => onSelectRelation(relation.id)}
                onKeyDown={(event) =>
                  activate(event, () => onSelectRelation(relation.id))
                }
              >
                <circle
                  cx={mid.x}
                  cy={mid.y}
                  r={selectedRelationId === relation.id ? 10 : 7}
                />
                <text x={mid.x} y={mid.y + 3} textAnchor="middle" transform={typed ? `rotate(${Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI} ${mid.x} ${mid.y})` : undefined}>
                  {typed ? "→" : "↗"}
                </text>
              </g>
            </g>
          );
        })}
        {nodes.map((node) => {
          const box = positions.get(node.id);
          if (!box) return null;
          const focus = node.id === focusId;
          const path = pathNodeIds.has(node.id);
          const action = () => (focus ? onInspect(node.id) : onFocus(node.id));
          return (
            <g
              key={node.id}
              role="button"
              tabIndex={0}
              aria-label={
                focus ? `Inspect ${node.title}` : `Focus on ${node.title}`
              }
              className={`graph-node${focus ? " graph-node-focus" : ""}${path ? " graph-node-path" : ""}`}
              onClick={action}
              onKeyDown={(event) => activate(event, action)}
            >
              <rect
                x={box.x}
                y={box.y}
                width={box.width}
                height={box.height}
                rx={0}
              />
              <text x={box.x + 14} y={box.y + 27}>
                <tspan className="graph-node-title">
                  {node.title.length > 24
                    ? `${node.title.slice(0, 22)}…`
                    : node.title}
                </tspan>
                <tspan x={box.x + 14} dy={19} className="graph-node-meta">
                  {node.type} · {node.status}
                </tspan>
              </text>
              <title>{node.title}</title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
