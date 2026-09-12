import type { CapabilitySet, Entity, GraphEdge, GraphNode, Workstream } from "../types";

export const ATLAS_LANES: ReadonlyArray<{ type: string; label: string; x: number; width: number }>;
export const LEGACY_RELATION_BOUNDARY: Readonly<Record<string, string>>;
export const TYPED_RELATION_KINDS: readonly string[];
export const RELATION_REVIEWS: readonly string[];

export interface LegacyRelation extends GraphEdge {
  projectedProvenance?: string | null;
  declarations: Array<{ from: string; to: string; sourcePath?: string }>;
}

export function buildLegacyRelations(entities: Entity[], edges?: GraphEdge[]): LegacyRelation[];
export type Relation = LegacyRelation;
export interface RelationFilters {
  predicates?: string[];
  reviews?: string[];
  evidence?: "present" | "missing" | "";
  includeRejected?: boolean;
  includeOutOfValidity?: boolean;
  at?: Date | string;
}
export function buildRelations(entities: Entity[], edges?: GraphEdge[]): Relation[];
export function filterRelations(relations: Relation[], filters?: RelationFilters): Relation[];
export function relationIsCurrent(relation: GraphEdge, at?: Date | string): boolean;
export function relationReferences(relations: LegacyRelation[], entityId: string): { outgoing: Array<{ relation: LegacyRelation; otherId: string; direction: "outgoing" }>; incoming: Array<{ relation: LegacyRelation; otherId: string; direction: "incoming" }> };
export function relationTrail(relations: LegacyRelation[], entityId: string): Array<{ relation: LegacyRelation; otherId: string; direction: "outgoing" | "incoming" | "mutual"; outgoing: boolean; incoming: boolean }>;
export interface GraphNeighborhoodOptions {
  retainIds?: string[];
  maxNodes?: number;
}
export interface GraphNeighborhood {
  nodes: GraphNode[];
  relations: Relation[];
  distances: Map<string, number | null>;
  hiddenNodeCount: number;
  frontierIds: string[];
}
export interface GraphBox { x: number; y: number; width: number; height: number }
export function focusNeighborhood(nodes: GraphNode[], relations: Relation[], focusId: string, depth?: number, options?: GraphNeighborhoodOptions): GraphNeighborhood;
export function chooseFocusNode(nodes: GraphNode[], relations: LegacyRelation[], preferredId?: string | null): string | null;
export function shortestPath(nodes: GraphNode[], relations: LegacyRelation[], startId: string, targetId: string, options?: RelationFilters & { mode?: "directed" | "undirected" }): { nodeIds: string[]; relationIds: string[] } | null;
export function expandGraphNeighborhood(nodes: GraphNode[], relations: Relation[], visibleIds: string[], options?: GraphNeighborhoodOptions & { fromIds?: string[] }): { nodeIds: string[]; addedIds: string[]; frontierIds: string[]; hiddenNodeCount: number };
export function layoutFocusGraph(nodes: GraphNode[], relations: Relation[], focusId: string, depth?: number, options?: GraphNeighborhoodOptions): GraphNeighborhood & { positions: Map<string, GraphBox>; width: number; height: number };
export function suggestRelatedRecords(nodes: GraphNode[], relations: Relation[], focusId: string, options?: { at?: Date | string; limit?: number }): Array<{ node: GraphNode; sharedTags: string[]; sharedNeighborIds: string[] }>;
export function rankWorkstreams(workstreams: Workstream[]): Workstream[];
export function layoutAtlas(nodes: GraphNode[]): { nodes: GraphNode[]; positions: Map<string, { x: number; y: number; width: number; height: number }>; lanes: typeof ATLAS_LANES; width: number; height: number };
export function viewAvailable(view: string, capabilities?: CapabilitySet): boolean;
export function isSyntheticDemo(entities: Entity[] | null | undefined): boolean;
export function academicContextCounts(entities: Entity[] | null | undefined): { projects: number; experience: number; researchIdeas: number; projectIdeas: number };
