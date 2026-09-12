import { TYPED_RELATION_KINDS, buildRelations, chooseFocusNode, filterRelations,
layoutAtlas, layoutFocusGraph, relationReferences, relationTrail, rankWorkstreams,
academicContextCounts, isSyntheticDemo, viewAvailable, shortestPath } from "./model.mjs";

const API = Object.freeze({ snapshot: "/api/v1/snapshot",
repo: "/api/v1/repo", entity: (id, revision) => `/api/v1/entities/${encodeURIComponent(id)}${revision ? `?revision=${encodeURIComponent(revision)}` : ""}`,
 });
const VIEW_META = Object.freeze({
  desk: { kicker: "Academic & professional context", title: "Keep the context behind your work.",
    deck: "Projects, research ideas, coursework, and experience, ready for your next conversation with Codex." },
  workstreams: { kicker: "Project context", title: "Where each project stands.",
    deck: "Current results, open questions, related people, and the next step recorded for each project." },
  ideas: { kicker: "Questions worth exploring", title: "Research and project ideas.",
    deck: "Keep research questions and possible builds connected to the work that prompted them." },
  runs: { kicker: "Connected operations", title: "Local operations.",
    deck: "Operations registered with this app. Their output becomes saved context only after review." },
  people: { kicker: "Working relationships", title: "People behind the work.",
    deck: "Mentors, collaborators, and instructors, with the projects and conversations that connect you." },
  projects: { kicker: "Project records", title: "Projects, with their evidence.",
    deck: "What you built, what you tested, what remains uncertain, and who was involved." },
  experience: { kicker: "Academic & professional record", title: "Experience in context.",
    deck: "Internships, research roles, and peer learning, with responsibilities and contributions kept in view." },
  atlas: { kicker: "Context graph", title: "Explore the connections.",
    deck: "Follow the links between projects, ideas, experience, and people. Open a record to inspect its context." },
  system: { kicker: "Local and read-only", title: "How MyContext reads your records.",
    deck: "Markdown and Git hold the saved context. This dashboard shows the committed version for inspection." },
});
const state = { snapshot: null,
repo: null, entities: [],
entityById: new Map(), detailCache: new Map(),
graphNodes: [], graphNodeById: new Map(), relations: [], graphRelations: [],
focusId: null, focusDepth: 1, selectedRelationId: null, pathTargetId: null, pathResult: null,
relationKind: "all", reviewState: "default", evidenceState: "all", includeOutOfValidity: false, pathMode: "undirected",
graphZoom: 1, graphPanX: 0, graphPanY: 0,
activeView: "desk", query: "",
scope: "all", inspectorRequest: 0,
loadError: null, repoError: null, };
const dom = {}; document.addEventListener("DOMContentLoaded", initialize);
async function initialize() { cacheDom();
bindEvents(); selectInitialView();
const [snapshotResult, repoResult] = await Promise.allSettled([ getJson(API.snapshot),
getJson(API.repo), ]);
if (snapshotResult.status === "fulfilled") { state.snapshot = snapshotResult.value.snapshot;
state.entities = Array.isArray(state.snapshot.entities) ? state.snapshot.entities : []; state.entityById = new Map(state.entities.map((entity) => [entity.id, entity]));
const graph = state.snapshot.graph || {}; state.graphNodes = asArray(graph.nodes).filter(atlasNodeVisible);
state.graphNodeById = new Map(state.graphNodes.map((node) => [node.id, node]));
state.relations = buildRelations(state.entities, graph.edges);
state.graphRelations = state.relations.filter((relation) => state.graphNodeById.has(relation.from) && state.graphNodeById.has(relation.to));
state.focusId = chooseFocusNode(state.graphNodes, state.graphRelations, state.focusId);
} else { state.loadError = readableError(snapshotResult.reason);
} if (repoResult.status === "fulfilled") {
state.repo = repoResult.value.repo; } else {
state.repoError = readableError(repoResult.reason); }
updateCapabilityNavigation(); selectInitialView();
dom.demoLabel.hidden = !isSyntheticDemo(state.entities);
updateRepositoryStatus(); renderMargin();
renderView(); finishLoading();
} function cacheDom() {
dom.navItems = [...document.querySelectorAll("[data-view]")]; dom.viewKicker = document.getElementById("view-kicker");
dom.viewTitle = document.getElementById("view-title"); dom.viewDeck = document.getElementById("view-deck");
dom.viewContent = document.getElementById("view-content"); dom.search = document.getElementById("global-search");
dom.scope = document.getElementById("scope-filter"); dom.searchResults = document.getElementById("search-results");
dom.demoLabel = document.getElementById("demo-label");
dom.searchCluster = document.getElementById("search-cluster"); dom.loadBanner = document.getElementById("load-banner");
dom.repoOrbit = document.getElementById("repo-orbit"); dom.repoShortStatus = document.getElementById("repo-short-status");
dom.revisionLabel = document.getElementById("revision-label"); dom.margin = document.getElementById("human-margin");
dom.spine = document.querySelector(".index-spine"); dom.desk = document.querySelector(".control-desk");
dom.marginToggle = document.getElementById("margin-toggle"); dom.marginClose = document.getElementById("margin-close");
dom.marginScrim = document.getElementById("margin-scrim"); dom.queue = document.getElementById("judgment-queue");
dom.queueCount = document.getElementById("queue-count"); dom.mobileQueueCount = document.getElementById("mobile-queue-count");
dom.inspector = document.getElementById("entity-inspector"); dom.inspectorKicker = document.getElementById("inspector-kicker");
dom.inspectorTitle = document.getElementById("inspector-title"); dom.inspectorBody = document.getElementById("inspector-body");
dom.inspectorClose = document.getElementById("inspector-close"); dom.inspectorRevision = document.getElementById("inspector-revision");
dom.liveRegion = document.getElementById("live-region"); dom.skipLink = document.querySelector(".skip-link");
dom.marginMedia = window.matchMedia("(max-width: 960px)"); }
function bindEvents() { for (const item of dom.navItems) {
item.addEventListener("click", () => setView(item.dataset.view)); }
dom.search.addEventListener("input", () => { state.query = dom.search.value.trim();
renderSearchResults(); });
dom.search.addEventListener("focus", renderSearchResults); dom.scope.addEventListener("change", () => {
state.scope = dom.scope.value; renderSearchResults();
if (["people", "projects", "experience", "ideas"].includes(state.activeView)) renderView(); });
document.addEventListener("click", (event) => { if (!dom.searchCluster.contains(event.target)) closeSearch();
}); document.addEventListener("keydown", handleGlobalKeydown);
window.addEventListener("hashchange", selectInitialView); dom.marginToggle.addEventListener("click", openMargin);
dom.marginClose.addEventListener("click", closeMargin); dom.marginScrim.addEventListener("click", closeMargin);
dom.marginMedia.addEventListener("change", resetMarginForViewport); resetMarginForViewport();
dom.inspectorClose.addEventListener("click", () => dom.inspector.close()); dom.inspector.addEventListener("click", (event) => {
if (event.target === dom.inspector) dom.inspector.close(); });
} function handleGlobalKeydown(event) {
const target = event.target; const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
if (event.key === "/" && !isTyping && !dom.inspector.open) { event.preventDefault();
dom.search.focus(); }
if (event.key === "Escape") { closeSearch();
closeMargin(); }
} function selectInitialView() {
const candidate = window.location.hash.replace(/^#/, ""); let view = Object.hasOwn(VIEW_META, candidate) ? candidate : state.activeView;
if (!viewAvailable(view, state.snapshot?.capabilities)) view = "desk";
if (view !== state.activeView) { state.activeView = view;
renderView(); }
updateNav(); }
function setView(view) { if (!Object.hasOwn(VIEW_META, view)) return;
if (!viewAvailable(view, state.snapshot?.capabilities)) view = "desk";
state.activeView = view; history.replaceState(null, "", `#${view}`);
closeSearch(); closeMargin();
updateNav(); renderView();
document.getElementById("main-content").focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
} function updateCapabilityNavigation() {
for (const item of dom.navItems) item.hidden = !viewAvailable(item.dataset.view, state.snapshot?.capabilities);
if (!viewAvailable(state.activeView, state.snapshot?.capabilities)) state.activeView = "desk";
updateNav();
}
function updateNav() {
for (const item of dom.navItems) { const active = item.dataset.view === state.activeView;
item.classList.toggle("is-active", active); if (active) item.setAttribute("aria-current", "page");
else item.removeAttribute("aria-current"); }
} async function getJson(path) {
const controller = new AbortController(); const timeout = window.setTimeout(() => controller.abort(), 10_000);
try { const response = await fetch(path, {
headers: { Accept: "application/json" }, signal: controller.signal,
}); const payload = await response.json().catch(() => null);
if (!response.ok || !payload?.ok) { const error = new Error(payload?.error?.message || `Request failed (${response.status})`);
error.status = response.status; error.code = payload?.error?.code; throw error;
} return payload;
} finally { window.clearTimeout(timeout);
} }
function finishLoading() { if (state.loadError) {
dom.loadBanner.classList.add("is-error"); replaceChildren(dom.loadBanner, make("span", "", `MyContext could not project canonical context: ${state.loadError}`));
return; }
if (state.repoError) { replaceChildren(dom.loadBanner, make("span", "", `Context loaded; live repository status is unavailable: ${state.repoError}`));
return; }
dom.loadBanner.hidden = true; }
function updateRepositoryStatus() { dom.repoOrbit.classList.remove("is-loading", "is-alert");
if (!state.snapshot) { dom.repoOrbit.classList.add("is-alert");
dom.repoShortStatus.textContent = "Projection unavailable"; dom.revisionLabel.textContent = "Canonical source · unavailable";
return; }
if (!state.repo) { dom.repoOrbit.classList.add("is-alert"); const revision = shortRevision(state.snapshot.revision);
dom.repoShortStatus.textContent = `${revision} · repository status unavailable`; dom.revisionLabel.textContent = `Tracked Git HEAD · ${revision}`;
return; }
if (state.repo.dirty) dom.repoOrbit.classList.add("is-alert"); const revision = shortRevision(state.repo.revision || state.snapshot.revision);
const branch = state.repo.branch || "detached HEAD"; const stateLabel = state.repo.dirty ? "working tree has local changes" : "working tree clean";
dom.repoShortStatus.textContent = `${branch} · ${revision} · ${stateLabel}`; dom.revisionLabel.textContent = `Tracked Git HEAD · ${branch} · ${revision}`;
} function renderView() {
const meta = VIEW_META[state.activeView] || VIEW_META.desk; dom.viewKicker.textContent = meta.kicker;
dom.viewTitle.textContent = meta.title; dom.viewDeck.textContent = meta.deck;
document.title = `${meta.title} · MyContext`; if (!state.snapshot) {
replaceChildren(dom.viewContent, renderLoadError()); return;
} const renderers = {
desk: renderDesk, workstreams: renderWorkstreamsView,
runs: renderRunsView, ideas: renderIdeasView, people: () => renderRecordsView("person"),
projects: () => renderRecordsView("project"), experience: () => renderRecordsView("experience"), atlas: renderAtlasView,
system: renderSystemView, };
replaceChildren(dom.viewContent, renderers[state.activeView]()); }
function renderDesk() { const fragment = document.createDocumentFragment();
fragment.append(renderContextIndex());
const reviewItems = reviewQueue(); const workstreams = prioritizedWorkstreams().slice(0, 4);
const judgmentSection = make("section", "section-block"); judgmentSection.setAttribute("aria-labelledby", "judgment-heading");
judgmentSection.append(sectionHeading("judgment-heading", "Drafts to review", `${reviewItems.length} read-only review item${reviewItems.length === 1 ? "" : "s"}`)); if (reviewItems.length) {
const list = make("div", "judgment-lead"); for (const item of reviewItems.slice(0, 3)) list.append(renderJudgmentRow(item));
judgmentSection.append(list); } else {
judgmentSection.append(renderEmpty("Nothing needs your decision.", "No draft or context change was applied.")); }
const workSection = make("section", "section-block");
workSection.setAttribute("aria-labelledby", "workstream-heading"); workSection.append(sectionHeading("workstream-heading", "Project context", "Saved results, questions, and next steps"));
workSection.append(renderWorkstreamBoard(workstreams)); fragment.append(workSection, judgmentSection);
if (viewAvailable("runs", state.snapshot?.capabilities)) {
const runsSection = make("section", "section-block"); runsSection.setAttribute("aria-labelledby", "desk-runs-heading");
runsSection.append(sectionHeading("desk-runs-heading", "Live runs", "Only operations registered with this local harness")); runsSection.append(renderOperations());
fragment.append(runsSection); } return fragment;
}
function renderContextIndex() {
  const counts = academicContextCounts(state.entities);
  const section = make("nav", "context-index"); section.setAttribute("aria-label", "Academic and professional records");
  for (const [key, label, view, headingId] of [
    ["projects", "Projects", "projects"], ["experience", "Experiences", "experience"],
    ["researchIdeas", "Research ideas", "ideas", "research-ideas-heading"],
    ["projectIdeas", "Project ideas", "ideas", "project-ideas-heading"],
  ]) {
    const button = make("button", "context-index-item"); button.type = "button";
    button.append(make("strong", "", counts[key]), make("span", "", label));
    button.addEventListener("click", () => {
      setView(view);
      if (headingId) window.requestAnimationFrame(() => {
        const heading = document.getElementById(headingId);
        if (heading) { heading.tabIndex = -1; heading.scrollIntoView({ block: "start" }); heading.focus({ preventScroll: true }); }
      });
    }); section.append(button);
  }
  return section;
}
function renderWorkstreamsView() {
const fragment = document.createDocumentFragment(); const workstreams = prioritizedWorkstreams();
const intro = make("section", "section-block"); intro.append(sectionHeading("all-workstreams-heading", "Current projects", `${workstreams.length} saved project records`));
intro.append(renderWorkstreamBoard(workstreams)); fragment.append(intro);
return fragment; }
function renderRunsView() { const fragment = document.createDocumentFragment();
const section = make("section", "section-block"); section.append(sectionHeading("runs-heading", "App-managed operations", "Ephemeral · never canonical by default"));
section.append(renderOperations()); fragment.append(section);
const boundary = make("section", "section-block"); boundary.append(sectionHeading("runs-boundary-heading", "Visibility boundary", "No background transcript watcher"));
boundary.append(renderBoundaryList([ "MyContext does not inspect other Codex or Claude tasks.",
"A future run must be explicitly registered with this local harness before it can appear here.", "Run status exposes phases, inputs, and artifacts—not hidden reasoning.",
"A completed run still requires human review before any durable context change.", ]));
fragment.append(boundary); return fragment;
} function renderIdeasView() {
const fragment = document.createDocumentFragment(); const ideas = state.entities
.filter((entity) => entity.type === "idea") .filter(matchesQuery)
.sort((left, right) => left.title.localeCompare(right.title));
const research = ideas.filter((idea) => idea.ideaKind === "research");
const projects = ideas.filter((idea) => idea.ideaKind === "project");
const researchSection = make("section", "section-block idea-section");
researchSection.append(sectionHeading("research-ideas-heading", "Research ideas", `${research.length} research question${research.length === 1 ? "" : "s"} to discuss`));
if (!research.length) researchSection.append(renderEmpty("No research idea matches this view.", "Change the search text or add a canonical research idea."));
else { const rail = make("div", "idea-trajectory"); research.forEach((idea, index) => rail.append(renderResearchIdea(idea, index)));
researchSection.append(rail); }
const projectSection = make("section", "section-block idea-section");
projectSection.append(sectionHeading("project-ideas-heading", "Project ideas", `${projects.length} possible build${projects.length === 1 ? "" : "s"} to explore`));
if (!projects.length) projectSection.append(renderEmpty("No project idea matches this view.", "Project ideas stay separate from current projects until selected."));
else { const incubator = make("div", "idea-incubator"); for (const idea of projects) incubator.append(renderProjectIdea(idea));
projectSection.append(incubator); }
fragment.append(researchSection, projectSection); return fragment;
} function renderResearchIdea(idea, index) {
const article = make("article", "research-idea"); const marker = make("div", "idea-marker");
marker.append(make("span", "idea-sequence", `R${String(index + 1).padStart(2, "0")}`), make("span", "idea-node"));
const body = make("div", "research-idea-body"); const header = make("header", "idea-card-header");
const title = make("button", "idea-title", idea.submission?.projectTitle || idea.title); title.type = "button";
title.addEventListener("click", () => openEntity(idea.id)); const status = make("span", "status-label", idea.status || "draft");
status.dataset.status = safeToken(idea.status); header.append(title, status); body.append(header);
const fields = make("div", "research-submission-grid"); fields.append(
ideaField("Project description", idea.submission?.projectDescription || idea.summary || "No project description is projected."),
ideaField("Advisor help", idea.submission?.advisorHelp || "No advisor-help statement is projected."));
body.append(fields, renderIdeaFooter(idea)); article.append(marker, body); return article;
} function renderProjectIdea(idea) {
const article = make("article", "project-idea-card"); const signal = make("div", "project-idea-signal");
signal.append(make("span", "idea-kind", "Project idea"), make("span", "status-label", idea.status || "draft"));
signal.lastChild.dataset.status = safeToken(idea.status); const title = make("button", "idea-title", idea.title); title.type = "button";
title.addEventListener("click", () => openEntity(idea.id)); article.append(signal, title,
make("p", "project-idea-summary", idea.summary || "No problem statement is projected."));
const tags = make("div", "tag-list"); for (const tag of asArray(idea.tags).slice(0, 4)) tags.append(make("span", "tag", tag));
article.append(tags, renderIdeaFooter(idea)); return article;
} function ideaField(label, value) {
const field = make("section", "idea-field"); field.append(make("h3", "", label), make("p", "", value)); return field;
} function renderIdeaFooter(idea) {
const footer = make("footer", "idea-footer"); footer.append(renderRelationTrail(idea)); return footer;
} function renderRecordsView(type) {
const fragment = document.createDocumentFragment(); const scope = type;
const records = state.entities .filter((entity) => entity.type === scope && entity.role !== "research")
.filter(matchesQuery) .sort((a, b) => a.title.localeCompare(b.title));
const section = make("section", "section-block"); const noun = ({
person: "people records", project: "project records", experience: "work experience records",
})[type] || "canonical records";
section.append(sectionHeading(`${type}-records-heading`, noun[0].toUpperCase() + noun.slice(1), `${records.length} visible from tracked Git HEAD`)); if (!records.length) {
section.append(renderEmpty(`No ${noun} match this view.`, "Change the search text or return to all context.")); } else {
const list = make("div", "record-list relation-record-list"); for (const record of records) list.append(renderRecordRow(record));
section.append(list); }
fragment.append(section); return fragment;
} function renderAtlasView() {
const fragment = document.createDocumentFragment(); const section = make("section", "section-block");
section.append(sectionHeading("atlas-heading", "Knowledge graph", "One hop by default · arrows follow explicit typed assertions"));
if (!state.graphNodes.length) {
section.append(renderEmpty("No visible graph records exist yet.", "The graph uses visible canonical records from the committed revision.")); } else {
const relations = visibleGraphRelations(); state.focusId = chooseFocusNode(state.graphNodes, relations, state.focusId);
section.append(buildFocusGraph());
if (!relations.length) section.append(renderEmpty("No assertions match these filters.", "Change the predicate, review, or validity filter to inspect other recorded assertions."));
const overview = make("details", "global-overview"); const summary = make("summary", "global-overview-toggle", "Global overview");
summary.append(make("span", "section-note", `Secondary · ${relations.length} filtered assertions`)); overview.append(summary, buildAtlas(state.graphNodes, relations));
section.append(overview); }
fragment.append(section); return fragment;
} function renderSystemView() {
const fragment = document.createDocumentFragment(); const repo = state.repo || {};
const snapshot = state.snapshot || {}; const counts = snapshot.counts || {};
const boundaries = snapshot.boundaries || {}; const capabilities = snapshot.capabilities || {};
const ledger = make("div", "system-ledger"); ledger.append(
ledgerGroup("Canonical source", [ ["Revision", shortRevision(repo.revision || snapshot.revision)],
["Branch", state.repo ? (repo.branch || "detached HEAD") : "status unavailable"], ["Projection", repo.canonicalSource || boundaries.canonicalSource || "git-head"],
["Working tree", state.repo ? (repo.dirty ? "local changes present; not projected" : "clean") : "status unavailable"], ]),
ledgerGroup("Knowledge shape", [ ["Visible records", counts.total ?? state.entities.length],
["Projects", counts.byType?.project ?? countType("project")], ["Work experiences", counts.byType?.experience ?? countType("experience")],
["Ideas", counts.byType?.idea ?? countType("idea")],
["People records", counts.byType?.person ?? countType("person")],
["Drafts", counts.byType?.draft ?? countType("draft")], ]),
ledgerGroup("Capabilities", [ ["Read", yesNo(capabilities.readOnly)],
["Repository writes", yesNo(capabilities.writes)], ["Email send", yesNo(capabilities.emailSend)],
["Operation introspection", yesNo(capabilities.operations)], ]),
ledgerGroup("Excluded by design", [ ["Restricted", boundaries.restricted || "excluded"],
["Session exports", boundaries.sources || "excluded"], ["Outreach", boundaries.outreach || "draft-only"],
["Operations", boundaries.operations || "not-instrumented"], ]),
); fragment.append(ledger);
const boundary = make("section", "section-block"); boundary.append(sectionHeading("system-boundary-heading", "Read-only boundaries", "Local and read-only"));
boundary.append(renderBoundaryList([ "Canonical entities are parsed from the committed Git HEAD, not dirty working-tree files.",
"Restricted context and session exports are excluded before data reaches the browser.", "Markdown is displayed as text; embedded HTML is never executed.",
"No send, schedule, apply, write, shell, or arbitrary-file control is present.", ]));
fragment.append(boundary); return fragment;
} function renderMargin() {
const items = reviewQueue(); dom.queueCount.textContent = String(items.length);
dom.mobileQueueCount.textContent = String(items.length); replaceChildren(dom.queue);
if (!state.snapshot) { dom.queue.append(make("p", "margin-empty", "Canonical review items are unavailable."));
return; }
if (!items.length) { dom.queue.append(make("p", "margin-empty", "Nothing needs your decision. No draft or context change was applied."));
return; }
for (const item of items) { const article = make("article", "margin-item");
article.append( make("span", "judgment-kind", reviewKind(item)),
make("h3", "", item.title || "Untitled review item"), make("p", "", reviewPrompt(item)),
); if (item.entityId && state.entityById.has(item.entityId)) {
const button = make("button", "inspect-button", "Inspect draft"); button.type = "button";
button.addEventListener("click", () => { closeMargin();
openEntity(item.entityId); });
article.append(button); }
dom.queue.append(article); }
} function renderJudgmentRow(item) {
const row = make("article", "judgment-row"); const title = make("div", "");
title.append(make("span", "judgment-kind", reviewKind(item)), make("h3", "", item.title || "Untitled review item")); row.append(title, make("p", "", reviewPrompt(item)));
if (item.entityId && state.entityById.has(item.entityId)) { const inspect = make("button", "inspect-button", "Inspect context");
inspect.type = "button"; inspect.addEventListener("click", () => openEntity(item.entityId));
row.append(inspect); } else {
row.append(make("span", "section-note", "No visible canonical target")); }
return row; }
function renderWorkstreamBoard(workstreams) { if (!workstreams.length) return renderEmpty("No project context is visible.", "Only tracked, non-restricted project records appear here.");
const board = make("div", "workstream-board"); workstreams.forEach((workstream, index) => {
const row = make("article", "workstream-row"); row.append(make("div", "workstream-index", String(index + 1).padStart(2, "0")));
const main = make("div", "workstream-main"); const titleButton = make("button", "text-button", workstream.title || workstream.id);
titleButton.type = "button"; titleButton.addEventListener("click", () => openEntity(workstream.id));
const heading = make("h3"); heading.append(titleButton);
main.append(heading, make("p", "", workstream.summary || "No summary is available in the tracked canonical record.")); const related = linkedIds(workstream);
if (related.length) { const thread = make("div", "entity-thread");
for (const id of related.slice(0, 5)) { const entity = state.entityById.get(id);
if (!entity) continue; const node = make("button", "thread-node", entity.title);
node.type = "button"; node.addEventListener("click", () => openEntity(entity.id));
thread.append(node); }
if (thread.childElementCount) main.append(thread); }
row.append(main); const focus = make("div", "workstream-focus");
focus.append(make("span", "", "Recorded next step")); focus.append(make("p", "", workstream.nextAction || attentionText(workstream)));
row.append(focus); board.append(row);
}); return board;
} function renderRecordRow(record) {
const row = make("article", "record-row relation-record"); const open = make("button", "record-open"); open.type = "button";
open.addEventListener("click", () => openEntity(record.id)); const title = make("span", "record-title");
title.append(make("strong", "", record.title), make("span", "record-id", record.id)); open.append(title, make("span", "record-summary", record.summary || "No summary available."));
const tags = make("span", "tag-list"); for (const tag of asArray(record.tags).slice(0, 3)) tags.append(make("span", "tag", tag));
open.append(tags); const status = make("span", "status-label", record.status || "unknown");
status.dataset.status = safeToken(record.status); open.append(status); row.append(open, renderRelationTrail(record));
return row; }

function renderRelationTrail(record) {
const trail = make("div", "relation-trail"); const header = make("div", "relation-trail-header");
header.append(make("span", "relation-trail-label", "Relation trail"));
if (state.graphNodeById.has(record.id)) { const focus = make("button", "relation-focus", "Focus in aperture"); focus.type = "button";
focus.addEventListener("click", () => openInAperture(record.id)); header.append(focus); }
trail.append(header); const items = relationTrail(state.relations, record.id);
if (!items.length) { trail.append(make("span", "relation-trail-empty", "No visible canonical links.")); return trail; }
const list = make("div", "relation-trail-nodes"); for (const item of items.slice(0, 4)) {
const related = state.entityById.get(item.otherId); if (!related) continue;
const marker = item.direction === "mutual" ? "↔" : item.direction === "outgoing" ? "→" : "←";
const predicate = item.relation.semanticStatus === "typed" ? humanize(item.relation.kind) : "Legacy link";
const button = make("button", `relation-trail-node is-${safeToken(item.relation.kind)}`, `${marker} ${predicate} · ${related.title}`); button.type = "button";
button.title = `${predicate} · ${humanize(item.relation.review)} · open canonical record`;
button.addEventListener("click", () => openEntity(related.id)); list.append(button); }
if (items.length > 4) list.append(make("span", "relation-trail-more", `+${items.length - 4}`));
trail.append(list, make("span", "relation-boundary", "Arrows show recorded declaration direction; no relationship is inferred.")); return trail;
}
function renderOperations() { const operations = asArray(state.snapshot?.operations);
if (!operations.length) { return renderEmpty(
"No app-managed task is running.", "Other Codex or Claude tasks are not inspected.",
); }
const list = make("div", "record-list"); for (const operation of operations) {
const row = make("div", "record-row"); const title = make("div", "record-title");
title.append(make("strong", "", operation.title || operation.id || "Local operation"), make("span", "record-id", operation.kind || "operation")); row.append(
title, make("span", "record-summary", operation.summary || operation.phase || "Registered with the local harness."),
make("span", "tag-list", operation.scope || "ephemeral"), );
const status = make("span", "status-label", operation.status || "running"); status.dataset.status = safeToken(operation.status);
row.append(status); list.append(row);
} return list;
}

function buildFocusGraph() {
const relations = visibleGraphRelations();
const focus = state.graphNodeById.get(state.focusId); const layout = layoutFocusGraph(
state.graphNodes, relations, state.focusId, state.focusDepth,
); const frame = make("div", "aperture-frame");
const toolbar = make("div", "aperture-toolbar"); const identity = make("div", "aperture-focus-identity");
identity.append(make("span", "eyebrow", "Current focus"), make("strong", "", focus?.title || "No focus"),
make("span", "relation-boundary", `${layout.nodes.length} visible nodes · ${layout.relations.length} recorded assertions`));
const controls = make("div", "aperture-controls"); const depthGroup = make("div", "aperture-depth");
depthGroup.setAttribute("aria-label", "Relationship depth"); for (const depth of [1, 2]) {
const button = make("button", `aperture-control${state.focusDepth === depth ? " is-active" : ""}`, depth === 1 ? "1 hop" : "Expand to 2");
button.type = "button"; button.dataset.depth = String(depth); button.setAttribute("aria-pressed", String(state.focusDepth === depth));
button.addEventListener("click", () => { state.focusDepth = depth; state.selectedRelationId = null; renderViewAndFocus(`[data-depth="${depth}"]`); }); depthGroup.append(button); }
const focusPicker = make("label", "connection-picker focus-picker"); focusPicker.append(make("span", "sr-only", "Change graph focus"));
const focusInput = make("input", "connection-target"); focusInput.type = "search"; focusInput.placeholder = "Focus ID or title…"; focusInput.setAttribute("list", "focus-targets");
const focusOptions = make("datalist"); focusOptions.id = "focus-targets"; for (const node of state.graphNodes.slice().sort((left, right) => String(left.title).localeCompare(String(right.title)))) {
const option = makeOption(node.id, node.title); option.label = `${node.title} · ${node.type}`; focusOptions.append(option); }
const applyFocus = () => { const id = resolveGraphTarget(focusInput.value); if (state.graphNodeById.has(id)) setGraphFocus(id); };
focusInput.addEventListener("change", applyFocus); focusInput.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); applyFocus(); } }); focusPicker.append(focusInput, focusOptions);
const targetLabel = make("label", "connection-picker"); targetLabel.append(make("span", "sr-only", "Find connection from current focus"));
const target = make("input", "connection-target"); target.type = "search"; target.placeholder = "Target ID or title…";
target.setAttribute("aria-label", "Connection target"); target.setAttribute("list", "graph-targets"); const targets = make("datalist"); targets.id = "graph-targets";
for (const node of state.graphNodes.filter((node) => node.id !== state.focusId).sort((left, right) => String(left.title).localeCompare(String(right.title)))) {
const option = makeOption(node.id, node.title); option.label = `${node.title} · ${node.type}`; targets.append(option); }
if (state.pathTargetId && state.pathTargetId !== state.focusId) target.value = state.pathTargetId; targetLabel.append(target, targets);
const trace = make("button", "aperture-control", "Trace"); trace.type = "button"; trace.addEventListener("click", () => traceConnection(resolveGraphTarget(target.value)));
target.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); traceConnection(resolveGraphTarget(target.value)); } });
const pathMode = make("select", "connection-mode"); pathMode.setAttribute("aria-label", "Path direction mode");
pathMode.append(makeOption("undirected", "Navigate either direction"), makeOption("directed", "Follow typed arrows")); pathMode.value = state.pathMode;
pathMode.addEventListener("change", () => { state.pathMode = pathMode.value; if (state.pathTargetId) traceConnection(state.pathTargetId); });
const zoomControls = make("div", "aperture-zoom"); zoomControls.setAttribute("aria-label", "Graph zoom");
const zoomOut = make("button", "aperture-control", "−"); zoomOut.type = "button"; zoomOut.setAttribute("aria-label", "Zoom out");
const fit = make("button", "aperture-control is-quiet", "Fit"); fit.type = "button";
const zoomIn = make("button", "aperture-control", "+"); zoomIn.type = "button"; zoomIn.setAttribute("aria-label", "Zoom in"); zoomControls.append(zoomOut, fit, zoomIn);
controls.append(depthGroup, focusPicker, targetLabel, pathMode, trace, zoomControls); if (state.pathResult || state.pathTargetId) { const clear = make("button", "aperture-control is-quiet", "Clear path");
clear.type = "button"; clear.addEventListener("click", clearConnection); controls.append(clear); }
toolbar.append(identity, controls); frame.append(toolbar);

