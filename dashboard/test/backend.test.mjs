import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, mkdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { createDashboardServer } from "../server.mjs";

const execFile = promisify(execFileCallback);
const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECTOR = path.resolve(TEST_DIR, "..", "projector.rb");

let fixtureRoot;
let publicDir;
let server;
let baseUrl;
let port;

function yamlList(values) {
  if (values.length === 0) return "[]";
  return `\n${values.map((value) => `  - ${JSON.stringify(value)}`).join("\n")}`;
}

function knowledge({ id, type, title, privacy, status = "active", ideaKind, resourceKind, demoKind, accessed, sources = ["user:2026-08-20"], tags = [], links = [], body = "# Notes\n\nFixture" }) {
  const privacyLine = privacy === undefined ? "" : `privacy: ${privacy}\n`;
  const ideaKindLine = ideaKind === undefined ? "" : `idea_kind: ${ideaKind}`;
  return [
    "---",
    `id: ${id}`,
    `type: ${type}`,
    ideaKindLine,
    resourceKind === undefined ? "" : `resource_kind: ${resourceKind}`,
    demoKind === undefined ? "" : `demo_kind: ${demoKind}`,
    accessed === undefined ? "" : `accessed: ${JSON.stringify(accessed)}`,
    `title: ${title}`,
    privacyLine.trimEnd(),
    'updated: "2026-08-20T12:00:00+08:00"',
    `sources: ${yamlList(sources)}`,
    `aliases: ${yamlList([])}`,
    `tags: ${yamlList(tags)}`,
    `links: ${yamlList(links)}`,
    `status: ${status}`,
    "---",
    "",
    body,
    "",
  ].filter((line) => line !== "").join("\n").replace("---\n#", "---\n\n#");
}

async function write(relative, content) {
  const target = path.join(fixtureRoot, relative);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content, "utf8");
}

async function git(...args) {
  return execFile("git", ["-C", fixtureRoot, ...args], { encoding: "utf8", shell: false });
}

async function rawRequest(requestPath, options = {}) {
  return new Promise((resolve, reject) => {
    const request = http.request({
      host: "127.0.0.1",
      port,
      method: options.method || "GET",
      path: requestPath,
      headers: options.headers,
    }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { body += chunk; });
      response.on("end", () => resolve({ status: response.statusCode, headers: response.headers, body }));
    });
    request.on("error", reject);
    request.end();
  });
}

