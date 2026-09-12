import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { ATLAS_LANES, buildLegacyRelations, buildRelations, chooseFocusNode, filterRelations, focusNeighborhood, layoutAtlas,
  layoutFocusGraph, expandGraphNeighborhood, suggestRelatedRecords, rankWorkstreams, relationReferences, relationTrail,
  academicContextCounts, isSyntheticDemo, relationIsCurrent, viewAvailable, shortestPath } from "../public/model.mjs";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const DASHBOARD_DIR = path.resolve(TEST_DIR, "..");

test("workstream rank is derived only from projected fields", () => {
  const ranked = rankWorkstreams([
    { id: "project.future", title: "Future", status: "active", attention: [], linkedPeople: [] },
    { id: "project.action", title: "Action", status: "active", nextAction: "Review it", attention: [], linkedPeople: [] },
    { id: "project.archived", title: "Archived", status: "archived", nextAction: "Old", attention: ["Risk"], linkedPeople: ["person.a"] },
  ]);

  assert.deepEqual(ranked.map((item) => item.id), [
    "project.action",
    "project.future",
    "project.archived",
  ]);
});

test("atlas layout includes every supported node without an ID allowlist", () => {
  const nodes = [
    { id: "domain.new", type: "domain", title: "New domain" },
    { id: "idea.research.future", type: "idea", title: "Future research" },
    { id: "project.mycontext-margin", type: "project", title: "Margin" },
    { id: "project.future", type: "project", title: "Future" },
    { id: "experience.studio", type: "experience", title: "Studio internship" },
    { id: "person.new", type: "person", title: "New person" },
    { id: "profile.summary", type: "profile", title: "Profile" },
    { id: "journal.2026-09-12", type: "journal", title: "Experiment event" },
    { id: "draft.review", type: "draft", title: "Draft note" },
  ];
  const layout = layoutAtlas(nodes);

  assert.deepEqual(layout.nodes.map((node) => node.id).sort(), nodes.map((node) => node.id).sort());
  assert.equal(layout.positions.size, nodes.length);
  assert.notDeepEqual(layout.positions.get("project.future"), layout.positions.get("project.mycontext-margin"));
  assert.equal(ATLAS_LANES.length, 8);
  assert.equal(ATLAS_LANES.some((lane) => lane.type === "idea"), true);
  assert.equal(ATLAS_LANES.some((lane) => lane.type === "experience"), true);
  assert.ok(layout.positions.has("experience.studio"));
  assert.ok(layout.positions.has("journal.2026-09-12"));
  assert.ok(layout.positions.has("draft.review"));
  assert.ok(layout.height >= 410);
});

test("legacy links preserve declarations while refusing invented semantics", () => {
  const entities = [
    { id: "project.a", type: "project", title: "A", privacy: "private", links: ["person.b", "domain.c"] },
    { id: "person.b", type: "person", title: "B", privacy: "private", links: ["project.a"] },
    { id: "domain.c", type: "domain", title: "C", privacy: "public", links: [] },
    { id: "draft.hidden", type: "draft", title: "Draft", privacy: "private", links: ["person.b"] },
  ];
  const relations = buildLegacyRelations(entities, [
    { id: "edge.ab", from: "person.b", to: "project.a", provenance: "type_pair", privacy: "private" },
  ]);
  const betweenAB = relations.find((relation) => relation.id === "edge.ab");

  assert.equal(betweenAB.kind, "related_to");
  assert.equal(betweenAB.semanticStatus, "untyped");
  assert.equal(betweenAB.provenance, "legacy_link");
  assert.equal(betweenAB.evidence, "reason_not_structured");
  assert.equal(betweenAB.review, "not_represented");
  assert.deepEqual(betweenAB.declarations, [
    { from: "person.b", to: "project.a" },
    { from: "project.a", to: "person.b" },
  ]);
  assert.equal(relations.some((relation) => relation.kind === "research_fit"), false);

  const references = relationReferences(relations, "person.b");
  assert.deepEqual(references.outgoing.map((item) => item.otherId), ["project.a"]);
  assert.deepEqual(references.incoming.map((item) => item.otherId), ["draft.hidden", "project.a"]);
  assert.deepEqual(relationTrail(relations, "person.b").map(({ otherId, direction }) =>
    [otherId, direction]), [["draft.hidden", "incoming"], ["project.a", "mutual"]]);
});