frame.append(buildRelationFilters());

const workspace = make("div", "aperture-workspace"); const stage = make("div", "aperture-stage");
const svg = svgNode("svg", { class: "aperture-canvas", viewBox: `0 0 ${layout.width} ${layout.height}`,
role: "group", "aria-labelledby": "aperture-svg-title aperture-svg-description" });
svg.append(svgTextNode("title", { id: "aperture-svg-title" }, `Context aperture focused on ${focus?.title || "a record"}`),
svgTextNode("desc", { id: "aperture-svg-description" }, `A deterministic ${state.focusDepth === 2 ? "two-hop" : "one-hop"} view of explicit typed assertions and legacy links. Arrowheads show typed direction. Select an edge to inspect its provenance and evidence.`));
appendArrowMarker(svg); const viewport = svgNode("g", { class: "aperture-viewport" }); svg.append(viewport);
const pathRelationIds = new Set(asArray(state.pathResult?.relationIds)); const pathNodeIds = new Set(asArray(state.pathResult?.nodeIds));
for (const [index, relation] of layout.relations.entries()) appendFocusEdge(viewport, relation, layout.positions, {
selected: relation.id === state.selectedRelationId, path: pathRelationIds.has(relation.id),
}, parallelOffset(layout.relations, relation, index));
for (const node of layout.nodes) appendFocusNode(viewport, node, layout.positions.get(node.id), {
focus: node.id === state.focusId, path: pathNodeIds.has(node.id), distance: layout.distances.get(node.id),
});
const updateViewport = () => updateGraphViewport(svg, layout); zoomOut.addEventListener("click", () => { state.graphZoom = Math.max(0.6, state.graphZoom - 0.2); updateViewport(); });
zoomIn.addEventListener("click", () => { state.graphZoom = Math.min(2.5, state.graphZoom + 0.2); updateViewport(); }); fit.addEventListener("click", () => { state.graphZoom = 1; state.graphPanX = 0; state.graphPanY = 0; updateViewport(); });
bindGraphPanZoom(svg, layout); updateViewport(); stage.append(svg, renderMobileFocusTrail(state.focusId, layout)); workspace.append(stage, renderRelationPanel()); frame.append(workspace);
return frame;
}