before(async () => {
  fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "mycontext-dashboard-test-"));
  publicDir = path.join(fixtureRoot, "test-public");
  await mkdir(publicDir, { recursive: true });
  await writeFile(path.join(publicDir, "index.html"), "<!doctype html><title>Fixture dashboard</title>\n", "utf8");
  await writeFile(path.join(publicDir, "model.mjs"), "export const fixture = true;\n", "utf8");
  await symlink("/etc/passwd", path.join(publicDir, "escape.txt"));

  await git("init", "-b", "main");
  await git("config", "user.email", "dashboard-test@example.invalid");
  await git("config", "user.name", "Dashboard Test");

  await write("projects/alpha/overview.md", knowledge({
    id: "project.alpha",
    type: "project",
    title: "Alpha canonical",
    privacy: "private",
    tags: ["fixture"],
    links: ["person.mentor", "project.alpha"],
    body: "# Goal\n\nBuild the canonical fixture.\n\n# Next action\n\n- Review the first result.",
  }));
  await write("experience/studio/overview.md", knowledge({
    id: "experience.studio",
    type: "experience",
    title: "Studio internship",
    privacy: "private",
    tags: ["internship"],
    links: ["project.alpha"],
    body: "# Scope\n\nCompleted a tracked work experience.",
  }));
  await write("ideas/research/verifier.md", knowledge({
    id: "idea.research.verifier",
    type: "idea",
    ideaKind: "research",
    title: "Verifier research idea",
    privacy: "private",
    status: "draft",
    tags: ["research-idea"],
    links: ["project.alpha", "person.mentor"],
    body: "# Project Title\n\nPredict Before You Track\n\n# Project Description\n\nTest a layered verifier.\n\n# What kind of help do you need from an advisor?\n\nSimulation and evaluation guidance.",
  }));
  await write("ideas/projects/cloudscore.md", knowledge({
    id: "idea.project.cloudscore",
    type: "idea",
    ideaKind: "project",
    title: "CloudScore",
    privacy: "private",
    status: "draft",
    tags: ["project-idea"],
    body: "# Problem\n\nRate cloud photographs.\n\n# Product direction\n\nA global community.\n\n# First validation\n\nTest the upload and rating loop.\n\n# Current boundary\n\nPlanning only.",
  }));
  await write("experience/studio/drafts/certificate.md", knowledge({
    id: "draft.experience.studio.certificate",
    type: "draft",
    title: "Internship certificate draft",
    privacy: "private",
    status: "draft",
    links: ["experience.studio"],
    body: "# Draft — not signed\n\nCertificate fixture awaiting review.",
  }));
  await write("people/mentor/profile.md", knowledge({
    id: "person.mentor",
    type: "person",
    title: "Mentor",
    privacy: "private",
    body: "# Relationship state\n\n- Stage: researched.",
  }));
  await write("people/mentor/drafts/hello.md", knowledge({
    id: "draft.outreach.mentor.hello",
    type: "draft",
    title: "Mentor hello draft",
    privacy: "private",
    status: "draft",
    links: ["person.mentor"],
    body: "# Draft — not sent\n\nHello from the fixture.",
  }));
  await write("projects/secret/overview.md", knowledge({
    id: "project.secret",
    type: "project",
    title: "Restricted project",
    privacy: "restricted",
    body: "# Restricted\n\nrestricted-only-sentinel",
  }));
  await write("projects/malformed/overview.md", knowledge({
    id: "project.malformed",
    type: "project",
    title: "Missing privacy",
    privacy: undefined,
    body: "# Notes\n\nmalformed-only-sentinel",
  }));
  await write("sources/session-exports/codex/export.md", knowledge({
    id: "session.fixture",
    type: "session_export",
    title: "Excluded source",
    privacy: "restricted",
    status: "archived",
    body: "# Source\n\nsource-only-sentinel",
  }));

  await git("add", ".");
  await git("commit", "-m", "Fixture context");

  await write("projects/alpha/overview.md", knowledge({
    id: "project.alpha",
    type: "project",
    title: "DIRTY WORKTREE MUST NOT LEAK",
    privacy: "private",
  }));

  const app = await createDashboardServer({ root: fixtureRoot, publicDir, projectorPath: PROJECTOR });
  server = app.server;
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (fixtureRoot) await rm(fixtureRoot, { recursive: true, force: true });
});