test("unified relations preserve typed direction, parallel predicates, assertions, and legacy links", () => {
  const entities = [
    { id: "project.a", type: "project", title: "A", links: ["idea.b"] },
    { id: "idea.b", type: "idea", title: "B", links: [] },
  ];
  const edges = [
    { id: "legacy.a.b", from: "idea.b", to: "project.a", kind: "related_to", semanticStatus: "untyped" },
    { id: "relation.a.b.about.1", from: "project.a", to: "idea.b", kind: "about", semanticStatus: "typed",
      declaredBy: "project.a", sourcePath: "projects/a.md", evidence: "journal:event-1", sources: ["doi:1"], review: "confirmed",
      validFrom: "2026-01-01", declarations: [{ from: "project.a", to: "idea.b" }] },
    { id: "relation.a.b.supports.1", from: "project.a", to: "idea.b", kind: "supports", semanticStatus: "typed",
      review: "unreviewed", sourcePath: "projects/a.md", evidence: "results/table-2" },
    { id: "relation.b.a.contradicts.1", from: "idea.b", to: "project.a", kind: "contradicts", semanticStatus: "typed",
      review: "rejected", sourcePath: "ideas/b.md" },
  ];
  const relations = buildRelations(entities, edges);

  assert.deepEqual(relations.map((relation) => relation.id), [
    "legacy.a.b", "relation.a.b.about.1", "relation.a.b.supports.1", "relation.b.a.contradicts.1",
  ]);
  const about = relations.find((relation) => relation.kind === "about");
  assert.equal(about.from, "project.a");
  assert.equal(about.to, "idea.b");
  assert.equal(about.provenance, "frontmatter.relations");
  assert.equal(about.sourcePath, "projects/a.md");
  assert.equal(about.evidence, "journal:event-1");
  assert.deepEqual(about.sources, ["doi:1"]);
  assert.deepEqual(relationTrail(relations, "project.a").map((item) => [item.relation.kind, item.direction]), [
    ["related_to", "outgoing"], ["about", "outgoing"], ["supports", "outgoing"], ["contradicts", "incoming"],
  ]);
});

test("relation filters and paths default to current non-rejected assertions", () => {
  const now = "2026-09-12T12:00:00Z";
  const nodes = ["a", "b", "c"].map((id) => ({ id, type: "project", title: id }));
  const relations = [
    { id: "ab", from: "a", to: "b", kind: "supports", semanticStatus: "typed", review: "confirmed", evidence: "journal:event", validFrom: "2026-01-01" },
    { id: "ba", from: "b", to: "a", kind: "about", semanticStatus: "typed", review: "unreviewed" },
    { id: "bc-rejected", from: "b", to: "c", kind: "supports", semanticStatus: "typed", review: "rejected" },
    { id: "bc-expired", from: "b", to: "c", kind: "supersedes", semanticStatus: "typed", review: "confirmed", validTo: "2025-12-31" },
  ];
  assert.equal(relationIsCurrent(relations[0], now), true);
  assert.equal(relationIsCurrent(relations[3], now), false);
  assert.deepEqual(filterRelations(relations, { at: now }).map((relation) => relation.id), ["ab", "ba"]);
  assert.deepEqual(filterRelations(relations, { at: now, evidence: "present" }).map((relation) => relation.id), ["ab"]);
  assert.deepEqual(filterRelations(relations, { at: now, evidence: "missing" }).map((relation) => relation.id), ["ba"]);
  assert.equal(shortestPath(nodes, relations, "a", "c", { mode: "undirected", at: now }), null);
  assert.deepEqual(shortestPath(nodes, relations, "a", "b", { mode: "directed", at: now }), {
    nodeIds: ["a", "b"], relationIds: ["ab"],
  });
  assert.deepEqual(shortestPath(nodes, relations, "b", "a", { mode: "directed", at: now }), {
    nodeIds: ["b", "a"], relationIds: ["ba"],
  });
  assert.equal(shortestPath(nodes, [relations[0]], "b", "a", { mode: "directed", at: now }), null);
});