function updateGraphViewport(svg, layout) { const width = layout.width / state.graphZoom; const height = layout.height / state.graphZoom;
const x = (layout.width - width) / 2 - state.graphPanX; const y = (layout.height - height) / 2 - state.graphPanY;
svg.setAttribute("viewBox", `${x} ${y} ${width} ${height}`); }

function bindGraphPanZoom(svg, layout) { let drag = null;
svg.addEventListener("wheel", (event) => { event.preventDefault(); state.graphZoom = Math.max(0.6, Math.min(2.5, state.graphZoom + (event.deltaY < 0 ? 0.12 : -0.12))); updateGraphViewport(svg, layout); }, { passive: false });
svg.addEventListener("pointerdown", (event) => { if (event.target.closest?.(".aperture-node, .aperture-edge-handle")) return; drag = { x: event.clientX, y: event.clientY, panX: state.graphPanX, panY: state.graphPanY }; svg.setPointerCapture(event.pointerId); svg.classList.add("is-panning"); });
svg.addEventListener("pointermove", (event) => { if (!drag) return; const scaleX = (layout.width / state.graphZoom) / Math.max(1, svg.clientWidth); const scaleY = (layout.height / state.graphZoom) / Math.max(1, svg.clientHeight);
state.graphPanX = drag.panX + (event.clientX - drag.x) * scaleX; state.graphPanY = drag.panY + (event.clientY - drag.y) * scaleY; updateGraphViewport(svg, layout); });
const end = () => { drag = null; svg.classList.remove("is-panning"); }; svg.addEventListener("pointerup", end); svg.addEventListener("pointercancel", end); }