test("projector uses Git HEAD and excludes restricted, malformed, and source records", async () => {
  const result = await execFile("ruby", [PROJECTOR, fixtureRoot], { encoding: "utf8", shell: false });
  const projection = JSON.parse(result.stdout);
  const serialized = JSON.stringify(projection);

  assert.deepEqual(projection.entities.map((entity) => entity.id).sort(), [
    "draft.experience.studio.certificate",
    "draft.outreach.mentor.hello",
    "experience.studio",
    "idea.project.cloudscore",
    "idea.research.verifier",
    "person.mentor",
    "project.alpha",
  ]);
  assert.equal(projection.entities.find((entity) => entity.id === "project.alpha").title, "Alpha canonical");
  assert.equal(projection.counts.excluded.restricted, 1);
  assert.equal(projection.counts.excluded.invalid, 1);
  assert.equal(projection.reviewItems.length, 2);
  assert.equal(projection.workstreams.length, 1);
  assert.deepEqual(projection.workstreams.map((item) => item.id), ["project.alpha"]);
  assert.equal(projection.counts.byType.experience, 1);
  assert.equal(projection.counts.byType.idea, 2);
  assert.deepEqual(projection.counts.byIdeaKind, { project: 1, research: 1 });
  assert.equal(projection.operations.length, 0);
  assert.equal(projection.boundaries.operations, "not-instrumented");
  assert.equal(projection.schemaVersion, 4);
  assert.equal(projection.graph.edges.length, 4);
  assert.equal(projection.graph.edges.some((edge) => edge.from === edge.to), false);
  const projectEdge = projection.graph.edges.find((edge) =>
    edge.from === "project.alpha" && edge.to === "person.mentor");
  const experienceEdge = projection.graph.edges.find((edge) =>
    edge.from === "experience.studio" && edge.to === "project.alpha");
  const ideaProjectEdge = projection.graph.edges.find((edge) =>
    edge.from === "idea.research.verifier" && edge.to === "project.alpha");
  const ideaPersonEdge = projection.graph.edges.find((edge) =>
    edge.from === "idea.research.verifier" && edge.to === "person.mentor");
  assert.ok(projectEdge);
  assert.ok(experienceEdge);
  assert.ok(ideaProjectEdge);
  assert.ok(ideaPersonEdge);
  assert.equal(projectEdge.kind, "related_to");
  assert.equal(projectEdge.provenance, "frontmatter.links");
  assert.equal(projectEdge.declaredBy, "project.alpha");
  assert.equal(projectEdge.sourcePath, "projects/alpha/overview.md");
  assert.equal(projectEdge.semanticStatus, "untyped");
  assert.equal(projectEdge.evidence, "reason_not_structured");
  assert.equal(projectEdge.review, "not_represented");
  assert.equal(projectEdge.privacy, "private");
  assert.equal(experienceEdge.sourcePath, "experience/studio/overview.md");
  assert.equal(projection.entities.find((entity) =>
    entity.id === "draft.experience.studio.certificate").parentId, "experience.studio");
  assert.deepEqual(projection.graph.adjacency["experience.studio"], {
    incomingEdgeIds: [],
    outgoingEdgeIds: [experienceEdge.id],
    neighborIds: ["project.alpha"],
  });
  assert.deepEqual(projection.graph.adjacency["project.alpha"], {
    incomingEdgeIds: [experienceEdge.id, ideaProjectEdge.id].sort(),
    outgoingEdgeIds: [projectEdge.id],
    neighborIds: ["experience.studio", "idea.research.verifier", "person.mentor"],
  });
  assert.deepEqual(projection.graph.adjacency["person.mentor"], {
    incomingEdgeIds: [ideaPersonEdge.id, projectEdge.id].sort(),
    outgoingEdgeIds: [],
    neighborIds: ["idea.research.verifier", "project.alpha"],
  });
  assert.deepEqual(projection.graph.adjacency["idea.research.verifier"], {
    incomingEdgeIds: [],
    outgoingEdgeIds: [ideaPersonEdge.id, ideaProjectEdge.id].sort(),
    neighborIds: ["person.mentor", "project.alpha"],
  });
  assert.equal(projection.graph.nodes.find((node) => node.id === "project.alpha").outgoingCount, 1);
  assert.equal(projection.graph.nodes.find((node) => node.id === "experience.studio").outgoingCount, 1);
  assert.equal(projection.graph.nodes.find((node) => node.id === "person.mentor").incomingCount, 2);
  assert.equal(projection.graph.nodes.find((node) => node.id === "idea.research.verifier").ideaKind, "research");
  const researchIdea = projection.entities.find((entity) => entity.id === "idea.research.verifier");
  assert.equal(researchIdea.submission.projectTitle, "Predict Before You Track");
  assert.equal(researchIdea.submission.advisorHelp, "Simulation and evaluation guidance.");
  assert.equal("typedEdges" in projection.graph, false);
  assert.equal("genericEdges" in projection.graph, false);
  assert.ok(!serialized.includes("restricted-only-sentinel"));
  assert.ok(!serialized.includes("malformed-only-sentinel"));
  assert.ok(!serialized.includes("source-only-sentinel"));
  assert.ok(!serialized.includes("DIRTY WORKTREE MUST NOT LEAK"));
});

test("read-only API exposes summaries and lazy entity details", async () => {
  const health = await fetch(`${baseUrl}/api/v1/health`);
  assert.equal(health.status, 200);
  assert.equal(health.headers.get("access-control-allow-origin"), null);
  assert.match(health.headers.get("content-security-policy"), /default-src 'self'/);

  const snapshotResponse = await fetch(`${baseUrl}/api/v1/snapshot`);
  const snapshot = await snapshotResponse.json();
  assert.equal(snapshot.ok, true);
  assert.equal(snapshot.snapshot.schemaVersion, 4);
  assert.equal(snapshot.snapshot.entities.length, 7);
  assert.deepEqual(snapshot.snapshot.operations, []);
  assert.equal(snapshot.snapshot.boundaries.readOnly, true);
  assert.ok(snapshot.snapshot.entities.every((entity) => !("body" in entity) && !("sections" in entity)));
  assert.deepEqual(snapshot.snapshot.graph.adjacency["person.mentor"].neighborIds, ["idea.research.verifier", "project.alpha"]);
  assert.deepEqual(snapshot.snapshot.graph.adjacency["experience.studio"].neighborIds, ["project.alpha"]);
  assert.equal(snapshot.snapshot.entities.find((entity) =>
    entity.id === "idea.research.verifier").submission.projectDescription, "Test a layered verifier.");

  const detailResponse = await fetch(`${baseUrl}/api/v1/entities/project.alpha`);
  const detail = await detailResponse.json();
  assert.equal(detailResponse.status, 200);
  assert.equal(detail.entity.title, "Alpha canonical");
  assert.match(detail.entity.body, /Build the canonical fixture/);
  assert.ok(Array.isArray(detail.entity.sections));

  const restrictedResponse = await fetch(`${baseUrl}/api/v1/entities/project.secret`);
  assert.equal(restrictedResponse.status, 404);

  const repoResponse = await fetch(`${baseUrl}/api/v1/repo`);
  const repo = await repoResponse.json();
  assert.equal(repo.repo.dirty, true);
  assert.equal(repo.repo.canonicalSource, "git-head");
  assert.equal(repo.capabilities.writes, false);
});