test("focus neighborhood and layout are deterministic at one and two hops", () => {
  const nodes = [
    { id: "project.a", type: "project", title: "A" },
    { id: "person.b", type: "person", title: "B" },
    { id: "domain.c", type: "domain", title: "C" },
    { id: "project.d", type: "project", title: "D" },
    { id: "profile.e", type: "profile", title: "E" },
  ];
  const relations = [
    { id: "ab", from: "project.a", to: "person.b" },
    { id: "ac", from: "project.a", to: "domain.c" },
    { id: "bc", from: "person.b", to: "domain.c" },
    { id: "bd", from: "person.b", to: "project.d" },
  ];
  const oneHop = focusNeighborhood(nodes, relations, "project.a", 1);
  const twoHop = focusNeighborhood(nodes, relations, "project.a", 2);

  assert.deepEqual(oneHop.nodes.map((node) => node.id), ["project.a", "person.b", "domain.c"]);
  assert.deepEqual(twoHop.nodes.map((node) => node.id), ["project.a", "person.b", "domain.c", "project.d"]);
  assert.equal(twoHop.distances.get("project.d"), 2);
  assert.equal(twoHop.nodes.some((node) => node.id === "profile.e"), false);
  assert.equal(oneHop.relations.some((relation) => relation.id === "bc"), true);

  const first = layoutFocusGraph(nodes, relations, "project.a", 2);
  const second = layoutFocusGraph(nodes.slice().reverse(), relations.slice().reverse(), "project.a", 2);
  assert.deepEqual([...first.positions], [...second.positions]);
  const focusBox = first.positions.get("project.a");
  assert.equal(focusBox.x + focusBox.width / 2, first.width / 2);
  assert.equal(focusBox.y + focusBox.height / 2, first.height / 2);
});

test("expanded focus layout keeps dense two-hop nodes and text boxes apart", () => {
  const nodes = [{ id: "focus", type: "project", title: "Focus" }];
  const relations = [];
  for (let index = 0; index < 9; index += 1) {
    const first = `first-${index}`;
    nodes.push({ id: first, type: "project", title: `First ${index}` });
    relations.push({ id: `focus-${index}`, from: "focus", to: first });
    if (index < 8) {
      const second = `second-${index}`;
      nodes.push({ id: second, type: "person", title: `Second ${index}` });
      relations.push({ id: `second-link-${index}`, from: first, to: second });
    }
  }

  const layout = layoutFocusGraph(nodes, relations, "focus", 2);
  const boxes = [...layout.positions.entries()];
  for (let leftIndex = 0; leftIndex < boxes.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < boxes.length; rightIndex += 1) {
      const [leftId, left] = boxes[leftIndex];
      const [rightId, right] = boxes[rightIndex];
      const overlaps = left.x < right.x + right.width && left.x + left.width > right.x &&
        left.y < right.y + right.height && left.y + left.height > right.y;
      assert.equal(overlaps, false, `${leftId} overlaps ${rightId}`);
    }
  }
  for (const [id, box] of boxes) {
    if (id !== "focus") assert.ok(box.height >= 64, `${id} cannot fit two title lines and metadata`);
  }
});

test("focus selection and shortest paths use stable graph ordering", () => {
  const nodes = ["a", "b", "c", "d", "isolated"].map((id) => ({
    id, type: "project", title: id.toUpperCase(),
  }));
  const relations = [
    { id: "ac", from: "a", to: "c" },
    { id: "cd", from: "c", to: "d" },
    { id: "ab", from: "a", to: "b" },
    { id: "bd", from: "b", to: "d" },
  ];

  assert.equal(chooseFocusNode(nodes, relations), "a");
  assert.equal(chooseFocusNode(nodes, relations, "d"), "d");
  assert.deepEqual(shortestPath(nodes, relations, "a", "d"), {
    nodeIds: ["a", "b", "d"], relationIds: ["ab", "bd"],
  });
  assert.equal(shortestPath(nodes, relations, "a", "isolated"), null);
});