function buildRelationFilters() {
const bar = make("div", "relation-filters"); const kinds = new Set(state.graphRelations.map((relation) => relation.kind));
const kind = make("select", "relation-filter"); kind.setAttribute("aria-label", "Filter relation predicate");
kind.append(makeOption("all", "All predicates")); for (const predicate of ["related_to", ...TYPED_RELATION_KINDS]) {
if (kinds.has(predicate)) kind.append(makeOption(predicate, humanize(predicate))); }
kind.value = state.relationKind; kind.addEventListener("change", () => { state.relationKind = kind.value; resetGraphInspection(); });
const review = make("select", "relation-filter"); review.setAttribute("aria-label", "Filter relation review state");
review.append(makeOption("default", "Current · not rejected"), makeOption("all", "All review states"),
makeOption("confirmed", "Confirmed"), makeOption("unreviewed", "Unreviewed"), makeOption("rejected", "Rejected"));
review.value = state.reviewState; review.addEventListener("change", () => { state.reviewState = review.value; resetGraphInspection(); });
const evidence = make("select", "relation-filter"); evidence.setAttribute("aria-label", "Filter relation evidence");
evidence.append(makeOption("all", "All evidence"), makeOption("present", "Has evidence"), makeOption("missing", "Evidence missing"));
evidence.value = state.evidenceState; evidence.addEventListener("change", () => { state.evidenceState = evidence.value; resetGraphInspection(); });
const validity = make("label", "relation-validity"); const checkbox = make("input"); checkbox.type = "checkbox";
checkbox.checked = state.includeOutOfValidity; checkbox.addEventListener("change", () => { state.includeOutOfValidity = checkbox.checked; resetGraphInspection(); });
validity.append(checkbox, make("span", "", "Include past / future")); bar.append(make("span", "eyebrow", "Show"), kind, review, evidence, validity,
make("span", "path-safety", "Paths always omit rejected and out-of-validity assertions."));
return bar;
}

