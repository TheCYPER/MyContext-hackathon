import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { ATLAS_LANES, buildLegacyRelations, chooseFocusNode, focusNeighborhood, layoutAtlas,
  layoutFocusGraph, rankWorkstreams, relationReferences, relationTrail,
  academicContextCounts, isSyntheticDemo, viewAvailable, shortestPath } from "../public/model.mjs";

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
  ];
  const layout = layoutAtlas(nodes);

  assert.deepEqual(layout.nodes.map((node) => node.id).sort(), nodes.map((node) => node.id).sort());
  assert.equal(layout.positions.size, nodes.length);
  assert.notDeepEqual(layout.positions.get("project.future"), layout.positions.get("project.mycontext-margin"));
  assert.equal(ATLAS_LANES.length, 6);
  assert.equal(ATLAS_LANES.some((lane) => lane.type === "idea"), true);
  assert.equal(ATLAS_LANES.some((lane) => lane.type === "experience"), true);
  assert.ok(layout.positions.has("experience.studio"));
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
  assert.equal(oneHop.relations.some((relation) => relation.id === "bc"), false);

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
  assert.match(app, /Reason not structured/);
  assert.match(app, /Incoming backlinks/);
  assert.match(app, /shortestPath/);
  assert.match(app, /aperture highlights at most two hops/);
  assert.match(app, /renderViewAndFocus/);
  assert.match(app, /data-relation-id/);
  assert.match(app, /Records within two hops/);
  assert.match(app, /two-hop.*visible legacy frontmatter links/);
  assert.match(app, /reverse \?/);
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
  assert.match(html, /tabindex="-1" aria-label="Close review margin"/);
  assert.match(css, /\.atlas-node\.is-experience/);
  assert.match(css, /\.atlas-node\.is-idea/);
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