test("frontend keeps projection and mobile review boundaries explicit", async () => {
  const [app, html, css, server] = await Promise.all([
    readFile(path.join(DASHBOARD_DIR, "public/app.js"), "utf8"),
    readFile(path.join(DASHBOARD_DIR, "public/index.html"), "utf8"),
    readFile(path.join(DASHBOARD_DIR, "public/styles.css"), "utf8"),
    readFile(path.join(DASHBOARD_DIR, "server.mjs"), "utf8"),
  ]);

  assert.doesNotMatch(app, /ATLAS_POSITIONS|EDGE_LABELS|CURRENT_FOCUS/);
  assert.doesNotMatch(app, /research_fit|worked_on|builds_on/);
  assert.match(app, /role: "group"/);
  assert.match(app, /aperture-frame/);
  assert.match(app, /reason not structured/i);
  assert.match(app, /Incoming declarations/);
  assert.match(app, /shortestPath/);
  assert.match(app, /layoutFocusGraph/);
  assert.match(app, /renderViewAndFocus/);
  assert.match(app, /data-relation-id/);
  assert.match(app, /Revealed records/);
  assert.match(app, /recorded connections/);
  assert.match(app, /reverse \?/);
  assert.match(app, /buildRelations/);
  assert.match(app, /Follow typed arrows/);
  assert.match(app, /frontmatter/);
  assert.match(app, /includeOutOfValidity/);
  assert.match(app, /sourcePath/);
  assert.match(app, /revision_changed/);
  assert.match(app, /bindGraphPanZoom/);
  assert.match(app, /Find a record/);
  assert.match(app, /experience: \(\) => renderRecordsView\("experience"\)/);
  assert.match(app, /ideas: renderIdeasView/);
  assert.match(app, /Research ideas/);
  assert.match(app, /Project ideas/);
  assert.match(app, /Project description/);
  assert.match(app, /Advisor help/);
  assert.match(app, /Work experiences/);
  assert.match(app, /not finalized, signed, sent, or otherwise recorded as used/);
  assert.match(app, /dom\.skipLink\.inert = true/);
  assert.match(app, /setAttribute\("aria-modal", "true"\)/);
  assert.match(html, /draft record/);
  assert.match(html, /data-view="experience"/);
  assert.match(html, /data-view="ideas"/);
  assert.match(html, /data-view="runs" hidden/);
  assert.match(app, /viewAvailable\(view, state\.snapshot\?\.capabilities\)/);
  assert.match(app, /viewAvailable\("runs", state\.snapshot\?\.capabilities\)/);
  assert.match(app, /dom\.demoLabel\.hidden = !isSyntheticDemo\(state\.entities\)/);
  assert.match(html, /option value="experience"/);
  assert.match(html, /option value="idea"/);
  assert.match(html, /option value="journal"/);
  assert.match(html, /tabindex="-1" aria-label="Close review margin"/);
  assert.match(css, /\.atlas-node\.is-experience/);
  assert.match(css, /\.atlas-node\.is-idea/);
  assert.match(css, /\.atlas-node\.is-journal/);
  assert.match(css, /\.aperture-edge\.is-typed/);
  assert.match(css, /\.idea-trajectory/);
  assert.match(server, /"\.mjs": "text\/javascript; charset=utf-8"/);
});

test("unsupported operations stay unavailable regardless of navigation entry point", () => {
  for (const capabilities of [undefined, {}, { operations: false }, { operations: "true" }]) {
    assert.equal(viewAvailable("runs", capabilities), false);
    for (const view of ["desk", "workstreams", "ideas", "people", "projects", "experience", "atlas", "system"]) {
      assert.equal(viewAvailable(view, capabilities), true);
    }
  }
  assert.equal(viewAvailable("runs", { operations: true }), true);
});

test("synthetic label requires a nonempty collection with exact fictional sources", () => {
  assert.equal(isSyntheticDemo([{ sources: ["demo:fictional"] }, { sources: ["demo:fictional"] }]), true);
  for (const entities of [undefined, [], [{}], [{ sources: [] }],
    [{ sources: ["demo:fictional"] }, { sources: ["user:confirmed"] }],
    [{ sources: ["demo:fictional", "user:confirmed"] }]]) {
    assert.equal(isSyntheticDemo(entities), false);
  }
});

