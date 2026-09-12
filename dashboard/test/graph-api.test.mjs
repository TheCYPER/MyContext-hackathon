import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { createDashboardServer } from "../server.mjs";

// Exercise the HTTP revision contract independently of the Ruby projector.
// Real Markdown projection is covered by backend.test.mjs and Ruby tests.
async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "mycontext-graph-api-"));
  const git = (...args) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
  git("init", "-b", "main");
  git("config", "user.name", "Graph API Fixture");
  git("config", "user.email", "fixture@example.invalid");
  await writeFile(path.join(root, "fixture.txt"), "fictional\n");
  git("add", ".");
  git("commit", "-m", "Fictional API baseline");
  const revision = git("rev-parse", "HEAD");
  const publicDir = path.join(root, "public");
  await mkdir(publicDir);
  await writeFile(path.join(publicDir, "index.html"), "<!doctype html><title>Fixture</title>");
  const projectorPath = path.join(root, "projector.mjs");
  await writeFile(projectorPath, `
import { execFileSync } from 'node:child_process';
const revision = execFileSync('git', ['-C', process.argv[2], 'rev-parse', 'HEAD'], {encoding:'utf8'}).trim();
console.log(JSON.stringify({schemaVersion:5, revision, entities:[{id:'project.fixture',type:'project',title:'Fixture',body:'Fictional body',sections:[]}],
 graph:{nodes:[{id:'project.fixture'}],edges:[],adjacency:{}},
 boundaries:{canonicalSource:'git-head',readOnly:true},capabilities:{readOnly:true,writes:false}}));
`);
  const { server } = await createDashboardServer({ root, publicDir, projectorPath, ruby: process.execPath });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  });
  return { root, git, revision, url: `http://127.0.0.1:${server.address().port}` };
}

test("graph endpoint exposes the committed projection contract", async (t) => {
  const { url, revision } = await fixture(t);
  const response = await fetch(`${url}/api/v1/graph`);
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.schemaVersion, 5);
  assert.equal(payload.revision, revision);
  assert.deepEqual(payload.graph.nodes, [{ id: "project.fixture" }]);
  assert.equal(payload.boundaries.canonicalSource, "git-head");
  assert.equal(payload.boundaries.readOnly, true);
  const head = await fetch(`${url}/api/v1/graph`, { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
});

test("entity details require the requested snapshot revision to remain current", async (t) => {
  const { url, revision, root, git } = await fixture(t);
  const endpoint = `${url}/api/v1/entities/project.fixture?revision=${revision}`;
  const initial = await fetch(endpoint);
  assert.equal(initial.status, 200);
  assert.equal((await initial.json()).revision, revision);
  await writeFile(path.join(root, "fixture.txt"), "revised fictional context\n");
  git("add", "fixture.txt");
  git("commit", "-m", "Revise fictional context");
  const stale = await fetch(endpoint);
  assert.equal(stale.status, 409);
  assert.equal((await stale.json()).error.code, "revision_changed");
  const current = await fetch(`${url}/api/v1/entities/project.fixture?revision=${git("rev-parse", "HEAD")}`);
  assert.equal(current.status, 200);
});

test("entity revision validation preserves compatibility for callers without a revision", async (t) => {
  const { url } = await fixture(t);
  const invalid = await fetch(`${url}/api/v1/entities/project.fixture?revision=not-a-commit`);
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).error.code, "invalid_revision");
  const compatible = await fetch(`${url}/api/v1/entities/project.fixture`);
  assert.equal(compatible.status, 200);
});