function visibleGraphRelations() {
const filters = { includeOutOfValidity: state.includeOutOfValidity };
filters.evidence = state.evidenceState;
if (state.relationKind !== "all") filters.predicates = [state.relationKind];
if (state.reviewState === "all") filters.includeRejected = true;
else if (state.reviewState !== "default") { filters.reviews = [state.reviewState]; filters.includeRejected = state.reviewState === "rejected"; }
return filterRelations(state.graphRelations, filters);
}

function resetGraphInspection() {
state.selectedRelationId = null; state.pathResult = null; state.pathTargetId = null;
state.focusId = chooseFocusNode(state.graphNodes, visibleGraphRelations(), state.focusId); renderViewAndFocus(".relation-filter");
}

function appendArrowMarker(svg) {
const defs = svgNode("defs"); const marker = svgNode("marker", { id: "typed-arrow", viewBox: "0 0 8 8", refX: 7, refY: 4,
markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" }); marker.append(svgNode("path", { d: "M 0 0 L 8 4 L 0 8 z", class: "typed-arrowhead" }));
defs.append(marker); svg.append(defs);
}

function parallelOffset(relations, relation, index) {
const pair = [relation.from, relation.to].sort().join("\0"); const peers = relations.filter((candidate) => [candidate.from, candidate.to].sort().join("\0") === pair);
const peerIndex = peers.findIndex((candidate) => candidate.id === relation.id); return (peerIndex - (peers.length - 1) / 2) * 20;
}

function appendFocusEdge(svg, relation, positions, flags, offset = 0) {
  const from = positions.get(relation.from); const to = positions.get(relation.to); if (!from || !to) return;
const geometry = focusEdgeGeometry(from, to, offset); const left = state.entityById.get(relation.from); const right = state.entityById.get(relation.to);
const typed = relation.semanticStatus === "typed"; const kindClass = `is-${safeToken(relation.kind)}`;
const group = svgNode("g", { class: `aperture-edge-control${flags.selected ? " is-selected" : ""}${flags.path ? " is-path" : ""}`,
});
const edgeAttributes = { d: geometry.path, class: `aperture-edge ${typed ? "is-typed" : "is-generic"} ${kindClass}${flags.selected ? " is-selected" : ""}${flags.path ? " is-path" : ""}` };
if (typed) edgeAttributes["marker-end"] = "url(#typed-arrow)"; group.append(svgNode("path", edgeAttributes));
const relationSelector = `[data-relation-id="${CSS.escape(relation.id)}"]`;
const inspect = () => { state.selectedRelationId = relation.id; renderViewAndFocus(relationSelector); announce(`Opened ${humanize(relation.kind)} assertion details`); };
const handle = svgNode("circle", { cx: geometry.midpoint.x, cy: geometry.midpoint.y, r: 22,
class: `aperture-edge-handle${flags.selected ? " is-selected" : ""}${flags.path ? " is-path" : ""}`,
"data-relation-id": relation.id, tabindex: "0", role: "button", "aria-label": `Inspect ${humanize(relation.kind)} from ${left?.title || relation.from} to ${right?.title || relation.to}; ${humanize(relation.review)}` });
handle.append(svgTextNode("title", {}, typed ? `${humanize(relation.kind)} · directed · ${humanize(relation.review)}` : "Legacy link · reason not structured"));
handle.addEventListener("click", inspect); handle.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") {
event.preventDefault(); inspect(); } }); svg.append(group);
const marker = svgNode("circle", { cx: geometry.midpoint.x, cy: geometry.midpoint.y, r: 8,
class: `aperture-edge-marker ${typed ? "is-typed" : "is-generic"} ${kindClass}${flags.selected ? " is-selected" : ""}${flags.path ? " is-path" : ""}`, "aria-hidden": "true" });
svg.append(handle, marker); if (typed) svg.append(svgTextNode("text", { x: geometry.midpoint.x, y: geometry.midpoint.y - 13,
class: `aperture-edge-label ${kindClass}`, "text-anchor": "middle", "aria-hidden": "true" }, relation.label || humanize(relation.kind)));
}

function appendFocusNode(svg, node, box, flags) {
if (!box) return; const className = `aperture-node is-${safeToken(node.type)}${flags.focus ? " is-focus" : ""}${flags.path ? " is-path" : ""}`;
const action = flags.focus ? "Inspect" : "Focus on"; const group = svgNode("g", { class: className, tabindex: "0", role: "button",
"data-node-id": node.id,
"aria-label": `${action} ${node.title}; ${flags.distance === 0 ? "current focus" : `${flags.distance} hop${flags.distance === 1 ? "" : "s"} away`}` });
group.append(svgTextNode("title", {}, `${node.title} · ${node.type} · ${node.status}`), svgNode("rect", {
x: box.x, y: box.y, width: box.width, height: box.height, rx: flags.focus ? 18 : node.type === "person" ? box.height / 2 : 10,
class: "aperture-node-surface",
}));
const lines = wrapLabel(node.title, flags.focus ? 24 : 19); const title = svgNode("text", { x: box.x + 14, y: box.y + (flags.focus ? 30 : 23), class: "aperture-node-title" });
lines.forEach((line, index) => title.append(svgTextNode("tspan", { x: box.x + 14, dy: index === 0 ? 0 : 15 }, line))); group.append(title);
group.append(svgTextNode("text", { x: box.x + box.width - 13, y: box.y + box.height - 10,
class: "aperture-node-meta", "text-anchor": "end" }, flags.focus ? `${node.type} · inspect` : `${node.type} · refocus`));
const activate = () => flags.focus ? openEntity(node.id) : setGraphFocus(node.id);
group.addEventListener("click", activate); group.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") {
event.preventDefault(); activate(); } }); svg.append(group);
}

function renderMobileFocusTrail(focusId, layout) {
const region = make("section", "aperture-mobile-trail"); region.setAttribute("aria-label", "Focus relationships as a list");
region.append(make("h3", "", state.focusDepth === 2 ? "Records within two hops" : "Nearest records"));
const immediate = new Map(relationTrail(visibleGraphRelations(), focusId).map((item) => [item.otherId, item]));
const items = asArray(layout?.nodes).filter((node) => node.id !== focusId);
if (!items.length) { region.append(make("p", "relation-trail-empty", "This record has no visible graph neighbors.")); return region; }
const list = make("ul", "backlink-list"); for (const node of items) { const item = immediate.get(node.id); const distance = layout.distances.get(node.id);
const row = make("li", "backlink-item"); const button = make("button", "relation-list-button"); button.type = "button";
const direction = distance > 1 ? `${distance} hops away` : item?.direction === "mutual" ? "Declared both ways" : item?.direction === "outgoing" ? "Outgoing from focus" : "Incoming to focus";
const relationLabel = item ? humanize(item.relation.kind) : "Connection";
button.append(make("strong", "", node.title), make("span", "", `${direction} · ${relationLabel}`)); button.addEventListener("click", () => setGraphFocus(node.id));
row.append(button); list.append(row); } region.append(list); return region;
}

