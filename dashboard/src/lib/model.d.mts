import type { CapabilitySet, Entity, GraphEdge, GraphNode, Workstream } from "../types";

export const ATLAS_LANES: ReadonlyArray<{ type: string; label: string; x: number; width: number }>;
export const LEGACY_RELATION_BOUNDARY: Readonly<Record<string, string>>;

export interface LegacyRelation extends GraphEdge {
  projectedProvenance?: string | null;
  declarations: Array<{ from: string; to: string; sourcePath?: string }>;
}

export function buildLegacyRelations(entities: Entity[], edges?: GraphEdge[]): LegacyRelation[];
export function relationReferences(relations: LegacyRelation[], entityId: string): { outgoing: Array<{ relation: LegacyRelation; otherId: string; direction: "outgoing" }>; incoming: Array<{ relation: LegacyRelation; otherId: string; direction: "incoming" }> };
export function relationTrail(relations: LegacyRelation[], entityId: string): Array<{ relation: LegacyRelation; otherId: string; direction: "outgoing" | "incoming" | "mutual"; outgoing: boolean; incoming: boolean }>;
export function focusNeighborhood(nodes: GraphNode[], relations: LegacyRelation[], focusId: string, depth?: number): { nodes: GraphNode[]; relations: LegacyRelation[]; distances: Map<string, number> };
export function chooseFocusNode(nodes: GraphNode[], relations: LegacyRelation[], preferredId?: string | null): string | null;
export function shortestPath(nodes: GraphNode[], relations: LegacyRelation[], startId: string, targetId: string): { nodeIds: string[]; relationIds: string[] } | null;
export function layoutFocusGraph(nodes: GraphNode[], relations: LegacyRelation[], focusId: string, depth?: number): { nodes: GraphNode[]; relations: LegacyRelation[]; distances: Map<string, number>; positions: Map<string, { x: number; y: number; width: number; height: number }>; width: number; height: number };
export function rankWorkstreams(workstreams: Workstream[]): Workstream[];
export function layoutAtlas(nodes: GraphNode[]): { nodes: GraphNode[]; positions: Map<string, { x: number; y: number; width: number; height: number }>; lanes: typeof ATLAS_LANES; width: number; height: number };
export function viewAvailable(view: string, capabilities?: CapabilitySet): boolean;
export function isSyntheticDemo(entities: Entity[] | null | undefined): boolean;
export function academicContextCounts(entities: Entity[] | null | undefined): { projects: number; experience: number; researchIdeas: number; projectIdeas: number };
