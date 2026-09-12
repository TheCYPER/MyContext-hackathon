export const ATLAS_LANES = Object.freeze([
  { type: "domain", label: "Domains", x: 36, width: 176 },
  { type: "idea", label: "Ideas", x: 244, width: 196 },
  { type: "project", label: "Projects", x: 472, width: 196 },
  { type: "experience", label: "Experience", x: 700, width: 196 },
  { type: "person", label: "People", x: 928, width: 196 },
  { type: "profile", label: "Profile", x: 1156, width: 176 },
  { type: "journal", label: "Journal", x: 1364, width: 196 },
  { type: "draft", label: "Drafts", x: 1592, width: 196 },
]);

const STATUS_ORDER = Object.freeze({ active: 0, draft: 1, archived: 2 });
const TYPE_ORDER = Object.freeze({ idea: 0, project: 1, experience: 2, person: 3, domain: 4,
  profile: 5, draft: 6, journal: 7 });

export const LEGACY_RELATION_BOUNDARY = Object.freeze({
  kind: "related_to",
  label: "Legacy canonical link",
  evidence: "reason_not_structured",
  review: "not_represented",
});

export const TYPED_RELATION_KINDS = Object.freeze([
  "participates_in", "part_of", "about", "motivated_by", "supports",
  "contradicts", "supersedes",
]);

export const RELATION_REVIEWS = Object.freeze(["unreviewed", "confirmed", "rejected"]);

function array(value) {
  return Array.isArray(value) ? value : [];
}