test("academic navigation counts distinguish research ideas from proposed builds", () => {
  assert.deepEqual(academicContextCounts([
    { type: "project", status: "active" }, { type: "project", status: "archived" },
    { type: "experience" }, { type: "idea", ideaKind: "research" },
    { type: "idea", ideaKind: "project" }, { type: "idea", ideaKind: "research" },
    { type: "draft" }, { type: "journal" },
  ]), { projects: 2, experience: 1, researchIdeas: 2, projectIdeas: 1 });
  assert.deepEqual(academicContextCounts(null), { projects: 0, experience: 0, researchIdeas: 0, projectIdeas: 0 });
});

test("academic hubs keep dense one-hop and two-hop labels apart", () => {
  const nodes = [{ id: "project.hub", type: "project", title: "Experiment notes" }];
  const relations = [];
  for (let i = 0; i < 11; i += 1) {
    const id = `idea.${i}`;
    nodes.push({ id, type: "idea", title: `Research question ${i}` });
    relations.push({ id: `hub-${i}`, from: "project.hub", to: id });
    for (let j = 0; j < 3; j += 1) {
      const otherId = `person.${i}.${j}`;
      nodes.push({ id: otherId, type: "person", title: `Collaborator ${i}.${j}` });
      relations.push({ id: `other-${i}-${j}`, from: id, to: otherId });
    }
  }
  for (const depth of [1, 2]) {
    const layout = layoutFocusGraph(nodes, relations, "project.hub", depth);
    const boxes = [...layout.positions.entries()];
    assert.equal(boxes.length, depth === 1 ? 12 : 45);
    for (let i = 0; i < boxes.length; i += 1) {
      const [id, box] = boxes[i];
      assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= layout.width &&
        box.y + box.height <= layout.height, `${id} stays on the canvas`);
      for (let j = i + 1; j < boxes.length; j += 1) {
        const [otherId, other] = boxes[j];
        assert.equal(box.x < other.x + other.width && box.x + box.width > other.x &&
          box.y < other.y + other.height && box.y + box.height > other.y, false,
        `${id} overlaps ${otherId} at depth ${depth}`);
      }
    }
  }
});

test("filtered atlas collapses empty lanes and keeps remaining records readable", () => {
  const nodes = [
    { id: "person.a", type: "person", title: "A" },
    { id: "person.b", type: "person", title: "B" },
    { id: "journal.a", type: "journal", title: "A" },
  ];
  const layout = layoutAtlas(nodes);
  assert.deepEqual(layout.lanes.map((lane) => lane.type), ["person", "journal"]);
  assert.equal(layout.lanes[0].x, 36);
  assert.ok(layout.width < 600, "two populated columns should not reserve eight columns of space");
  for (const node of nodes) {
    const box = layout.positions.get(node.id);
    assert.ok(box.x >= 0 && box.x + box.width <= layout.width);
    assert.ok(box.y >= 0 && box.y + box.height <= layout.height);
  }
  const reversed = layoutAtlas(nodes.slice().reverse());
  assert.deepEqual([...layout.positions], [...reversed.positions]);
  assert.equal(ATLAS_LANES.find((lane) => lane.type === "person").x, 928,
    "compaction must not mutate the shared lane definitions");
  const empty = layoutAtlas([]);
  assert.deepEqual(empty.lanes, []);
  assert.ok(Number.isFinite(empty.width) && empty.width > 0);
});

test("focus depth zero isolates the selected record and invalid depth uses one hop", () => {
  const nodes = ["a", "b", "c"].map((id) => ({ id, type: "project", title: id }));
  const relations = [{ id: "ab", from: "a", to: "b" }, { id: "bc", from: "b", to: "c" }];
  for (const depth of [0, -1, "0"]) {
    const focused = focusNeighborhood(nodes, relations, "a", depth);
    assert.deepEqual(focused.nodes.map((node) => node.id), ["a"]);
    assert.deepEqual(focused.relations, []);
  }
  assert.deepEqual(focusNeighborhood(nodes, relations, "a", "invalid").nodes.map((node) => node.id), ["a", "b"]);
  assert.deepEqual(focusNeighborhood(nodes, relations, "a", 1.5).nodes.map((node) => node.id), ["a", "b"]);
  assert.deepEqual(focusNeighborhood(nodes, relations, "a", 99).nodes.map((node) => node.id), ["a", "b", "c"]);
});