function renderRelationPanel() {
const panel = make("aside", "relation-panel"); panel.tabIndex = -1; panel.setAttribute("aria-live", "polite");
const relation = state.graphRelations.find((candidate) => candidate.id === state.selectedRelationId);
if (relation) { panel.append(renderWhyConnected(relation)); return panel; }
if (state.pathTargetId) { panel.append(renderConnectionResult()); return panel; }
const focus = state.graphNodeById.get(state.focusId); const references = relationReferences(state.graphRelations, state.focusId);
panel.append(make("span", "eyebrow", "Why connected?"), make("h3", "", focus?.title || "Current focus"),
make("p", "relation-panel-copy", "Select an edge to inspect its exact direction, source, evidence, review state, and validity. Spatial proximity is only navigation."));
const counts = make("dl", "relation-ledger"); counts.append(make("dt", "", "Outgoing declarations"), make("dd", "", String(references.outgoing.length)),
make("dt", "", "Incoming declarations"), make("dd", "", String(references.incoming.length)), make("dt", "", "Showing"), make("dd", "", `${visibleGraphRelations().length} assertions`),
make("dt", "", "Path mode"), make("dd", "", state.pathMode === "directed" ? "Typed arrows only" : "Either direction")); panel.append(counts, relationBoundaryNote()); return panel;
}

function renderWhyConnected(relation) {
const fragment = document.createDocumentFragment(); const declarations = asArray(relation.declarations);
const first = declarations[0] || { from: relation.from, to: relation.to }; const reverse = declarations.some((declaration) => declaration.from === first.to && declaration.to === first.from);
const source = state.entityById.get(first.from); const target = state.entityById.get(first.to); const typed = relation.semanticStatus === "typed";
const heading = !typed && reverse ? `${source?.title || first.from} ↔ ${target?.title || first.to}` : `${source?.title || first.from} → ${target?.title || first.to}`;
fragment.append(make("span", "eyebrow", "Why connected?"), make("h3", "", heading),
make("p", "relation-panel-copy", typed ? "This is an explicit directed assertion from canonical frontmatter. The dashboard does not add or infer relationships." : "This is a compatibility link. Its declaration is recorded, but its meaning and evidence are not structured."));
const ledger = make("dl", "relation-ledger"); ledger.append(make("dt", "", "Predicate"), make("dd", `relation-value is-${safeToken(relation.kind)}`, relation.label || humanize(relation.kind)),
make("dt", "", "Semantic status"), make("dd", "", typed ? "Typed assertion" : "Untyped legacy link"), make("dt", "", "Review"), make("dd", `review-state is-${safeToken(relation.review)}`, humanize(relation.review)),
make("dt", "", "Privacy"), make("dd", "", relation.privacy || "unknown"));
if (typed) ledger.append(make("dt", "", "Declared by"), make("dd", "", relation.declaredBy || relation.from),
make("dt", "", "Source path"), make("dd", "source-path", relation.sourcePath || "Not projected"), make("dt", "", "Valid"), make("dd", "", validityLabel(relation)));
fragment.append(ledger);
if (typed) fragment.append(renderEvidenceBlock(relation));
const declarationList = make("div", "relation-declarations"); declarationList.append(make("h4", "", "Recorded declarations"));
for (const declaration of declarations) { const from = state.entityById.get(declaration.from); const to = state.entityById.get(declaration.to);
declarationList.append(make("p", "", `${from?.title || declaration.from} → ${to?.title || declaration.to}`)); }
if (relation.note) declarationList.append(make("p", "relation-note", relation.note));
fragment.append(declarationList, relationBoundaryNote()); return fragment;
}

function renderEvidenceBlock(relation) {
const block = make("section", "relation-evidence"); block.append(make("h4", "", "Evidence"));
block.append(make("p", "", displayRelationValue(relation.evidence, "No evidence locator recorded.")));
if (asArray(relation.sources).length) { const list = make("ul", "source-list"); for (const source of relation.sources) list.append(make("li", "", displayRelationValue(source)));
block.append(make("h4", "", "Source locators"), list); }
return block;
}

function displayRelationValue(value, fallback = "") {
if (value === null || value === undefined || value === "") return fallback;
if (typeof value === "string") return value; if (Array.isArray(value)) return value.map((item) => displayRelationValue(item)).join(" · ");
try { return JSON.stringify(value); } catch { return String(value); }
}

function validityLabel(relation) {
if (!relation.validFrom && !relation.validTo) return "No time boundary";
return `${relation.validFrom ? formatDate(relation.validFrom) : "Open"} → ${relation.validTo ? formatDate(relation.validTo) : "Open"}`;
}

function renderConnectionResult() {
const fragment = document.createDocumentFragment(); const target = state.graphNodeById.get(state.pathTargetId);
fragment.append(make("span", "eyebrow", "Connection trail"), make("h3", "", target ? `${state.graphNodeById.get(state.focusId)?.title} → ${target.title}` : "Target unavailable"));
if (!state.pathResult) { fragment.append(make("p", "relation-panel-copy", state.pathMode === "directed" ? "No current, non-rejected path follows typed arrows to this target." : "No path exists across the currently visible assertions."), relationBoundaryNote()); return fragment; }
const list = make("ol", "connection-path"); for (const id of state.pathResult.nodeIds) { const node = state.graphNodeById.get(id);
const item = make("li", ""); const button = make("button", "connection-path-node", node?.title || id); button.type = "button";
button.addEventListener("click", () => setGraphFocus(id)); item.append(button); list.append(item); }
fragment.append(list, make("p", "relation-panel-copy", `${state.pathResult.relationIds.length} assertion${state.pathResult.relationIds.length === 1 ? "" : "s"} in the deterministic ${state.pathMode === "directed" ? "typed directed" : "navigation"} path.`));
if (state.pathResult.relationIds.length > 2) fragment.append(make("p", "relation-path-limit", "The full trail is listed here; the aperture highlights at most two hops from the current focus."));
fragment.append(relationBoundaryNote()); return fragment;
}

function relationBoundaryNote() { return make("p", "relation-boundary-note", "Only recorded assertions are shown. No endorsement, causality, fit, or evidence quality is inferred."); }
function resolveGraphTarget(value) { const query = String(value || "").trim().toLocaleLowerCase();
if (state.graphNodeById.has(value)) return value; return state.graphNodes.find((node) => String(node.title).toLocaleLowerCase() === query)?.id || value; }
function traceConnection(targetId) { if (!targetId || !state.graphNodeById.has(targetId)) return;
state.pathTargetId = targetId; state.pathResult = shortestPath(state.graphNodes, visibleGraphRelations(), state.focusId, targetId, {
mode: state.pathMode, includeRejected: false, includeOutOfValidity: false,
});
state.selectedRelationId = null; if (state.pathResult?.relationIds.length > 1) state.focusDepth = 2; renderViewAndFocus(".relation-panel");
announce(state.pathResult ? `Found a ${state.pathResult.relationIds.length}-link connection` : "No connection found"); }
function clearConnection() { state.pathTargetId = null; state.pathResult = null; renderViewAndFocus(".connection-target"); }
function setGraphFocus(id) { if (!state.graphNodeById.has(id)) return;
state.focusId = id; state.focusDepth = 1; state.selectedRelationId = null; state.pathTargetId = null; state.pathResult = null;
state.graphZoom = 1; state.graphPanX = 0; state.graphPanY = 0;
renderViewAndFocus(`[data-node-id="${CSS.escape(id)}"]`); announce(`Focused relationship view on ${state.graphNodeById.get(id).title}`); }
function openInAperture(id) { if (!state.graphNodeById.has(id)) return;
state.focusId = id; state.focusDepth = 1; state.selectedRelationId = null; state.pathTargetId = null; state.pathResult = null;
if (state.activeView === "atlas") renderViewAndFocus(`[data-node-id="${CSS.escape(id)}"]`); else {
setView("atlas"); window.requestAnimationFrame(() => focusElement(`[data-node-id="${CSS.escape(id)}"]`)); } }

function focusEdgeGeometry(from, to, offset = 0) { const fromCenter = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
const toCenter = { x: to.x + to.width / 2, y: to.y + to.height / 2 }; const start = rectangleIntersection(from, toCenter);
const end = rectangleIntersection(to, fromCenter); const bend = Math.min(72, Math.abs(end.x - start.x) * 0.18 + Math.abs(end.y - start.y) * 0.08);
const normalX = end.y === start.y ? 0 : Math.sign(end.y - start.y) * bend; const normalY = end.x === start.x ? 0 : -Math.sign(end.x - start.x) * bend;
const length = Math.hypot(end.x - start.x, end.y - start.y) || 1; const offsetX = -(end.y - start.y) / length * offset; const offsetY = (end.x - start.x) / length * offset;
const midpointX = (start.x + end.x) / 2 + normalX + offsetX; const midpointY = (start.y + end.y) / 2 + normalY + offsetY;
return { path: `M ${start.x} ${start.y} Q ${midpointX} ${midpointY} ${end.x} ${end.y}`,
midpoint: { x: (start.x + 2 * midpointX + end.x) / 4, y: (start.y + 2 * midpointY + end.y) / 4 } }; }
function rectangleIntersection(box, target) { const centerX = box.x + box.width / 2; const centerY = box.y + box.height / 2;
const dx = target.x - centerX; const dy = target.y - centerY; if (!dx && !dy) return { x: centerX, y: centerY };
const scale = Math.min(Math.abs((box.width / 2) / (dx || Number.EPSILON)), Math.abs((box.height / 2) / (dy || Number.EPSILON)));
return { x: centerX + dx * scale, y: centerY + dy * scale }; }
function makeOption(value, label) { const option = make("option", "", label); option.value = value; return option; }