function timestamp(value) {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function pairKey(left, right) {
  return [String(left), String(right)].sort().join("\0");
}

function compareNodes(left, right) {
  return (TYPE_ORDER[left?.type] ?? 9) - (TYPE_ORDER[right?.type] ?? 9) ||
    String(left?.title || left?.id).localeCompare(String(right?.title || right?.id)) ||
    String(left?.id).localeCompare(String(right?.id));
}

function compareRelations(left, right) {
  return String(left.id).localeCompare(String(right.id));
}

/**
 * Turn existing frontmatter `links` into an explicitly low-semantics relation
 * index. Direction means only "record A declared a link to record B". It must
 * never be read as causality, endorsement, research fit, or reviewed evidence.
 */
export function buildLegacyRelations(entities, projectedEdges = []) {
  const visibleEntities = array(entities).filter((entity) => entity?.id);
  const entityById = new Map(visibleEntities.map((entity) => [entity.id, entity]));
  const projectedByPair = new Map();

  for (const edge of array(projectedEdges)) {
    if (!entityById.has(edge?.from) || !entityById.has(edge?.to)) continue;
    const key = pairKey(edge.from, edge.to);
    if (!projectedByPair.has(key)) projectedByPair.set(key, edge);
  }

  const relationByPair = new Map();
  for (const source of visibleEntities.slice().sort(compareNodes)) {
    const targets = [...new Set(array(source.links).filter((id) =>
      id !== source.id && entityById.has(id)))].sort();
    for (const targetId of targets) {
      const key = pairKey(source.id, targetId);
      const [from, to] = [source.id, targetId].sort();
      const projected = projectedByPair.get(key);
      let relation = relationByPair.get(key);
      if (!relation) {
        const target = entityById.get(targetId);
        relation = {
          id: projected?.id || `legacy.${encodeURIComponent(from)}.${encodeURIComponent(to)}`,
          from,
          to,
          kind: LEGACY_RELATION_BOUNDARY.kind,
          semanticStatus: "untyped",
          provenance: "legacy_link",
          projectedProvenance: projected?.provenance || null,
          evidence: LEGACY_RELATION_BOUNDARY.evidence,
          review: LEGACY_RELATION_BOUNDARY.review,
          privacy: [source.privacy, target?.privacy, projected?.privacy]
            .includes("private") ? "private" : "public",
          declarations: [],
        };
        relationByPair.set(key, relation);
      }
      relation.declarations.push({ from: source.id, to: targetId });
    }
  }

  return [...relationByPair.values()].map((relation) => ({
    ...relation,
    declarations: relation.declarations.slice().sort((left, right) =>
      `${left.from}\0${left.to}`.localeCompare(`${right.from}\0${right.to}`)),
  })).sort(compareRelations);
}

/**
 * Build the complete projected relation set. Typed assertions are authoritative
 * and remain directed, including parallel predicates and independently sourced
 * assertions between the same records. Legacy `links` keep their historical
 * pair-level behavior for older snapshots.
 */
export function buildRelations(entities, projectedEdges = []) {
  const visibleIds = new Set(array(entities).map((entity) => entity?.id).filter(Boolean));
  const typed = [];
  const projectedLegacy = [];

  for (const edge of array(projectedEdges)) {
    if (!edge?.id || !visibleIds.has(edge.from) || !visibleIds.has(edge.to) || edge.from === edge.to) continue;
    const isTyped = edge.semanticStatus === "typed" || TYPED_RELATION_KINDS.includes(edge.kind);
    if (!isTyped) {
      projectedLegacy.push(edge);
      continue;
    }
    if (!TYPED_RELATION_KINDS.includes(edge.kind)) continue;
    typed.push({
      ...edge,
      semanticStatus: "typed",
      provenance: edge.provenance || "frontmatter.relations",
      review: RELATION_REVIEWS.includes(edge.review) ? edge.review : "unreviewed",
      evidence: edge.evidence ?? null,
      sources: array(edge.sources),
      declarations: array(edge.declarations).length
        ? array(edge.declarations).map(({ from, to }) => ({ from, to }))
        : [{ from: edge.from, to: edge.to }],
    });
  }

  return [...buildLegacyRelations(entities, projectedLegacy), ...typed].sort(compareRelations);
}

export function relationIsCurrent(relation, at = new Date()) {
  const instant = at instanceof Date ? at.getTime() : Date.parse(at);
  const now = Number.isFinite(instant) ? instant : Date.now();
  const starts = relation?.validFrom ? Date.parse(relation.validFrom) : NaN;
  let ends = relation?.validTo ? Date.parse(relation.validTo) : NaN;
  if (Number.isFinite(ends) && /^\d{4}-\d{2}-\d{2}$/.test(relation.validTo)) ends += 86_400_000 - 1;
  return (!Number.isFinite(starts) || starts <= now) && (!Number.isFinite(ends) || ends >= now);
}

export function filterRelations(relations, filters = {}) {
  const predicates = new Set(array(filters.predicates));
  const reviews = new Set(array(filters.reviews));
  return array(relations).filter((relation) => {
    if (predicates.size && !predicates.has(relation.kind)) return false;
    if (reviews.size && !reviews.has(relation.review)) return false;
    const hasEvidence = relation.evidence !== null && relation.evidence !== undefined &&
      relation.evidence !== "" && relation.evidence !== LEGACY_RELATION_BOUNDARY.evidence;
    if (filters.evidence === "present" && !hasEvidence) return false;
    if (filters.evidence === "missing" && hasEvidence) return false;
    if (!filters.includeRejected && relation.review === "rejected") return false;
    if (!filters.includeOutOfValidity && !relationIsCurrent(relation, filters.at)) return false;
    return true;
  }).sort(compareRelations);
}

export function relationReferences(relations, entityId) {
  const outgoing = [];
  const incoming = [];
  for (const relation of array(relations)) {
    const declarations = array(relation.declarations).length
      ? array(relation.declarations) : [{ from: relation.from, to: relation.to }];
    for (const declaration of declarations) {
      if (declaration.from === entityId) {
        outgoing.push({ relation, otherId: declaration.to, direction: "outgoing" });
      }
      if (declaration.to === entityId) {
        incoming.push({ relation, otherId: declaration.from, direction: "incoming" });
      }
    }
  }
  const compare = (left, right) => String(left.otherId).localeCompare(String(right.otherId)) ||
    compareRelations(left.relation, right.relation);
  return { outgoing: outgoing.sort(compare), incoming: incoming.sort(compare) };
}

export function relationTrail(relations, entityId) {
  const byOther = new Map();
  const references = relationReferences(relations, entityId);
  for (const reference of [...references.outgoing, ...references.incoming]) {
    const key = `${reference.relation.id}\0${reference.otherId}`;
    const current = byOther.get(key) || {
      otherId: reference.otherId,
      relation: reference.relation,
      outgoing: false,
      incoming: false,
    };
    current[reference.direction] = true;
    byOther.set(key, current);
  }
  return [...byOther.values()].map((item) => ({
    ...item,
    direction: item.incoming && item.outgoing ? "mutual" : item.outgoing ? "outgoing" : "incoming",
  })).sort((left, right) => String(left.otherId).localeCompare(String(right.otherId)) ||
    compareRelations(left.relation, right.relation));
}

export function focusNeighborhood(nodes, relations, focusId, depth = 1) {
  const visibleNodes = array(nodes).filter((node) => node?.id);
  const nodeById = new Map(visibleNodes.map((node) => [node.id, node]));
  if (!nodeById.has(focusId)) return { nodes: [], relations: [], distances: new Map() };

  const adjacency = new Map(visibleNodes.map((node) => [node.id, []]));
  const validRelations = array(relations).filter((relation) =>
    nodeById.has(relation?.from) && nodeById.has(relation?.to));
  for (const relation of validRelations) {
    adjacency.get(relation.from).push({ id: relation.to, relation });
    adjacency.get(relation.to).push({ id: relation.from, relation });
  }
  for (const neighbors of adjacency.values()) {
    neighbors.sort((left, right) => String(left.id).localeCompare(String(right.id)) ||
      compareRelations(left.relation, right.relation));
  }

  const numericDepth = Number(depth);
  const boundedDepth = Number.isFinite(numericDepth)
    ? Math.max(0, Math.min(2, Math.floor(numericDepth))) : 1;
  const distances = new Map([[focusId, 0]]);
  const queue = [focusId];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];
    const currentDistance = distances.get(current);
    if (currentDistance >= boundedDepth) continue;
    for (const neighbor of adjacency.get(current)) {
      if (distances.has(neighbor.id)) continue;
      distances.set(neighbor.id, currentDistance + 1);
      queue.push(neighbor.id);
    }
  }

  const included = new Set(distances.keys());
  return {
    nodes: visibleNodes.filter((node) => included.has(node.id)).sort((left, right) =>
      distances.get(left.id) - distances.get(right.id) || compareNodes(left, right)),
    // The aperture shows links that cross from one BFS ring to the next. Links
    // within the same ring remain available in the global overview; drawing
    // them here would turn a focused neighborhood into a misleading hairball.
    relations: validRelations.filter((relation) => included.has(relation.from) &&
      included.has(relation.to) &&
      Math.abs(distances.get(relation.from) - distances.get(relation.to)) === 1)
      .sort(compareRelations),
    distances,
  };
}