test("server rejects writes, foreign origins, traversal, and escaping symlinks", async () => {
  const mutation = await fetch(`${baseUrl}/api/v1/snapshot`, { method: "POST" });
  assert.equal(mutation.status, 405);
  assert.equal((await mutation.json()).error.code, "read_only");

  const crossOrigin = await fetch(`${baseUrl}/api/v1/snapshot`, {
    headers: { Origin: "https://attacker.example" },
  });
  assert.equal(crossOrigin.status, 403);

  const invalidEntity = await rawRequest("/api/v1/entities/%2e%2e%2fproject.alpha");
  assert.equal(invalidEntity.status, 400);

  const traversal = await rawRequest("/%2e%2e/%2e%2e/etc/passwd");
  assert.equal(traversal.status, 400);
  assert.ok(!traversal.body.includes("root:"));

  const symlinkEscape = await fetch(`${baseUrl}/escape.txt`);
  assert.equal(symlinkEscape.status, 404);

  const foreignHost = await rawRequest("/api/v1/health", { headers: { Host: "attacker.example" } });
  assert.equal(foreignHost.status, 421);
});

test("static files are served from the fixed public root", async () => {
  const response = await fetch(`${baseUrl}/`);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Fixture dashboard/);

  const moduleResponse = await fetch(`${baseUrl}/model.mjs`);
  assert.equal(moduleResponse.status, 200);
  assert.match(moduleResponse.headers.get("content-type"), /^text\/javascript/);
});

test("context selection honors explicit roots, shared configuration, and the legacy alias", async (t) => {
  const previous = {
    MY_CONTEXT_ROOT: process.env.MY_CONTEXT_ROOT,
    MYCONTEXT_ROOT: process.env.MYCONTEXT_ROOT,
  };
  t.after(() => {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
  const expectedRoot = await realpath(fixtureRoot);
  const missingRoot = path.join(fixtureRoot, "missing-context");

  process.env.MY_CONTEXT_ROOT = fixtureRoot;
  process.env.MYCONTEXT_ROOT = missingRoot;
  assert.equal((await createDashboardServer()).root, expectedRoot);

  delete process.env.MY_CONTEXT_ROOT;
  process.env.MYCONTEXT_ROOT = fixtureRoot;
  assert.equal((await createDashboardServer()).root, expectedRoot);

  process.env.MY_CONTEXT_ROOT = missingRoot;
  process.env.MYCONTEXT_ROOT = missingRoot;
  assert.equal((await createDashboardServer({ root: fixtureRoot })).root, expectedRoot);
});

test("empty context projects zero records and accepts only the exact built-in placeholder", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "mycontext-empty-backend-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const runGit = (...args) => execFile("git", ["-C", root,
    "-c", "user.name=Context Test", "-c", "user.email=context-test@example.invalid",
    "-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null", ...args], { encoding: "utf8", shell: false });
  const validate = () => execFile("ruby", [path.resolve(TEST_DIR, "../../scripts/validate.rb"), "--scaffold", root], { encoding: "utf8", shell: false });
  const project = async () => JSON.parse((await execFile("ruby", [PROJECTOR, root], { encoding: "utf8", shell: false })).stdout);
  const placeholder = "<!-- mycontext:empty-profile -->\n# Your context\n\nNo personal facts have been added yet. Add your profile only after reviewing the proposed changes.\n";
  await mkdir(path.join(root, "profile"));
  await writeFile(path.join(root, "INDEX.md"), "# Empty context\n");
  await writeFile(path.join(root, "profile/summary.md"), placeholder);
  await runGit("init", "-b", "main");
  await runGit("add", ".");
  await runGit("commit", "-m", "Empty context");
  assert.match((await validate()).stdout, /0 knowledge files/);
  const blank = await project();
  assert.equal(blank.counts.total, 0);
  assert.equal(blank.counts.excluded.invalid, 0);
  assert.deepEqual(blank.entities, []);
  assert.deepEqual(blank.graph, { nodes: [], edges: [], adjacency: {} });
  assert.deepEqual(blank.workstreams, []);
  assert.deepEqual(blank.reviewItems, []);

  await writeFile(path.join(root, "profile/summary.md"), placeholder + "Unstructured personal text\n");
  await assert.rejects(validate(), /missing opening YAML frontmatter delimiter/);
  await runGit("add", ".");
  await runGit("commit", "-m", "Invalid profile text");
  assert.equal((await project()).counts.excluded.invalid, 1);
});