function buildAtlas(nodes, edges) {
const frame = make("div", "atlas-frame"); const toolbar = make("div", "atlas-toolbar");
const legend = make("div", "atlas-legend"); legend.append(
legendKey("legend-shape is-domain", "Domain"), legendKey("legend-shape is-idea", "Idea"), legendKey("legend-shape", "Project"),
legendKey("legend-shape is-experience", "Experience"),
legendKey("legend-shape is-person", "Person"), legendKey("legend-shape is-profile", "Profile"),
legendKey("legend-shape is-journal", "Journal"), legendKey("legend-shape is-draft", "Draft"),
legendKey("legend-line is-typed", "Typed · arrow shows direction"), legendKey("legend-line is-generic", "Legacy · untyped"), );
toolbar.append(legend, make("span", "section-note", "Select any node to bring it into focus")); frame.append(toolbar);
const layout = layoutAtlas(nodes); const scroll = make("div", "atlas-scroll"); const svg = svgNode("svg", {
class: "atlas-canvas", viewBox: `0 0 ${layout.width} ${layout.height}`,
role: "group", "aria-labelledby": "atlas-svg-title atlas-svg-description",
}); svg.append(
svgTextNode("title", { id: "atlas-svg-title" }, "MyContext global relationship overview"), svgTextNode("desc", { id: "atlas-svg-description" }, "Visible canonical records are arranged by type. Solid arrowed lines are typed assertions; dashed lines are untyped legacy links."),
); appendArrowMarker(svg); appendAtlasLanes(svg, layout.lanes);
const visibleById = new Map(layout.nodes.map((node) => [node.id, node])); for (const [index, edge] of edges.entries()) {
if (!visibleById.has(edge.from) || !visibleById.has(edge.to)) continue; appendAtlasEdge(svg, edge, layout.positions.get(edge.from), layout.positions.get(edge.to), parallelOffset(edges, edge, index));
} for (const node of layout.nodes) appendAtlasNode(svg, node, layout.positions.get(node.id));
scroll.append(svg); frame.append(scroll);
return frame; }
function appendAtlasLanes(svg, lanes) {
for (const lane of lanes) { svg.append(svgTextNode("text", { x: lane.x, y: 25, class: "atlas-lane-label" }, lane.label.toUpperCase()));
svg.append(svgNode("line", { x1: lane.x, y1: 36, x2: lane.x + lane.width, y2: 36, class: "atlas-lane-rule" })); }
} function appendAtlasEdge(svg, edge, from, to, offset = 0) {
const typed = edge.semanticStatus === "typed"; const attributes = { d: focusEdgeGeometry(from, to, offset).path,
class: `atlas-edge ${typed ? "is-typed" : "is-generic"} is-${safeToken(edge.kind)}` };
if (typed) attributes["marker-end"] = "url(#typed-arrow)"; const path = svgNode("path", attributes);
path.append(svgTextNode("title", {}, `${humanize(edge.kind)} · ${typed ? "directed" : "untyped"} · ${humanize(edge.review)}`)); svg.append(path);
} function appendAtlasNode(svg, node, box) {
const group = svgNode("g", { class: `atlas-node is-${safeToken(node.type)}`,
tabindex: "0", role: "button",
"aria-label": `Focus relationship view on ${node.title}`, });
group.append(svgTextNode("title", {}, `${node.title} · ${node.type} · ${node.status}`)); const radius = node.type === "domain" ? 26 : node.type === "person" ? 18 : node.type === "experience" ? 10 : node.type === "idea" ? 2 : node.type === "journal" ? 12 : 4;
group.append(svgNode("rect", { x: box.x,
y: box.y, width: box.width,
height: box.height, rx: radius,
class: "node-surface", }));
const lines = wrapLabel(node.title, 29); const title = svgNode("text", { x: box.x + 15, y: box.y + 23, class: "atlas-node-title" });
lines.slice(0, 2).forEach((line, index) => { title.append(svgTextNode("tspan", { x: box.x + 15, dy: index === 0 ? 0 : 15 }, line));
}); group.append(title);
group.append(svgTextNode("text", { x: box.x + box.width - 14,
y: box.y + box.height - 10, class: "atlas-node-meta",
"text-anchor": "end", }, `${node.type} · ${node.status}`));
const inspect = () => setGraphFocus(node.id); group.addEventListener("click", inspect);
group.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") {
event.preventDefault(); inspect();
} });
svg.append(group); }
async function openEntity(id) { if (!id || !state.entityById.has(id)) return;
const summary = state.entityById.get(id); state.inspectorRequest += 1;
const requestId = state.inspectorRequest; dom.inspectorKicker.textContent = `${summary.type} · ${summary.privacy}`;
dom.inspectorTitle.textContent = summary.title; dom.inspectorRevision.textContent = shortRevision(state.snapshot?.revision);
replaceChildren(dom.inspectorBody, renderSkeleton()); if (!dom.inspector.open) dom.inspector.showModal();
announce(`Opened ${summary.title}`); try {
const revision = state.snapshot?.revision; let detail = state.detailCache.get(id); if (!detail) {
const payload = await getJson(API.entity(id, revision));
if (payload.revision && revision && payload.revision !== revision) { const changed = new Error("Context changed; refresh the page before opening this record."); changed.code = "revision_changed"; throw changed; }
detail = payload.entity; state.detailCache.set(id, detail); }
if (requestId !== state.inspectorRequest) return; renderInspector(detail);
} catch (error) { if (requestId !== state.inspectorRequest) return;
const changed = error?.code === "revision_changed" || error?.status === 409;
replaceChildren(dom.inspectorBody, renderError(changed ? "Context changed; refresh" : "Record unavailable", readableError(error))); }
} function renderInspector(entity) {
dom.inspectorKicker.textContent = `${entity.type} · ${entity.privacy}`; dom.inspectorTitle.textContent = entity.title;
const fragment = document.createDocumentFragment(); const meta = make("div", "entity-meta-strip");
for (const value of [entity.status, entity.role, formatDate(entity.updated), entity.path]) { if (value) meta.append(make("span", "meta-chip", value));
} fragment.append(meta);
const sections = asArray(entity.sections); if (sections.length) {
for (const section of sections) { if (!section?.title) continue;
const block = make("section", "entity-section"); block.append(make("h3", "", section.title));
block.append(make("p", "", section.body || "No content recorded.")); fragment.append(block);
} } else {
const block = make("section", "entity-section"); block.append(make("h3", "", "Canonical body"));
block.append(make("p", "entity-raw", entity.body || entity.summary || "No content recorded.")); fragment.append(block);
} const references = relationReferences(state.relations, entity.id);
if (references.outgoing.length || references.incoming.length) fragment.append(renderInspectorRelations(entity, references));
if (asArray(entity.sources).length) { const sourceSection = make("section", "entity-section");
sourceSection.append(make("h3", "", "Source locators")); const sources = make("ul", "source-list");
for (const source of entity.sources) sources.append(make("li", "", source)); sourceSection.append(sources);
fragment.append(sourceSection); }
replaceChildren(dom.inspectorBody, fragment); }

function renderInspectorRelations(entity, references) {
const section = make("section", "entity-section relation-inspector"); const heading = make("div", "relation-inspector-heading");
heading.append(make("h3", "", "Relationship index")); if (state.graphNodeById.has(entity.id)) { const focus = make("button", "relation-focus", "Focus in aperture");
focus.type = "button"; focus.addEventListener("click", () => { dom.inspector.close(); openInAperture(entity.id); }); heading.append(focus); }
section.append(heading, make("p", "relation-boundary", "Arrows preserve each recorded declaration. Typed predicates, evidence, review, and time bounds are displayed without inference."));
if (references.outgoing.length) section.append(renderReferenceGroup("Outgoing declarations", references.outgoing, "Outgoing"));
if (references.incoming.length) section.append(renderReferenceGroup("Incoming declarations", references.incoming, "Incoming"));
return section;
}