export function chooseFocusNode(nodes, relations, preferredId = null) {
  const visibleNodes = array(nodes).filter((node) => node?.id);
  if (preferredId && visibleNodes.some((node) => node.id === preferredId)) return preferredId;
  // Focus the record with the broadest neighborhood; several assertions about
  // the same pair should not outweigh connections to distinct records.
  const neighbors = new Map(visibleNodes.map((node) => [node.id, new Set()]));
  for (const relation of array(relations)) {
    if (relation?.from !== relation?.to && neighbors.has(relation?.from) && neighbors.has(relation?.to)) {
      neighbors.get(relation.from).add(relation.to);
      neighbors.get(relation.to).add(relation.from);
    }
  }
  return visibleNodes.slice().sort((left, right) =>
    neighbors.get(right.id).size - neighbors.get(left.id).size || compareNodes(left, right))[0]?.id || null;
}

export function shortestPath(nodes, relations, startId, targetId, options = {}) {
  const nodeIds = new Set(array(nodes).map((node) => node?.id).filter(Boolean));
  if (!nodeIds.has(startId) || !nodeIds.has(targetId)) return null;
  if (startId === targetId) return { nodeIds: [startId], relationIds: [] };

  const adjacency = new Map([...nodeIds].map((id) => [id, []]));
  const mode = options.mode === "directed" ? "directed" : "undirected";
  const candidates = filterRelations(relations, options);
  for (const relation of candidates) {
    if (!nodeIds.has(relation?.from) || !nodeIds.has(relation?.to)) continue;
    if (mode === "directed" && relation.semanticStatus !== "typed") continue;
    adjacency.get(relation.from).push({ id: relation.to, relationId: relation.id, direction: "forward" });
    if (mode === "undirected") adjacency.get(relation.to).push({ id: relation.from, relationId: relation.id, direction: "reverse" });
  }
  for (const neighbors of adjacency.values()) {
    neighbors.sort((left, right) => String(left.id).localeCompare(String(right.id)) ||
      String(left.relationId).localeCompare(String(right.relationId)));
  }

  const previous = new Map([[startId, null]]);
  const queue = [startId];
  for (let cursor = 0; cursor < queue.length && !previous.has(targetId); cursor += 1) {
    const current = queue[cursor];
    for (const neighbor of adjacency.get(current)) {
      if (previous.has(neighbor.id)) continue;
      previous.set(neighbor.id, { id: current, relationId: neighbor.relationId, direction: neighbor.direction });
      queue.push(neighbor.id);
    }
  }
  if (!previous.has(targetId)) return null;

  const nodeIdsInPath = [];
  const relationIds = [];
  let current = targetId;
  while (current) {
    nodeIdsInPath.push(current);
    const step = previous.get(current);
    if (!step) break;
    relationIds.push(step.relationId);
    current = step.id;
  }
  return { nodeIds: nodeIdsInPath.reverse(), relationIds: relationIds.reverse() };
}