test("automatic focus favors distinct neighbors over parallel assertions", () => {
  const nodes = ["a", "b", "c", "d", "e"].map((id) => ({ id, type: "project", title: id }));
  const relations = [
    ...Array.from({ length: 6 }, (_, i) => ({ id: `ab-${i}`, from: "a", to: "b" })),
    { id: "cd", from: "c", to: "d" },
    { id: "ce", from: "c", to: "e" },
    { id: "aa", from: "a", to: "a" },
    { id: "hidden", from: "a", to: "hidden" },
  ];
  assert.equal(chooseFocusNode(nodes, relations), "c");
  assert.equal(chooseFocusNode(nodes.slice().reverse(), relations.slice().reverse()), "c");
  assert.equal(chooseFocusNode(nodes, relations, "a"), "a");
});

test("path search keeps inspection-only assertions out and never follows legacy declarations as typed arrows", () => {
  const at = "2026-09-12T12:00:00Z";
  const nodes = ["a", "b", "c", "d"].map((id) => ({ id, type: "project", title: id }));
  const relations = [
    { id: "ab", from: "a", to: "b", semanticStatus: "typed", kind: "supports", review: "confirmed" },
    { id: "bc-rejected", from: "b", to: "c", semanticStatus: "typed", kind: "supports", review: "rejected" },
    { id: "bc-expired", from: "b", to: "c", semanticStatus: "typed", kind: "supports", review: "confirmed", validTo: "2025-01-01" },
    { id: "bc-future", from: "b", to: "c", semanticStatus: "typed", kind: "supports", review: "confirmed", validFrom: "2027-01-01" },
    { id: "bd-legacy", from: "b", to: "d", semanticStatus: "untyped", kind: "related_to",
      declarations: [{ from: "b", to: "d" }, { from: "d", to: "b" }] },
  ];
  const inspected = filterRelations(relations, { at, includeRejected: true, includeOutOfValidity: true });
  assert.equal(inspected.length, relations.length, "reviewing historical or rejected assertions must remain possible");
  const pathOptions = { at, includeRejected: false, includeOutOfValidity: false };
  for (const mode of ["directed", "undirected"]) {
    assert.equal(shortestPath(nodes, inspected, "a", "c", { ...pathOptions, mode }), null,
      "inspection filters must not make rejected, expired, or future assertions eligible for a current path");
  }
  assert.equal(shortestPath(nodes, inspected, "a", "d", { ...pathOptions, mode: "directed" }), null);
  assert.equal(shortestPath(nodes, inspected, "d", "a", { ...pathOptions, mode: "directed" }), null);
  assert.deepEqual(shortestPath(nodes, inspected, "d", "a", { ...pathOptions, mode: "undirected" }), {
    nodeIds: ["d", "b", "a"], relationIds: ["bd-legacy", "ab"],
  });
});


test("focus grows beyond two hops and retains every visible connection and full path", () => {
  const nodes = ["a", "b", "c", "d", "e", "isolated"].map((id) => ({ id, type: "project", title: id }));
  const relations = [
    { id: "ab", from: "a", to: "b" }, { id: "ac", from: "a", to: "c" },
    { id: "bc", from: "b", to: "c" }, { id: "cd", from: "c", to: "d" },
    { id: "de", from: "d", to: "e" }, { id: "cb", from: "c", to: "b" },
  ];
  const grown = focusNeighborhood(nodes, relations, "a", 3);
  assert.deepEqual(grown.nodes.map((node) => node.id), ["a", "b", "c", "d", "e"]);
  assert.deepEqual(grown.relations.map((edge) => edge.id), ["ab", "ac", "bc", "cb", "cd", "de"]);
  const retained = layoutFocusGraph(nodes, relations, "a", 1, { retainIds: ["d", "e"] });
  assert.equal(retained.positions.has("e"), true);
  assert.equal(retained.distances.get("e"), 3);
  const disconnected = layoutFocusGraph(nodes, relations, "a", 1, { retainIds: ["isolated"] });
  assert.equal(disconnected.distances.get("isolated"), null);
  assert.equal(disconnected.positions.has("isolated"), true);
  assert.equal(retained.relations.some((edge) => edge.id === "de"), true);
  const limited = focusNeighborhood(nodes, relations, "a", 3, { maxNodes: 3 });
  assert.equal(limited.nodes.length, 3);
  assert.equal(limited.hiddenNodeCount, 2);
  assert.deepEqual(limited.frontierIds, ["c"]);
  const mandatory = focusNeighborhood(nodes, relations, "a", 3, { maxNodes: 2, retainIds: ["b", "c", "d", "e", "missing"] });
  assert.equal(mandatory.nodes.length, 5, "full selected path survives the ordinary display limit");
});

