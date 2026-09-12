export type EntityType = "profile" | "domain" | "project" | "idea" | "experience" | "person" | "journal" | "draft" | string;
export type IdeaKind = "research" | "project";

export interface EntitySection {
  title: string;
  level: number;
  body: string;
}

export interface Entity {
  id: string;
  type: EntityType;
  title: string;
  privacy: string;
  status: string;
  sources: string[];
  aliases: string[];
  tags: string[];
  links: string[];
  role?: string;
  ideaKind?: IdeaKind;
  updated: string;
  path: string;
  summary?: string;
  sectionTitles?: string[];
  sections?: EntitySection[];
  body?: string;
  parentId?: string;
  submission?: {
    projectTitle?: string;
    projectDescription?: string;
    advisorHelp?: string;
  };
}

export interface Workstream extends Entity {
  linkedEntities: string[];
  linkedPeople: string[];
  attention: string[];
  nextAction: string | null;
}

export interface ReviewItem {
  id: string;
  title: string;
  parentId?: string;
  entityId?: string;
  kind: string;
  state: string;
  privacy: string;
  updated: string;
  path: string;
}

export interface CapabilitySet {
  readOnly?: boolean;
  writes?: boolean;
  emailSend?: boolean;
  operations?: boolean;
  restricted?: boolean;
  sources?: boolean;
}

export interface GraphNode {
  id: string;
  type: EntityType;
  title: string;
  privacy: string;
  status: string;
  tags: string[];
  incomingCount: number;
  outgoingCount: number;
  neighborCount: number;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  kind: string;
  provenance: string;
  declaredBy: string;
  sourcePath: string;
  semanticStatus: string;
  evidence: string;
  review: string;
  privacy: string;
  declarations?: Array<{ from: string; to: string; sourcePath?: string }>;
}

export interface DashboardSnapshot {
  schemaVersion: number;
  revision: string;
  generatedAt: string;
  entities: Entity[];
  counts: {
    total: number;
    byType: Record<string, number>;
    byIdeaKind?: Record<string, number>;
    byStatus?: Record<string, number>;
    reviewItems?: number;
    workstreams?: number;
    excluded?: Record<string, number>;
  };
  capabilities: CapabilitySet;
  boundaries: Record<string, string | boolean>;
  reviewItems: ReviewItem[];
  workstreams: Workstream[];
  operations: Array<Record<string, unknown>>;
  graph: { nodes: GraphNode[]; edges: GraphEdge[]; adjacency?: Record<string, unknown> };
}

export interface RepoStatus {
  root?: string;
  revision: string;
  branch?: string | null;
  dirty: boolean;
  canonicalSource?: string;
}

export type SearchScope = "all" | "person" | "project" | "idea" | "experience" | "domain" | "draft";