export function layoutFocusGraph(nodes, relations, focusId, depth = 1) {
  const neighborhood = focusNeighborhood(nodes, relations, focusId, depth);
  const firstRingCount = neighborhood.nodes.filter((node) =>
    neighborhood.distances.get(node.id) === 1).length;
  const secondRingCount = neighborhood.nodes.filter((node) =>
    neighborhood.distances.get(node.id) === 2).length;
  const expanded = secondRingCount > 0;
  // Preserve the original layout for small neighborhoods; give denser rings
  // enough circumference for their labels and keep the outer ring clear.
  const innerRadiusX = Math.max(expanded ? 360 : 310,
    firstRingCount > 10 ? firstRingCount * 170 * 1.5 / (2 * Math.PI) : 0);
  const innerRadiusY = Math.max(expanded ? 240 : 215,
    firstRingCount > 10 ? firstRingCount * 64 * 1.5 / (2 * Math.PI) : 0);
  const outerRadiusX = Math.max(570, innerRadiusX + 210,
    secondRingCount * 150 * 1.5 / (2 * Math.PI));
  const outerRadiusY = Math.max(350, innerRadiusY + 110,
    secondRingCount * 64 * 1.5 / (2 * Math.PI));
  const width = expanded ? Math.max(1420, 1180 + secondRingCount * 30, outerRadiusX * 2 + 220)
    : Math.max(1100, innerRadiusX * 2 + 220);
  const height = expanded ? Math.max(900, 760 + secondRingCount * 18, outerRadiusY * 2 + 160)
    : Math.max(680, innerRadiusY * 2 + 160);
  const center = { x: width / 2, y: height / 2 };
  const positions = new Map();
  const focus = neighborhood.nodes.find((node) => node.id === focusId);
  if (!focus) return { ...neighborhood, positions, width, height };

  positions.set(focusId, { x: center.x - 110, y: center.y - 39, width: 220, height: 78 });
  for (const ring of [1, 2]) {
    const ringNodes = neighborhood.nodes.filter((node) => neighborhood.distances.get(node.id) === ring)
      .sort(compareNodes);
    const radiusX = ring === 1 ? innerRadiusX : outerRadiusX;
    const radiusY = ring === 1 ? innerRadiusY : outerRadiusY;
    const nodeWidth = ring === 1 ? 170 : 150;
    const nodeHeight = 64;
    const phase = ring === 2 && ringNodes.length > 1 ? Math.PI / ringNodes.length : 0;
    ringNodes.forEach((node, index) => {
      const angle = -Math.PI / 2 + phase +
        (Math.PI * 2 * index) / Math.max(1, ringNodes.length);
      positions.set(node.id, {
        x: center.x + Math.cos(angle) * radiusX - nodeWidth / 2,
        y: center.y + Math.sin(angle) * radiusY - nodeHeight / 2,
        width: nodeWidth,
        height: nodeHeight,
      });
    });
  }
  return { ...neighborhood, positions, width, height };
}