test("frontier expansion is deterministic, additive, bounded, and never invents links", () => {
  const nodes = ["a", "b", "c", "d", "e"].map((id) => ({ id, type: "project", title: id }));
  const relations = [
    { id: "ab", from: "a", to: "b" }, { id: "ac", from: "a", to: "c" },
    { id: "bd", from: "b", to: "d" }, { id: "ce", from: "c", to: "e" },
    { id: "hidden", from: "a", to: "hidden" },
  ];
  const first = expandGraphNeighborhood(nodes, relations, ["a"]);
  assert.deepEqual(first.nodeIds, ["a", "b", "c"]);
  assert.deepEqual(first.frontierIds, ["b", "c"]);
  assert.deepEqual(expandGraphNeighborhood(nodes.slice().reverse(), relations.slice().reverse(), ["a"]), first);
  const branch = expandGraphNeighborhood(nodes, relations, first.nodeIds, { fromIds: ["b"] });
  assert.deepEqual(branch.nodeIds, ["a", "b", "c", "d"]);
  assert.deepEqual(branch.frontierIds, ["c"]);
  const limited = expandGraphNeighborhood(nodes, relations, ["a"], { maxNodes: 2 });
  assert.deepEqual(limited.nodeIds, ["a", "b"]);
  assert.equal(limited.hiddenNodeCount, 1);
  assert.deepEqual(limited.frontierIds, ["a", "b"]);
  const full = expandGraphNeighborhood(nodes, relations, branch.nodeIds);
  assert.deepEqual(full.nodeIds, ["a", "b", "c", "d", "e"]);
  assert.deepEqual(expandGraphNeighborhood(nodes, relations, full.nodeIds).addedIds, []);
  assert.deepEqual(expandGraphNeighborhood(nodes, relations, ["missing"]).nodeIds, []);
});

test("context source references retain their own provenance and declared direction", () => {
  const nodes = [{ id: "a", links: ["b"] }, { id: "b", links: [] }];
  const edge = { id: "source.ab", from: "a", to: "b", provenance: "frontmatter.sources",
    kind: "related_to", sources: ["context:b"], sourcePath: "journal/a.md", declaredBy: "a" };
  const relations = buildRelations(nodes, [edge]);
  assert.equal(relations.length, 2, "source references do not erase independent legacy links");
  const source = relations.find((relation) => relation.id === "source.ab");
  assert.equal(source.provenance, "frontmatter.sources");
  assert.equal(source.semanticStatus, "untyped");
  assert.equal(source.review, "not_represented");
  assert.equal(source.sourcePath, "journal/a.md");
  assert.deepEqual(source.sources, ["context:b"]);
  assert.deepEqual(source.declarations, [{ from: "a", to: "b" }]);
  assert.equal(shortestPath(nodes, [source], "a", "b", { mode: "directed" }), null);
  assert.deepEqual(shortestPath(nodes, [source], "a", "b").relationIds, ["source.ab"]);
});