test("resources and demo provenance survive projection, graph links, summaries, and details", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "mycontext-resource-backend-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const runGit = (...args) => execFile("git", ["-C", root,
    "-c", "user.name=Context Test", "-c", "user.email=context-test@example.invalid",
    "-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null", ...args], { encoding: "utf8", shell: false });
  const put = async (relative, options) => {
    const target = path.join(root, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, knowledge(options), "utf8");
  };
  await put("profile/summary.md", {
    id: "profile.summary", type: "profile", title: "Fictional reader", privacy: "private",
    demoKind: "fictional", sources: ["demo:fictional"], links: ["resource.walking"],
  });
  const resource = {
    id: "resource.walking", type: "resource", resourceKind: "book", title: "A Walking Book", privacy: "public",
    demoKind: "public_reference", accessed: "2026-09-12",
    sources: ["demo:public-reference", "web:https://publisher.example.invalid/walking"],
    body: "# Public source\n\nA synthetic book reference used only in tests.",
  };
  await put("resources/books/walking.md", resource);
  await put("resources/without-kind.md", {
    id: "resource.legacy", type: "resource", title: "Uncategorized resource", privacy: "private",
  });
  await put("resources/invalid-kind.md", { ...resource, id: "resource.invalid-kind", resourceKind: "person" });
  await put("resources/invalid-date.md", { ...resource, id: "resource.invalid-date", accessed: "2026-02-30" });
  await put("resources/invalid-demo.md", { ...resource, id: "resource.invalid-demo", demoKind: "confirmed" });
  await put("resources/restricted.md", { ...resource, id: "resource.restricted", privacy: "restricted" });
  await runGit("init", "-b", "main");
  await runGit("add", ".");
  await runGit("commit", "-m", "Resource fixtures");

  const projection = JSON.parse((await execFile("ruby", [PROJECTOR, root], { encoding: "utf8", shell: false })).stdout);
  assert.equal(projection.counts.total, 3);
  assert.equal(projection.counts.byType.resource, 2);
  assert.equal(projection.counts.excluded.invalid, 3);
  assert.equal(projection.counts.excluded.restricted, 1);
  const node = projection.graph.nodes.find((item) => item.id === "resource.walking");
  assert.equal(node.resourceKind, "book");
  assert.equal(node.demoKind, "public_reference");
  assert.equal(node.accessed, "2026-09-12");
  assert.deepEqual(projection.graph.adjacency["resource.walking"].neighborIds, ["profile.summary"]);
  assert.equal(projection.entities.find((item) => item.id === "profile.summary").demoKind, "fictional");
  assert.equal("resourceKind" in projection.entities.find((item) => item.id === "resource.legacy"), false);

  const app = await createDashboardServer({ root, publicDir, projectorPath: PROJECTOR });
  await new Promise((resolve, reject) => {
    app.server.once("error", reject);
    app.server.listen(0, "127.0.0.1", resolve);
  });
  t.after(() => new Promise((resolve) => app.server.close(resolve)));
  const url = `http://127.0.0.1:${app.server.address().port}`;
  const snapshot = (await (await fetch(`${url}/api/v1/snapshot`)).json()).snapshot;
  const summary = snapshot.entities.find((item) => item.id === "resource.walking");
  assert.equal(summary.resourceKind, "book");
  assert.equal(summary.demoKind, "public_reference");
  assert.equal(summary.accessed, "2026-09-12");
  assert.deepEqual(summary.sources, resource.sources);
  assert.equal("body" in summary, false);
  const detail = (await (await fetch(`${url}/api/v1/entities/resource.walking`)).json()).entity;
  assert.equal(detail.resourceKind, "book");
  assert.equal(detail.demoKind, "public_reference");
  assert.match(detail.body, /synthetic book reference/);
});