function renderReferenceGroup(title, references, directionLabel) {
const group = make("div", "backlink-group"); group.append(make("h4", "", `${title} · ${references.length}`)); const list = make("ul", "backlink-list");
for (const reference of references) { const related = state.entityById.get(reference.otherId); if (!related) continue;
const item = make("li", "backlink-item"); const button = make("button", "relation-list-button"); button.type = "button";
const typed = reference.relation.semanticStatus === "typed"; const detail = typed
? `${directionLabel} · ${humanize(reference.relation.kind)} · ${humanize(reference.relation.review)}${reference.relation.sourcePath ? ` · ${reference.relation.sourcePath}` : ""}`
: `${directionLabel} · legacy link · reason not structured`;
button.append(make("strong", "", related.title), make("span", "", detail)); button.addEventListener("click", () => openEntity(related.id));
item.append(button); list.append(item); } group.append(list); return group;
}
function renderSearchResults() { const query = state.query.toLocaleLowerCase();
if (!query) { closeSearch();
return; }
const matches = state.entities .filter((entity) => state.scope === "all" || entity.type === state.scope)
.filter((entity) => searchableText(entity).includes(query)) .slice(0, 12);
replaceChildren(dom.searchResults); if (!matches.length) {
dom.searchResults.append(make("p", "search-empty", "No visible canonical record matches this search.")); } else {
for (const entity of matches) { const result = make("button", "search-result");
result.type = "button"; result.append(
make("span", "search-result-type", entity.type), make("span", "", ""),
make("span", "status-label", entity.status), );
const copy = result.children[1]; copy.append(make("strong", "", entity.title), make("small", "", entity.summary || entity.id));
result.addEventListener("click", () => { dom.search.value = "";
state.query = ""; closeSearch();
openEntity(entity.id); });
dom.searchResults.append(result); }
} dom.searchResults.hidden = false;
dom.search.setAttribute("aria-expanded", "true"); }
function closeSearch() { dom.searchResults.hidden = true;
dom.search.setAttribute("aria-expanded", "false"); }
function openMargin() { if (!dom.marginMedia.matches) return;
dom.margin.inert = false; dom.spine.inert = true; dom.desk.inert = true; dom.skipLink.inert = true;
dom.margin.setAttribute("role", "dialog"); dom.margin.setAttribute("aria-modal", "true");
dom.margin.classList.add("is-open");
dom.marginToggle.setAttribute("aria-expanded", "true"); dom.marginScrim.hidden = false;
dom.marginClose.focus(); }
function closeMargin() { if (!dom.margin.classList.contains("is-open")) return;
dom.margin.classList.remove("is-open"); dom.marginToggle.setAttribute("aria-expanded", "false");
dom.marginScrim.hidden = true; dom.spine.inert = false; dom.desk.inert = false;
dom.skipLink.inert = false; dom.margin.removeAttribute("role"); dom.margin.removeAttribute("aria-modal");
dom.margin.inert = dom.marginMedia.matches; dom.marginToggle.focus();
} function resetMarginForViewport() {
const mobile = dom.marginMedia.matches; dom.margin.classList.remove("is-open");
dom.marginToggle.setAttribute("aria-expanded", "false"); dom.marginScrim.hidden = true;
dom.spine.inert = false; dom.desk.inert = false; dom.skipLink.inert = false;
dom.margin.removeAttribute("role"); dom.margin.removeAttribute("aria-modal"); dom.margin.inert = mobile;
} function reviewQueue() {
return asArray(state.snapshot?.reviewItems).filter((item) => item?.state !== "resolved"); }
function prioritizedWorkstreams() { return rankWorkstreams(state.snapshot?.workstreams); }
function reviewKind(item) { if (item.kind === "draft") return "Draft · manual review";
return `${humanize(item.kind || "review")} · review`; }
function reviewPrompt(item) { if (item.kind === "draft") {
return "Check its claims and disclosure boundary against linked evidence. This draft is not finalized, signed, sent, or otherwise recorded as used."; }
return item.reason || item.summary || "Inspect the linked context and make the decision manually."; }
function linkedIds(workstream) { const ids = [...asArray(workstream.linkedPeople), ...asArray(workstream.linkedEntities)];
return [...new Set(ids)].filter((id) => state.entityById.has(id)); }
function attentionText(workstream) { const attention = asArray(workstream.attention);
if (attention.length) return `Review: ${attention.slice(0, 3).join(" · ")}`; return "No explicit next action is recorded in the canonical project page.";
} function matchesQuery(entity) {
if (!state.query) return true; return searchableText(entity).includes(state.query.toLocaleLowerCase());
} function searchableText(entity) {
return [entity.id, entity.title, entity.summary, ...asArray(entity.aliases), ...asArray(entity.tags)] .filter(Boolean)
.join(" ") .toLocaleLowerCase();
} function atlasNodeVisible(node) {
return ["domain", "idea", "project", "experience", "person", "profile", "journal", "draft"].includes(node.type); }
function atlasPath(from, to) { if (Math.abs(from.x - to.x) < 40) {
const x = from.x + from.width * 0.5; const fromY = from.y + from.height;
const toY = to.y; const bendX = x - 58;
return [`M ${x} ${fromY} C ${bendX} ${fromY}, ${bendX} ${toY}, ${x} ${toY}`, bendX, (fromY + toY) / 2]; }
const left = from.x < to.x ? from : to; const right = from.x < to.x ? to : from;
const startX = left.x + left.width; const startY = left.y + left.height / 2;
const endX = right.x; const endY = right.y + right.height / 2;
const control = (endX - startX) * 0.46; return [
`M ${startX} ${startY} C ${startX + control} ${startY}, ${endX - control} ${endY}, ${endX} ${endY}`, (startX + endX) / 2,
(startY + endY) / 2 - 5, ];
} function sectionHeading(id, title, note) {
const header = make("header", "section-heading"); const heading = make("h2", "", title);
heading.id = id; header.append(heading);
if (note) header.append(make("p", "", note)); return header;
} function renderEmpty(title, body) {
const box = make("div", "empty-state"); const content = make("div");
content.append(make("span", "empty-state-symbol"), make("h3", "", title), make("p", "", body)); box.append(content);
return box; }
function renderError(title, body) { const box = make("div", "error-state");
const content = make("div"); content.append(make("h2", "", title), make("p", "", body));
box.append(content); return box;
} function renderLoadError() {
return renderError( "Canonical context is unavailable.",
state.loadError || "The local projection API did not return a snapshot. No fallback data was invented.", );
} function renderSkeleton() {
const box = make("div"); box.setAttribute("aria-label", "Loading canonical record");
box.append(make("div", "skeleton-line"), make("div", "skeleton-line"), make("div", "skeleton-line")); return box;
} function renderBoundaryList(items) {
const list = make("ul", "boundary-list"); for (const item of items) list.append(make("li", "", item));
return list; }
function ledgerGroup(title, pairs) { const group = make("section", "ledger-group");
group.append(make("h3", "", title)); const list = make("dl", "ledger-list");
for (const [term, description] of pairs) { list.append(make("dt", "", term), make("dd", "", String(description ?? "—")));
} group.append(list);
return group; }
function legendKey(className, label) { const key = make("span", "legend-key");
key.append(make("span", className), make("span", "", label)); return key;
} function make(tag, className = "", text) {
const element = document.createElement(tag); if (className) element.className = className;
if (text !== undefined) element.textContent = String(text); return element;
} function svgNode(tag, attributes = {}) {
const element = document.createElementNS("http://www.w3.org/2000/svg", tag); for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
return element; }
function svgTextNode(tag, attributes, text) { const element = svgNode(tag, attributes);
element.textContent = text; return element;
} function replaceChildren(parent, ...children) {
parent.replaceChildren(...children); }
function focusElement(selector) { const element = document.querySelector(selector);
if (element && typeof element.focus === "function") element.focus({ preventScroll: true }); }
function renderViewAndFocus(selector) { renderView();
window.requestAnimationFrame(() => focusElement(selector)); }
function asArray(value) { return Array.isArray(value) ? value : [];
} function countType(type) {
return state.entities.filter((entity) => entity.type === type).length; }
function humanize(value) { return String(value).replaceAll(/[_-]+/g, " ").replace(/^./, (letter) => letter.toUpperCase());
} function safeToken(value) {
return String(value || "unknown").toLocaleLowerCase().replace(/[^a-z0-9_-]+/g, "-"); }
function shortRevision(value) { const revision = String(value || "");
return revision ? revision.slice(0, 8) : "unavailable"; }
function formatDate(value) { const date = new Date(value);
if (Number.isNaN(date.getTime())) return value || ""; return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(date);
} function yesNo(value) {
return value === true ? "available" : value === false ? "not available" : "unknown"; }
function readableError(error) { if (error?.name === "AbortError") return "The local API timed out.";
return error?.message || "Unknown local API error."; }
function reducedMotion() { return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
} function wrapLabel(value, maxLength) {
const words = String(value).split(/\s+/).filter(Boolean); const lines = [];
let current = ""; for (const word of words) {
const candidate = current ? `${current} ${word}` : word; if (candidate.length > maxLength && current) {
lines.push(current); current = word;
} else { current = candidate;
} }
if (current) lines.push(current); if (lines.length > 2) lines[1] = `${lines[1].slice(0, Math.max(1, maxLength - 1))}…`;
return lines.slice(0, 2); }
function announce(message) { dom.liveRegion.textContent = "";
window.setTimeout(() => { dom.liveRegion.textContent = message;
}, 10); }