export function rankWorkstreams(workstreams) {
  return array(workstreams).slice().sort((left, right) => {
    const comparisons = [
      (STATUS_ORDER[left.status] ?? 9) - (STATUS_ORDER[right.status] ?? 9),
      Number(Boolean(right.nextAction)) - Number(Boolean(left.nextAction)),
      array(right.attention).length - array(left.attention).length,
      array(right.linkedPeople).length - array(left.linkedPeople).length,
      timestamp(right.updated) - timestamp(left.updated),
      String(left.title || left.id).localeCompare(String(right.title || right.id)),
    ];
    return comparisons.find((value) => value !== 0) || 0;
  });
}

export function layoutAtlas(nodes) {
  const supported = array(nodes).filter((node) =>
    ATLAS_LANES.some((lane) => lane.type === node?.type));
  const positions = new Map();
  let longestLane = 0;
  let nextX = 36;
  const populatedTypes = new Set(supported.map((node) => node.type));
  const lanes = ATLAS_LANES.filter((lane) => populatedTypes.has(lane.type)).map((lane) => {
    const compact = { ...lane, x: nextX };
    nextX += lane.width + 32;
    return compact;
  });

  for (const lane of lanes) {
    const laneNodes = supported.filter((node) => node.type === lane.type)
      .sort((left, right) => String(left.title || left.id)
        .localeCompare(String(right.title || right.id)));
    longestLane = Math.max(longestLane, laneNodes.length);
    laneNodes.forEach((node, index) => {
      positions.set(node.id, {
        x: lane.x,
        y: 58 + index * 74,
        width: lane.width,
        height: node.type === "person" ? 58 : 56,
      });
    });
  }

  return {
    nodes: supported,
    positions,
    lanes,
    width: Math.max(320, nextX + 4),
    height: Math.max(410, 58 + longestLane * 74 + 28),
  };
}

/** A missing or non-boolean capability never enables an unsupported view. */
export function viewAvailable(view, capabilities) {
  return view !== "runs" || capabilities?.operations === true;
}

/** Label only a wholly synthetic seed, never an empty or mixed personal vault. */
export function isSyntheticDemo(entities) {
  return Array.isArray(entities) && entities.length > 0 && entities.every((entity) =>
    Array.isArray(entity?.sources) && entity.sources.length === 1 &&
    entity.sources[0] === "demo:fictional");
}

export function academicContextCounts(entities) {
  const records = array(entities);
  return {
    projects: records.filter((entity) => entity?.type === "project").length,
    experience: records.filter((entity) => entity?.type === "experience").length,
    researchIdeas: records.filter((entity) => entity?.type === "idea" && entity.ideaKind === "research").length,
    projectIdeas: records.filter((entity) => entity?.type === "idea" && entity.ideaKind === "project").length,
  };
}