test("suggestions expose exact shared context without becoming recorded relationships", () => {
  const nodes = [
    { id: "a", tags: ["learning"] }, { id: "b", tags: ["learning"] },
    { id: "c", tags: ["learning", "learning"] }, { id: "d", tags: ["Learning"] },
    { id: "e" }, { id: "n1" }, { id: "n2" },
  ];
  const relations = [
    { from: "a", to: "b" }, { from: "a", to: "n1" }, { from: "a", to: "n2" },
    { from: "e", to: "n1" }, { from: "e", to: "n2" }, { from: "d", to: "n1" },
  ];
  const before = JSON.stringify(relations);
  const suggestions = suggestRelatedRecords(nodes, relations, "a");
  assert.deepEqual(suggestions.map((item) => item.node.id), ["c", "e"]);
  assert.deepEqual(suggestions[0].sharedTags, ["learning"]);
  assert.deepEqual(suggestions[1].sharedNeighborIds, ["n1", "n2"]);
  assert.equal(JSON.stringify(relations), before);
  assert.deepEqual(suggestRelatedRecords(nodes.slice().reverse(), relations.slice().reverse(), "a"), suggestions);
  assert.equal(suggestRelatedRecords(nodes, relations, "a", { limit: 1 }).length, 1);
  assert.deepEqual(suggestRelatedRecords(nodes, relations, "missing"), []);
});

test("missing focus produces a complete empty layout after records disappear", () => {
  for (const nodes of [[], [{ id: "remaining" }]]) {
    const layout = layoutFocusGraph(nodes, [], "removed");
    assert.deepEqual(layout.nodes, []);
    assert.deepEqual(layout.frontierIds, []);
    assert.equal(layout.hiddenNodeCount, 0);
    assert.equal(layout.positions.size, 0);
    assert.ok(Number.isFinite(layout.width) && Number.isFinite(layout.height));
  }
});

test("suggestions do not use rejected or expired assertions or repropose existing links", () => {
  const nodes = ["a", "b", "c", "d", "n1", "n2"].map((id) => ({ id }));
  nodes.find((node) => node.id === "a").tags = ["shared"];
  nodes.find((node) => node.id === "d").tags = ["shared"];
  const relations = [
    { id: "an1", from: "a", to: "n1" }, { id: "an2", from: "a", to: "n2" },
    { id: "bn1", from: "b", to: "n1" }, { id: "bn2", from: "b", to: "n2", review: "rejected" },
    { id: "cn1", from: "c", to: "n1" }, { id: "cn2", from: "c", to: "n2", validTo: "2020-01-01" },
    { id: "ad", from: "a", to: "d", review: "rejected" },
  ];
  assert.deepEqual(suggestRelatedRecords(nodes, relations, "a", { at: "2026-09-12" }), []);
});

test("multiple dense expansion rings keep every card within the canvas and apart", () => {
  const nodes = [{ id: "root", type: "project", title: "Root" }];
  const relations = [];
  for (let ring = 1; ring <= 4; ring += 1) {
    for (let index = 0; index < 18; index += 1) {
      const id = `${ring}-${index}`;
      nodes.push({ id, type: "project", title: id });
      relations.push({ id: `edge-${id}`, from: ring === 1 ? "root" : `${ring - 1}-${index}`, to: id });
    }
  }
  const layout = layoutFocusGraph(nodes, relations, "root", 4);
  assert.equal(layout.positions.size, 73);
  const boxes = [...layout.positions];
  for (let i = 0; i < boxes.length; i += 1) {
    const [id, box] = boxes[i];
    assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= layout.width && box.y + box.height <= layout.height, id);
    for (let j = i + 1; j < boxes.length; j += 1) {
      const [otherId, other] = boxes[j];
      assert.equal(box.x < other.x + other.width && box.x + box.width > other.x &&
        box.y < other.y + other.height && box.y + box.height > other.y, false, `${id} overlaps ${otherId}`);
    }
  }
});

test("twenty-neighbor focus uses the wide viewport without oversized circular clearance", () => {
  const nodes = Array.from({ length: 21 }, (_, index) => ({ id: String(index), type: "project" }));
  const edges = nodes.slice(1).map((node) => ({ id: `edge-${node.id}`, from: "0", to: node.id }));
  const layout = layoutFocusGraph(nodes, edges, "0", 1);
  assert.ok(layout.width < 1600 && layout.height < 900, "wide scene should remain readable at fit zoom");
  const boxes = [...layout.positions.values()];
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const left = boxes[i], right = boxes[j];
      assert.equal(left.x < right.x + right.width + 12 && left.x + left.width + 12 > right.x &&
        left.y < right.y + right.height + 12 && left.y + left.height + 12 > right.y, false,
      "readability improvement must retain a gutter around every card");
    }
  }
});
