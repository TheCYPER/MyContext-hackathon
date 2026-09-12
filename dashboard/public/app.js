import { TYPED_RELATION_KINDS, buildRelations, chooseFocusNode, filterRelations,
layoutAtlas, layoutFocusGraph, relationReferences, relationTrail, rankWorkstreams,
academicContextCounts, isSyntheticDemo, viewAvailable, shortestPath, expandGraphNeighborhood, suggestRelatedRecords } from "./model.mjs";

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
graphZoom: 1, graphPanX: 0, graphPanY: 0, graphFiltersOpen: false, graphPathOpen: false, graphDrafts: {},
autoRefresh: true, refreshing: false, syncMessage: "Connecting…", newGraphIds: new Set(), graphRetainedIds: [], graphLimit: 200, validityDay: null,
activeView: "desk", query: "",
scope: "all", inspectorRequest: 0,
loadError: null, repoError: null, };
const dom = {}; document.addEventListener("DOMContentLoaded", initialize);
async function initialize() { cacheDom(); bindEvents(); selectInitialView();
await refreshContext();
window.setInterval(() => { if (state.autoRefresh && !document.hidden) refreshContext(); }, 5000);
document.addEventListener("visibilitychange", () => { if (state.autoRefresh && !document.hidden) refreshContext(); });
window.addEventListener("focus", () => { if (state.autoRefresh && !document.hidden) refreshContext(); });
}

async function refreshContext(manual = false) {
if (state.refreshing) return; state.refreshing = true; updateSyncStatus();
try {
const [snapshotResult, repoResult] = await Promise.allSettled([getJson(API.snapshot), getJson(API.repo)]);
if (snapshotResult.status !== "fulfilled") throw snapshotResult.reason;
const snapshot = snapshotResult.value.snapshot;
if (!snapshot?.revision || !Array.isArray(snapshot.entities) || !Array.isArray(snapshot.graph?.nodes)) throw new Error("The local API returned an incomplete graph.");
const today = new Date().toISOString().slice(0, 10); const changed = snapshot.revision !== state.snapshot?.revision || state.validityDay !== today; const initial = !state.snapshot;
state.repoError = repoResult.status === "fulfilled" ? null : readableError(repoResult.reason);
state.repo = repoResult.status === "fulfilled" && repoResult.value.repo.revision === snapshot.revision ? repoResult.value.repo : null;
if (changed) {
const oldNodes = state.graphNodes; const oldIds = new Set(oldNodes.map((node) => node.id)); const oldEdges = new Set(state.graphRelations.map((edge) => edge.id));
const active = document.activeElement; const activeId = active?.id; let fieldValue = active instanceof HTMLInputElement ? active.value : null;
const selection = fieldValue !== null ? [active.selectionStart, active.selectionEnd] : null;
const disclosures = [...document.querySelectorAll(".global-overview, .aperture-mobile-trail")].map((el) => [el.className.split(" ")[0], el.open]);
const inspectorId = dom.inspector.open ? dom.inspector.dataset.entityId : null;
state.validityDay = today; state.snapshot = snapshot; state.entities = snapshot.entities; state.entityById = new Map(state.entities.map((entity) => [entity.id, entity]));
state.graphNodes = asArray(snapshot.graph.nodes).filter(atlasNodeVisible); state.graphNodeById = new Map(state.graphNodes.map((node) => [node.id, node]));
state.relations = buildRelations(state.entities, snapshot.graph.edges);
state.graphRelations = state.relations.filter((edge) => state.graphNodeById.has(edge.from) && state.graphNodeById.has(edge.to));
state.newGraphIds = initial ? new Set() : new Set(state.graphNodes.filter((node) => !oldIds.has(node.id)).map((node) => node.id));
const removedNodes = oldNodes.filter((node) => !state.graphNodeById.has(node.id)); const removed = removedNodes.length;
if (removedNodes.some((node) => fieldValue === node.id || fieldValue === node.title)) fieldValue = "";
for (const [key, value] of Object.entries(state.graphDrafts)) if (removedNodes.some((node) => value === node.id || value === node.title)) state.graphDrafts[key] = "";
const addedEdges = state.graphRelations.filter((edge) => !oldEdges.has(edge.id)).length;
state.detailCache.clear(); state.inspectorRequest += 1;
state.graphRetainedIds = state.graphRetainedIds.filter((id) => state.graphNodeById.has(id));
const oldFocus = state.focusId; state.focusId = chooseFocusNode(state.graphNodes, state.graphRelations, oldFocus);
if (oldFocus && oldFocus !== state.focusId) { state.graphRetainedIds = []; state.focusDepth = 1; resetGraphViewport(); }
if (!visibleGraphRelations().some((edge) => edge.id === state.selectedRelationId)) state.selectedRelationId = null;
if (state.pathTargetId && state.graphNodeById.has(state.pathTargetId) && state.pathTargetId !== state.focusId) {
state.pathResult = shortestPath(state.graphNodes, visibleGraphRelations(), state.focusId, state.pathTargetId, { mode: state.pathMode });
} else { state.pathTargetId = null; state.pathResult = null; }
state.loadError = null; updateCapabilityNavigation(); dom.demoLabel.hidden = !isSyntheticDemo(state.entities);
renderMargin(); renderView(); renderSearchResults();
for (const [className, open] of disclosures) { const element = document.querySelector(`.${className}`); if (element) element.open = open; }
if (activeId) { const replacement = document.getElementById(activeId); if (replacement) { if (fieldValue !== null) { replacement.value = fieldValue; if (selection?.[0] !== null) replacement.setSelectionRange?.(...selection); } replacement.focus({ preventScroll: true }); } }
if (inspectorId) {
if (state.entityById.has(inspectorId)) openEntity(inspectorId);
else { delete dom.inspector.dataset.entityId; dom.inspectorTitle.textContent = "Record no longer available"; dom.inspectorKicker.textContent = "Context updated"; dom.inspectorRevision.textContent = shortRevision(snapshot.revision);
replaceChildren(dom.inspectorBody, make("p", "", "This record was removed or is no longer visible. Its previous contents have been cleared.")); }
}
state.syncMessage = initial ? "Watching saved context" : `Updated · ${state.newGraphIds.size} new records · ${addedEdges} new connections${removed ? ` · ${removed} removed` : ""}`;
if (!initial) announce(state.syncMessage);
} else if (manual || state.loadError) { state.syncMessage = "Up to date"; announce("Context is up to date"); }
state.loadError = null; finishLoading(); updateRepositoryStatus();
} catch (error) { state.loadError = readableError(error); state.syncMessage = state.snapshot ? "Update failed · showing the last loaded revision" : "Unable to load context"; finishLoading(); if (!state.snapshot) renderView(); if (manual) announce(state.syncMessage); }
finally { state.refreshing = false; updateSyncStatus(); }
}

function updateSyncStatus() {
if (!dom.refreshButton) return; dom.refreshButton.disabled = state.refreshing; dom.refreshButton.textContent = state.refreshing ? "Checking…" : "Refresh";
dom.syncStatus.textContent = `${state.syncMessage}${state.repo?.dirty ? " · Uncommitted edits appear after commit" : ""}`;
dom.autoRefresh.checked = state.autoRefresh;
}

function cacheDom() {
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
dom.refreshButton = document.getElementById("refresh-context"); dom.syncStatus = document.getElementById("context-sync-status"); dom.autoRefresh = document.getElementById("auto-refresh");
dom.marginMedia = window.matchMedia("(max-width: 960px)"); }
function bindEvents() { dom.refreshButton.addEventListener("click", () => refreshContext(true)); dom.autoRefresh.addEventListener("change", () => { state.autoRefresh = dom.autoRefresh.checked; if (state.autoRefresh) refreshContext(true); else { state.syncMessage = "Automatic updates paused"; updateSyncStatus(); } });
for (const item of dom.navItems) {
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
if (event.key === "Tab" && dom.margin.classList.contains("is-open") && !dom.inspector.open) {
const controls = [...dom.margin.querySelectorAll('button, a[href], input, select, textarea, [tabindex="0"]')].filter((element) => !element.disabled && element.getClientRects().length);
const first = controls[0]; const last = controls.at(-1);
if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
}
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
window.requestAnimationFrame(() => { const active = dom.navItems.find((item) => item.dataset.view === state.activeView); const nav = active?.parentElement;
if (!nav || nav.scrollWidth <= nav.clientWidth) return; const rect = active.getBoundingClientRect(); const bounds = nav.getBoundingClientRect();
if (rect.left < bounds.left || rect.right > bounds.right) nav.scrollLeft += rect.left - bounds.left - (bounds.width - rect.width) / 2; });
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
function finishLoading() { dom.loadBanner.hidden = false; dom.loadBanner.classList.remove("is-error"); if (state.loadError) {
dom.loadBanner.classList.add("is-error"); replaceChildren(dom.loadBanner, make("span", "", `${state.snapshot ? "Update failed; displaying the last loaded revision" : "MyContext could not load context"}: ${state.loadError}. Use Refresh to retry.`));
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
if (state.repo.dirty) dom.repoOrbit.classList.add("is-alert"); const revision = shortRevision(state.snapshot.revision);
const branch = state.repo.branch || "detached HEAD"; const stateLabel = state.repo.dirty ? "working tree has local changes" : "working tree clean";
dom.repoShortStatus.textContent = `${branch} · ${revision} · ${stateLabel}`; dom.revisionLabel.textContent = `Tracked Git HEAD · ${branch} · ${revision}`;
} function renderView() {
if (document.body.dataset.view !== state.activeView) { document.body.dataset.view = state.activeView; resetMarginForViewport(); }
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
section.append(sectionHeading("atlas-heading", "Knowledge graph", `${state.graphNodes.length} records · read-only exploration`));
if (!state.graphNodes.length) {
section.append(renderEmpty("No visible graph records exist yet.", "The graph uses visible canonical records from the committed revision.")); } else {
const relations = visibleGraphRelations(); state.focusId = chooseFocusNode(state.graphNodes, relations, state.focusId);
section.append(buildFocusGraph());

const overview = make("details", "global-overview"); const summary = make("summary", "global-overview-toggle", "Global overview");
summary.append(make("span", "section-note", `${state.graphNodes.length} records · ${relations.length} connections`)); overview.append(summary, buildAtlas(state.graphNodes, relations));
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
const predicate = relationDisplayLabel(item.relation);
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
const focus = state.graphNodeById.get(state.focusId); const layout = currentGraphLayout(); const frame = make("div", "aperture-frame");
const toolbar = make("div", "aperture-toolbar"); const identity = make("div", "aperture-focus-identity");
identity.append(make("span", "eyebrow", "Current focus"), make("strong", "", focus?.title || "No focus"),
make("span", "relation-boundary", `${layout.nodes.length} records · ${layout.relations.length} connections in view`));
const controls = make("div", "aperture-controls"); const depthGroup = make("div", "aperture-depth");
depthGroup.setAttribute("role", "group"); depthGroup.setAttribute("aria-label", "Relationship depth");
for (const depth of [1, 2]) {
const button = make("button", `aperture-control${state.focusDepth === depth ? " is-active" : ""}`, depth === 1 ? "1 hop" : "2 hops");
button.type = "button"; button.dataset.depth = String(depth); button.setAttribute("aria-pressed", String(state.focusDepth === depth));
button.title = depth === 1 ? "Show directly connected records" : "Include neighbors of connected records";
button.addEventListener("click", () => { state.focusDepth = depth; state.graphRetainedIds = []; state.pathTargetId = null; state.pathResult = null; state.selectedRelationId = null; resetGraphViewport(); renderViewAndFocus(`[data-depth="${depth}"]`); }); depthGroup.append(button); }
const focusPicker = buildGraphPicker("focus-picker", "Find a record", "Search records…", state.graphNodes, setGraphFocus);
const inspectFocus = make("button", "aperture-control is-quiet", "Open record ↗"); inspectFocus.type = "button";
inspectFocus.addEventListener("click", () => openEntity(state.focusId));
const grow = make("button", "aperture-control graph-grow", "Grow connections +"); grow.type = "button"; grow.disabled = !layout.frontierIds.length;
grow.title = "Reveal another layer without hiding the records already shown"; grow.addEventListener("click", () => growGraph());
controls.append(focusPicker.element, depthGroup, grow, inspectFocus); toolbar.append(identity, controls); frame.append(toolbar);
const pathbar = make("div", "aperture-pathbar");
const targetPicker = buildGraphPicker("path-picker", "Find a connection", "Search a destination…", state.graphNodes.filter((node) => node.id !== state.focusId), traceConnection);
if (state.pathTargetId) targetPicker.input.value = state.graphNodeById.get(state.pathTargetId)?.title || "";
const modeField = make("label", "graph-filter-field"); modeField.append(make("span", "graph-field-label", "Path direction"));
const pathMode = make("select", "connection-mode"); pathMode.setAttribute("aria-label", "Path direction mode");
pathMode.append(makeOption("undirected", "Either direction"), makeOption("directed", "Follow typed arrows")); pathMode.value = state.pathMode;
pathMode.addEventListener("change", () => { state.pathMode = pathMode.value; if (state.pathTargetId) traceConnection(state.pathTargetId); }); modeField.append(pathMode);
const trace = make("button", "aperture-control", "Find path →"); trace.type = "button"; trace.addEventListener("click", targetPicker.apply);
pathbar.append(targetPicker.element, modeField, trace);
if (state.pathTargetId) { const clear = make("button", "aperture-control is-quiet", "Clear path"); clear.type = "button"; clear.addEventListener("click", clearConnection); pathbar.append(clear); }
const pathTools = make("details", "graph-path-tools"); pathTools.open = state.graphPathOpen || !!state.pathTargetId; pathTools.addEventListener("toggle", () => { state.graphPathOpen = pathTools.open; });
const pathToggle = make("summary", "graph-tools-toggle", "Find a path"); pathToggle.append(make("span", "", "Between this focus and another record"));
pathTools.append(pathToggle, pathbar); frame.append(pathTools, buildRelationFilters());
if (layout.hiddenNodeCount || (layout.nodes.length >= state.graphLimit && layout.frontierIds.length)) { const limit = make("div", "graph-growth-note"); limit.append(make("span", "", `Showing ${layout.nodes.length} records. More connected records are available. `)); const more = make("button", "aperture-control", "Show 100 more"); more.type = "button"; more.addEventListener("click", () => { state.graphLimit += 100; growGraph(); }); limit.append(more); frame.append(limit); }
const zoomControls = make("div", "aperture-zoom"); zoomControls.setAttribute("role", "group"); zoomControls.setAttribute("aria-label", "Graph zoom");
const zoomOut = make("button", "aperture-control", "−"); zoomOut.type = "button"; zoomOut.setAttribute("aria-label", "Zoom out");
const fit = make("button", "aperture-control is-quiet", "Fit"); fit.type = "button"; fit.title = "Reset zoom and center the graph";
const zoomIn = make("button", "aperture-control", "+"); zoomIn.type = "button"; zoomIn.setAttribute("aria-label", "Zoom in");
const zoomReadout = make("output", "graph-zoom-value", `${Math.round(state.graphZoom * 100)}%`); zoomReadout.setAttribute("aria-label", "Zoom level");
zoomControls.append(zoomOut, zoomReadout, zoomIn, fit);

const workspace = make("div", "aperture-workspace"); const stage = make("div", "aperture-stage");
const svg = svgNode("svg", { class: "aperture-canvas", viewBox: `0 0 ${layout.width} ${layout.height}`,
role: "group", tabindex: "0", preserveAspectRatio: "xMidYMin meet", "aria-labelledby": "aperture-svg-title aperture-svg-description" });
svg.append(svgTextNode("title", { id: "aperture-svg-title" }, `Context aperture focused on ${focus?.title || "a record"}`),
svgTextNode("desc", { id: "aperture-svg-description" }, `A growing view of recorded connections, including retained records and the full selected path. Arrowheads show typed direction. Select an edge to inspect its provenance and evidence.`));
appendArrowMarker(svg); const viewport = svgNode("g", { class: "aperture-viewport" }); svg.append(viewport);
const pathRelationIds = new Set(asArray(state.pathResult?.relationIds)); const pathNodeIds = new Set(asArray(state.pathResult?.nodeIds));
const offsets = parallelOffsets(layout.relations);
for (const [index, relation] of layout.relations.entries()) appendFocusEdge(viewport, relation, layout.positions, {
selected: relation.id === state.selectedRelationId, path: pathRelationIds.has(relation.id),
}, offsets.get(relation.id) || 0);
for (const node of layout.nodes) appendFocusNode(viewport, node, layout.positions.get(node.id), {
focus: node.id === state.focusId, path: pathNodeIds.has(node.id), distance: layout.distances.get(node.id), isNew: state.newGraphIds.has(node.id),
});
const updateViewport = () => { updateGraphViewport(svg, layout); zoomReadout.value = `${Math.round(state.graphZoom * 100)}%`;
zoomOut.disabled = state.graphZoom <= 0.6; zoomIn.disabled = state.graphZoom >= 8; }; zoomOut.addEventListener("click", () => { state.graphZoom = Math.max(0.6, state.graphZoom - 0.2); updateViewport(); });
zoomIn.addEventListener("click", () => { state.graphZoom = Math.min(8, state.graphZoom + 0.2); updateViewport(); }); fit.addEventListener("click", () => { resetGraphViewport(); updateViewport(); });
if (!layout.relations.length) stage.append(make("p", "graph-empty-message", relations.length ? "This record has no connections under these filters. Search another record or reset filters to explore." : "No connections match your filters. Reset filters to see current recorded connections."));
const stageToolbar = make("div", "aperture-stage-toolbar"); const legend = make("div", "graph-legend"); legend.setAttribute("aria-label", "Graph legend");
for (const [kind, label] of [["typed", "→ Typed connection"], ["generic", "− Link / source reference"]]) legend.append(make("span", `graph-legend-item is-${kind}`, label));
stageToolbar.append(legend, zoomControls);
const help = make("p", "graph-canvas-help", "Drag to pan · Ctrl/⌘ + scroll to zoom · Focus canvas: arrows to pan, +/− to zoom, 0 to fit");
bindGraphPanZoom(svg, layout, updateViewport); updateViewport(); stage.append(stageToolbar, svg, help, renderMobileFocusTrail(state.focusId, layout)); workspace.append(stage, renderRelationPanel()); frame.append(workspace);
return frame;
}

function currentGraphLayout() {
const retained = [...new Set([...state.graphRetainedIds, ...asArray(state.pathResult?.nodeIds)])];
return layoutFocusGraph(state.graphNodes, visibleGraphRelations(), state.focusId, state.focusDepth, { retainIds: retained, maxNodes: state.graphLimit });
}
function growGraph(fromId = null) {
const layout = currentGraphLayout(); const growth = expandGraphNeighborhood(state.graphNodes, visibleGraphRelations(), layout.nodes.map((node) => node.id), { fromIds: fromId ? [fromId] : layout.frontierIds, maxNodes: state.graphLimit });
state.graphRetainedIds = growth.nodeIds; resetGraphViewport(); renderViewAndFocus(".graph-grow");
announce(growth.addedIds.length ? `Added ${growth.addedIds.length} connected records; ${growth.nodeIds.length} now visible` : "All available connections at this limit are visible");
}

function updateGraphViewport(svg, layout) { const width = layout.width / state.graphZoom; const height = layout.height / state.graphZoom;
const x = (layout.width - width) / 2 - state.graphPanX; const y = (layout.height - height) / 2 - state.graphPanY;
svg.setAttribute("viewBox", `${x} ${y} ${width} ${height}`); }

function resetGraphViewport() { state.graphZoom = 1; state.graphPanX = 0; state.graphPanY = 0; }

function bindGraphPanZoom(svg, layout, updateViewport) { let drag = null;
svg.addEventListener("wheel", (event) => { if (!event.ctrlKey && !event.metaKey) return;
event.preventDefault(); state.graphZoom = Math.max(0.6, Math.min(8, state.graphZoom + (event.deltaY < 0 ? 0.12 : -0.12))); updateViewport(); }, { passive: false });
svg.addEventListener("keydown", (event) => { if (event.target !== svg) return;
const step = 50 / state.graphZoom;
if (["+", "="].includes(event.key)) state.graphZoom = Math.min(8, state.graphZoom + 0.2);
else if (event.key === "-") state.graphZoom = Math.max(0.6, state.graphZoom - 0.2);
else if (event.key === "0" || event.key === "Home") resetGraphViewport();
else if (event.key === "ArrowLeft") state.graphPanX += step;
else if (event.key === "ArrowRight") state.graphPanX -= step;
else if (event.key === "ArrowUp") state.graphPanY += step;
else if (event.key === "ArrowDown") state.graphPanY -= step;
else return; event.preventDefault(); updateViewport(); });
svg.addEventListener("pointerdown", (event) => { if (event.button !== 0 || event.target.closest?.(".aperture-node, .aperture-edge-handle, .graph-edge-hit")) return;
drag = { id: event.pointerId, x: event.clientX, y: event.clientY, panX: state.graphPanX, panY: state.graphPanY }; svg.setPointerCapture(event.pointerId); svg.classList.add("is-panning"); });
svg.addEventListener("pointermove", (event) => { if (!drag || event.pointerId !== drag.id) return;
const matrix = svg.getScreenCTM(); if (!matrix) return;
state.graphPanX = drag.panX + (event.clientX - drag.x) / matrix.a; state.graphPanY = drag.panY + (event.clientY - drag.y) / matrix.d; updateViewport(); });
const end = () => { drag = null; svg.classList.remove("is-panning"); }; svg.addEventListener("pointerup", end); svg.addEventListener("pointercancel", end); svg.addEventListener("lostpointercapture", end); }

function buildGraphPicker(id, label, placeholder, nodes, onSelect) {
const element = make("div", "graph-picker"); const fieldLabel = make("label", "graph-field-label", label); fieldLabel.htmlFor = id;
const input = make("input", "connection-target"); input.id = id; input.type = "search"; input.placeholder = placeholder; input.autocomplete = "off"; input.value = state.graphDrafts[id] || "";
input.setAttribute("role", "combobox"); input.setAttribute("aria-autocomplete", "list"); input.setAttribute("aria-expanded", "false"); input.setAttribute("aria-controls", `${id}-results`);
const results = make("ul", "graph-picker-results"); results.id = `${id}-results`; results.setAttribute("role", "listbox"); results.setAttribute("aria-label", label); results.hidden = true;
const message = make("span", "graph-picker-message"); message.id = `${id}-message`; message.setAttribute("role", "status"); message.hidden = true; input.setAttribute("aria-describedby", message.id);
let matches = []; let active = -1;
const close = () => { results.hidden = true; input.setAttribute("aria-expanded", "false"); input.removeAttribute("aria-activedescendant"); active = -1; };
const choose = (node) => { close(); message.hidden = true; input.removeAttribute("aria-invalid"); input.value = node.title; state.graphDrafts[id] = node.title; onSelect(node.id); };
const highlight = () => { [...results.children].forEach((option, index) => option.setAttribute("aria-selected", String(index === active)));
if (active >= 0) { input.setAttribute("aria-activedescendant", `${id}-option-${active}`); results.children[active]?.scrollIntoView({ block: "nearest" }); } };
const search = () => { const query = input.value.trim().toLocaleLowerCase(); active = -1; input.removeAttribute("aria-activedescendant"); input.removeAttribute("aria-invalid");
matches = nodes.filter((node) => `${node.title} ${node.id} ${node.type}`.toLocaleLowerCase().includes(query)).sort((a, b) => String(a.title).localeCompare(String(b.title))).slice(0, 12);
results.replaceChildren(); for (const [index, node] of matches.entries()) { const option = make("li", "graph-picker-option"); option.id = `${id}-option-${index}`; option.setAttribute("role", "option"); option.setAttribute("aria-selected", "false");
option.append(make("strong", "", node.title), make("span", "", `${humanize(node.type)} · ${node.id}`)); option.addEventListener("pointerdown", (event) => event.preventDefault()); option.addEventListener("click", () => choose(node)); results.append(option); }
results.hidden = !matches.length; input.setAttribute("aria-expanded", String(matches.length > 0)); message.hidden = !!matches.length; message.textContent = "No matching records. Try another title or type."; };
const apply = () => { const exact = nodes.filter((node) => node.id === input.value.trim() || String(node.title).toLocaleLowerCase() === input.value.trim().toLocaleLowerCase());
if (active >= 0 && matches[active]) choose(matches[active]); else if (exact.length === 1) choose(exact[0]); else if (matches.length === 1 && input.value.trim()) choose(matches[0]);
else { input.focus(); message.textContent = "Choose a record from the search results."; message.hidden = false; input.setAttribute("aria-invalid", "true"); } };
input.addEventListener("input", () => { state.graphDrafts[id] = input.value; search(); }); input.addEventListener("focus", search);
input.addEventListener("keydown", (event) => { if (["ArrowDown", "ArrowUp"].includes(event.key)) { event.preventDefault(); if (results.hidden) search();
if (matches.length) { active = active < 0 ? (event.key === "ArrowDown" ? 0 : matches.length - 1) : (active + (event.key === "ArrowDown" ? 1 : -1) + matches.length) % matches.length; highlight(); } }
else if (event.key === "Enter") { event.preventDefault(); apply(); } else if (event.key === "Escape") { event.stopPropagation(); close(); message.hidden = true; } });
element.addEventListener("focusout", (event) => { if (!element.contains(event.relatedTarget)) { close(); message.hidden = true; } });
element.append(fieldLabel, input, results, message); return { element, input, apply };
}

function buildRelationFilters() {
const disclosure = make("details", "graph-filter-tools"); disclosure.open = state.graphFiltersOpen;
disclosure.addEventListener("toggle", () => { if (disclosure.isConnected) state.graphFiltersOpen = disclosure.open; });
const activeCount = [state.relationKind !== "all", state.reviewState !== "default", state.evidenceState !== "all", state.includeOutOfValidity].filter(Boolean).length;
const summary = make("summary", "graph-tools-toggle", activeCount ? `Filters · ${activeCount} active` : "Filters");
summary.append(make("span", "", `${visibleGraphRelations().length} of ${state.graphRelations.length} connections`)); disclosure.append(summary);
const bar = make("div", "relation-filters"); const kinds = new Set(state.graphRelations.map((relation) => relation.kind));
const kind = make("select", "relation-filter"); kind.setAttribute("aria-label", "Filter relation predicate");
kind.append(makeOption("all", "All predicates")); for (const predicate of ["related_to", ...TYPED_RELATION_KINDS]) {
if (kinds.has(predicate) || state.relationKind === predicate) kind.append(makeOption(predicate, `${humanize(predicate)}${kinds.has(predicate) ? "" : " · 0 connections"}`)); }
kind.value = state.relationKind; kind.addEventListener("change", () => { state.relationKind = kind.value; resetGraphInspection("#graph-kind-filter"); });
const review = make("select", "relation-filter"); review.setAttribute("aria-label", "Filter relation review state");
review.append(makeOption("default", "Current · not rejected"), makeOption("all", "All review states"),
makeOption("confirmed", "Confirmed"), makeOption("unreviewed", "Unreviewed"), makeOption("rejected", "Rejected"));
review.value = state.reviewState; review.addEventListener("change", () => { state.reviewState = review.value; resetGraphInspection("#graph-review-filter"); });
const evidence = make("select", "relation-filter"); evidence.setAttribute("aria-label", "Filter relation evidence");
evidence.append(makeOption("all", "All evidence"), makeOption("present", "Has evidence"), makeOption("missing", "Evidence missing"));
evidence.value = state.evidenceState; evidence.addEventListener("change", () => { state.evidenceState = evidence.value; resetGraphInspection("#graph-evidence-filter"); });
const validity = make("label", "relation-validity"); const checkbox = make("input"); checkbox.type = "checkbox";
checkbox.checked = state.includeOutOfValidity; checkbox.addEventListener("change", () => { state.includeOutOfValidity = checkbox.checked; resetGraphInspection("#graph-validity-filter"); });
checkbox.id = "graph-validity-filter"; validity.append(checkbox, make("span", "", "Include past / future"));
for (const [control, label, id] of [[kind, "Relationship", "graph-kind-filter"], [review, "Review", "graph-review-filter"], [evidence, "Evidence", "graph-evidence-filter"]]) {
control.id = id; const field = make("label", "graph-filter-field"); field.append(make("span", "graph-field-label", label), control); bar.append(field); }
bar.append(validity);
const filtered = state.relationKind !== "all" || state.reviewState !== "default" || state.evidenceState !== "all" || state.includeOutOfValidity;
if (filtered) { const reset = make("button", "aperture-control is-quiet graph-reset-filters", "Reset filters"); reset.type = "button";
reset.addEventListener("click", () => { state.relationKind = "all"; state.reviewState = "default"; state.evidenceState = "all"; state.includeOutOfValidity = false; resetGraphInspection(); }); bar.append(reset); }
disclosure.append(bar); return disclosure;
}

function visibleGraphRelations() {
const filters = { includeOutOfValidity: state.includeOutOfValidity };
filters.evidence = state.evidenceState;
if (state.relationKind !== "all") filters.predicates = [state.relationKind];
if (state.reviewState === "all") filters.includeRejected = true;
else if (state.reviewState !== "default") { filters.reviews = [state.reviewState]; filters.includeRejected = state.reviewState === "rejected"; }
return filterRelations(state.graphRelations, filters);
}

function resetGraphInspection(selector = "#graph-kind-filter") {
state.selectedRelationId = null; state.pathResult = null; state.pathTargetId = null;
resetGraphViewport(); state.focusId = chooseFocusNode(state.graphNodes, visibleGraphRelations(), state.focusId); renderViewAndFocus(selector); announce(`${visibleGraphRelations().length} connections match the filters`);
}

function appendArrowMarker(svg, id = "typed-arrow") {
const defs = svgNode("defs"); const marker = svgNode("marker", { id, viewBox: "0 0 8 8", refX: 7, refY: 4,
markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" }); marker.append(svgNode("path", { d: "M 0 0 L 8 4 L 0 8 z", class: "typed-arrowhead" }));
defs.append(marker); svg.append(defs);
}

function parallelOffsets(relations) {
const groups = new Map(); const offsets = new Map();
for (const relation of relations) { const key = [relation.from, relation.to].sort().join("\0"); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(relation); }
for (const peers of groups.values()) peers.forEach((relation, index) => offsets.set(relation.id, (index - (peers.length - 1) / 2) * 20));
return offsets;
}

function appendFocusEdge(svg, relation, positions, flags, offset = 0) {
  const from = positions.get(relation.from); const to = positions.get(relation.to); if (!from || !to) return;
const geometry = focusEdgeGeometry(from, to, offset); const left = state.graphNodeById.get(relation.from); const right = state.graphNodeById.get(relation.to);
const typed = relation.semanticStatus === "typed"; const kindClass = `is-${safeToken(relation.kind)}`;
const group = svgNode("g", { "data-from": relation.from, "data-to": relation.to, class: `aperture-edge-control${flags.selected ? " is-selected" : ""}${flags.path ? " is-path" : ""}`,
});
const edgeAttributes = { d: geometry.path, class: `aperture-edge ${typed ? "is-typed" : "is-generic"} ${kindClass}${flags.selected ? " is-selected" : ""}${flags.path ? " is-path" : ""}` };
if (typed) edgeAttributes["marker-end"] = "url(#typed-arrow)"; group.append(svgNode("path", edgeAttributes));
const inspect = () => inspectGraphRelation(relation.id);
const hit = svgNode("path", { d: geometry.path, class: "graph-edge-hit", "aria-hidden": "true" }); hit.addEventListener("click", inspect); group.append(hit);
const handle = svgNode("circle", { cx: geometry.midpoint.x, cy: geometry.midpoint.y, r: 22,
class: `aperture-edge-handle${flags.selected ? " is-selected" : ""}${flags.path ? " is-path" : ""}`,
"data-relation-id": relation.id, "aria-pressed": String(flags.selected), tabindex: "0", role: "button", "aria-label": `Inspect ${humanize(relation.kind)} from ${left?.title || relation.from} to ${right?.title || relation.to}; ${humanize(relation.review)}` });
handle.append(svgTextNode("title", {}, typed ? `${humanize(relation.kind)} · directed · ${humanize(relation.review)}` : `${relationDisplayLabel(relation)} · reason not structured`));
handle.addEventListener("click", inspect); handle.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") {
event.preventDefault(); inspect(); } }); svg.append(group);
const marker = svgNode("circle", { cx: geometry.midpoint.x, cy: geometry.midpoint.y, r: 8,
class: `aperture-edge-marker ${typed ? "is-typed" : "is-generic"} ${kindClass}${flags.selected ? " is-selected" : ""}${flags.path ? " is-path" : ""}`, "aria-hidden": "true" });
group.append(handle, marker); if (typed) group.append(svgTextNode("text", { x: geometry.midpoint.x, y: geometry.midpoint.y - 13,
class: `aperture-edge-label ${kindClass}`, "text-anchor": "middle", "aria-hidden": "true" }, relation.label || humanize(relation.kind)));
}

function appendFocusNode(svg, node, box, flags) {
if (!box) return; const className = `aperture-node is-${safeToken(node.type)}${flags.focus ? " is-focus" : ""}${flags.path ? " is-path" : ""}${flags.isNew ? " is-new" : ""}`;
const action = flags.focus ? "Inspect" : "Focus on"; const group = svgNode("g", { class: className, tabindex: "0", role: "button",
"data-node-id": node.id,
"aria-label": `${action} ${node.title}; ${flags.distance === 0 ? "current focus" : flags.distance === null ? "retained record" : `${flags.distance} hop${flags.distance === 1 ? "" : "s"} away`}` });
group.append(svgTextNode("title", {}, `${node.title} · ${node.type} · ${node.status}`), svgNode("rect", {
x: box.x, y: box.y, width: box.width, height: box.height, rx: flags.focus ? 18 : node.type === "person" ? box.height / 2 : 10,
class: "aperture-node-surface",
}));
const lines = wrapLabel(node.title, flags.focus ? 24 : 19); const title = svgNode("text", { x: box.x + 14, y: box.y + (flags.focus ? 30 : 23), class: "aperture-node-title" });
lines.forEach((line, index) => title.append(svgTextNode("tspan", { x: box.x + 14, dy: index === 0 ? 0 : 15 }, line))); group.append(title);
group.append(svgTextNode("text", { x: box.x + box.width - 13, y: box.y + box.height - 10,
class: "aperture-node-meta", "text-anchor": "end" }, flags.focus ? `${node.type} · inspect` : `${node.type} · refocus`));
const highlight = () => { const canvas = svg.closest("svg"); const neighbors = new Set([node.id]); for (const edge of canvas.querySelectorAll(".aperture-edge-control")) { const connected = edge.dataset.from === node.id || edge.dataset.to === node.id; edge.classList.toggle("is-muted", !connected); if (connected) { neighbors.add(edge.dataset.from); neighbors.add(edge.dataset.to); } } for (const card of canvas.querySelectorAll(".aperture-node")) card.classList.toggle("is-muted", !neighbors.has(card.dataset.nodeId)); };
const clearHighlight = () => { for (const element of svg.closest("svg").querySelectorAll(".is-muted")) element.classList.remove("is-muted"); };
group.addEventListener("pointerenter", highlight); group.addEventListener("pointerleave", clearHighlight); group.addEventListener("focus", highlight); group.addEventListener("blur", clearHighlight);
const activate = () => flags.focus ? openEntity(node.id) : setGraphFocus(node.id);
group.addEventListener("click", activate); group.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") {
event.preventDefault(); activate(); } }); svg.append(group);
}

function renderMobileFocusTrail(focusId, layout) {
const region = make("details", "aperture-mobile-trail"); region.open = window.matchMedia("(max-width: 760px)").matches;
const items = asArray(layout?.nodes).filter((node) => node.id !== focusId);
region.append(make("summary", "", `Revealed records · ${items.length}`));
const trail = relationTrail(visibleGraphRelations(), focusId);
if (!items.length) { region.append(make("p", "relation-trail-empty", "No connected records match this view. Try another record or reset the filters.")); return region; }
const list = make("ul", "backlink-list"); for (const node of items) { const connections = trail.filter((item) => item.otherId === node.id); const distance = layout.distances.get(node.id);
const row = make("li", "backlink-item"); const button = make("button", "relation-list-button"); button.type = "button";
button.append(make("strong", "", node.title), make("span", "", `${humanize(node.type)} · ${distance === null ? "Retained record" : distance > 1 ? `${distance} hops away` : `${connections.length} direct connection${connections.length === 1 ? "" : "s"}`} · Focus →`));
button.addEventListener("click", () => setGraphFocus(node.id)); row.append(button);
if (layout.frontierIds.includes(node.id)) { const expand = make("button", "aperture-control", "Expand connections +"); expand.type = "button"; expand.setAttribute("aria-label", `Expand connections from ${node.title}`); expand.addEventListener("click", () => growGraph(node.id)); row.append(expand); }
for (const item of connections) { const inspect = make("button", "graph-list-connection", `${item.direction === "mutual" ? "↔" : item.direction === "outgoing" ? "→" : "←"} ${relationDisplayLabel(item.relation)} · ${humanize(item.relation.review)}`);
inspect.type = "button"; inspect.setAttribute("aria-label", `Inspect ${humanize(item.relation.kind)} connection with ${node.title}`); inspect.addEventListener("click", () => inspectGraphRelation(item.relation.id)); row.append(inspect); }
list.append(row); } region.append(list); return region;
}

function inspectGraphRelation(id) { state.selectedRelationId = id; renderViewAndFocus(".relation-panel");
window.requestAnimationFrame(() => { if (window.matchMedia("(max-width: 1200px)").matches) document.querySelector(".relation-panel")?.scrollIntoView({ block: "nearest", behavior: reducedMotion() ? "auto" : "smooth" }); });
announce("Connection details opened"); }

function renderRelationPanel() {
const panel = make("aside", "relation-panel"); panel.tabIndex = -1; panel.setAttribute("aria-live", "polite");
const relation = state.graphRelations.find((candidate) => candidate.id === state.selectedRelationId);
if (relation) { const close = make("button", "aperture-control is-quiet graph-close-detail", state.pathTargetId ? "← Back to path" : "← Back to focus"); close.type = "button";
close.addEventListener("click", () => { state.selectedRelationId = null; renderViewAndFocus(".relation-panel"); }); panel.append(close, renderWhyConnected(relation)); return panel; }
if (state.pathTargetId) { panel.append(renderConnectionResult()); return panel; }
const focus = state.graphNodeById.get(state.focusId); const references = relationReferences(visibleGraphRelations(), state.focusId);
panel.append(make("span", "eyebrow", "Focus details"), make("h3", "", focus?.title || "Current focus"),
make("p", "relation-panel-copy", "Select an edge to inspect its exact direction, source, evidence, review state, and validity. Spatial proximity is only navigation."));
const counts = make("dl", "relation-ledger"); counts.append(make("dt", "", "Outgoing declarations"), make("dd", "", String(references.outgoing.length)),
make("dt", "", "Incoming declarations"), make("dd", "", String(references.incoming.length)), make("dt", "", "Showing"), make("dd", "", `${new Set([...references.outgoing, ...references.incoming].map((item) => item.relation.id)).size} connections at focus`),
make("dt", "", "Path mode"), make("dd", "", state.pathMode === "directed" ? "Typed arrows only" : "Either direction")); panel.append(counts);
const actions = make("div", "graph-panel-actions"); const open = make("button", "aperture-control", "Read this record ↗"); open.type = "button"; open.addEventListener("click", () => openEntity(state.focusId)); actions.append(open); panel.append(actions, relationBoundaryNote(), renderGraphSuggestions()); return panel;
}

function renderGraphSuggestions() {
const section = make("section", "graph-suggestions"); section.append(make("h4", "", "Possible connections"), make("p", "", "Suggestions from shared tags or neighbors. These are not recorded links or verified claims."));
const candidates = suggestRelatedRecords(state.graphNodes, state.graphRelations, state.focusId);
if (!candidates.length) { section.append(make("p", "", "No unlinked records share enough context yet. New records and links can reveal more suggestions.")); return section; }
for (const candidate of candidates) { const item = make("div", "graph-suggestion"); item.append(make("strong", "", candidate.node.title));
const reasons = []; if (candidate.sharedTags.length) reasons.push(`Shared tags: ${candidate.sharedTags.join(", ")}`);
if (candidate.sharedNeighborIds.length) reasons.push(`Shared neighbors: ${candidate.sharedNeighborIds.map((id) => state.graphNodeById.get(id)?.title || id).join(", ")}`);
item.append(make("p", "", reasons.join(". ")));
const inspect = make("button", "aperture-control is-quiet", "Read record"); inspect.type = "button"; inspect.addEventListener("click", () => openEntity(candidate.node.id));
item.append(inspect, buildLinkProposal(candidate.node.id, reasons)); section.append(item); }
return section;
}

function buildLinkProposal(targetId, reasons = ["Manually selected for review"]) {
const container = make("div", "graph-link-review");
const propose = make("button", "aperture-control", "Prepare link for review"); propose.type = "button";
propose.addEventListener("click", () => { const existing = container.querySelector(".graph-proposal"); if (existing) { existing.remove(); propose.setAttribute("aria-expanded", "false"); return; }
const source = state.entityById.get(state.focusId); const proposal = make("div", "graph-proposal");
const links = [...new Set([...asArray(source?.links), targetId])];
const text = `Review a proposed navigation link (not a semantic assertion).\nSource: ${source?.path || state.focusId}\nRevision: ${state.snapshot.revision}\nTarget: ${targetId}\nReason to review: ${reasons.join(". ")}\n\nProposed links field, preserving current visible links:\nlinks:\n${links.map((id) => `  - ${JSON.stringify(id)}`).join("\n")}\n\nBefore applying, review the current canonical file and preserve all existing fields and links, including any not visible here. Only apply and commit after owner approval. This dashboard has not saved a link.`;
const textarea = make("textarea", "graph-link-proposal"); textarea.readOnly = true; textarea.value = text; textarea.setAttribute("aria-label", "Proposed link for review");
const copy = make("button", "aperture-control", "Copy proposal"); copy.type = "button"; copy.addEventListener("click", async () => { try { await navigator.clipboard.writeText(text); copy.textContent = "Copied"; } catch { textarea.focus(); textarea.select(); copy.textContent = "Select and copy the proposal"; } });
proposal.append(make("p", "", "Review with your assistant, then approve and commit the change to create the link. Live updates will show the saved result."), textarea, copy); container.append(proposal); propose.setAttribute("aria-expanded", "true"); });
propose.setAttribute("aria-expanded", "false"); container.append(propose); return container;
}


function relationDisplayLabel(relation) { return relation.semanticStatus === "typed" ? humanize(relation.kind) : relation.provenance === "frontmatter.sources" ? "Recorded source reference" : "Legacy link"; }

function renderWhyConnected(relation) {
const fragment = document.createDocumentFragment(); const declarations = asArray(relation.declarations);
const first = declarations[0] || { from: relation.from, to: relation.to }; const reverse = declarations.some((declaration) => declaration.from === first.to && declaration.to === first.from);
const source = state.graphNodeById.get(first.from) || state.entityById.get(first.from); const target = state.graphNodeById.get(first.to) || state.entityById.get(first.to); const typed = relation.semanticStatus === "typed"; const sourceReference = relation.provenance === "frontmatter.sources";
const heading = !typed && reverse ? `${source?.title || first.from} ↔ ${target?.title || first.to}` : `${source?.title || first.from} → ${target?.title || first.to}`;
fragment.append(make("span", "eyebrow", "Why connected?"), make("h3", "", heading),
make("p", "relation-panel-copy", typed ? "This is an explicit directed assertion from canonical frontmatter. The dashboard does not add or infer relationships." : sourceReference ? "This record explicitly cites the target through a context source locator. It is a recorded reference, not a verified semantic claim." : "This is a compatibility link. Its declaration is recorded, but its meaning and evidence are not structured."));
const ledger = make("dl", "relation-ledger"); ledger.append(make("dt", "", "Predicate"), make("dd", `relation-value is-${safeToken(relation.kind)}`, relation.label || humanize(relation.kind)),
make("dt", "", "Semantic status"), make("dd", "", typed ? "Typed assertion" : sourceReference ? "Recorded source reference" : "Untyped legacy link"), make("dt", "", "Review"), make("dd", `review-state is-${safeToken(relation.review)}`, humanize(relation.review)),
make("dt", "", "Privacy"), make("dd", "", relation.privacy || "unknown"));
if (typed) ledger.append(make("dt", "", "Declared by"), make("dd", "", relation.declaredBy || relation.from),
make("dt", "", "Source path"), make("dd", "source-path", relation.sourcePath || "Not projected"), make("dt", "", "Valid"), make("dd", "", validityLabel(relation)));
fragment.append(ledger);
if (typed || sourceReference) fragment.append(renderEvidenceBlock(relation));
const declarationList = make("div", "relation-declarations"); declarationList.append(make("h4", "", "Recorded declarations"));
for (const declaration of declarations) { const from = state.graphNodeById.get(declaration.from) || state.entityById.get(declaration.from); const to = state.graphNodeById.get(declaration.to) || state.entityById.get(declaration.to);
declarationList.append(make("p", "", `${from?.title || declaration.from} → ${to?.title || declaration.to}`)); }
if (relation.note) declarationList.append(make("p", "relation-note", relation.note));
const actions = make("div", "graph-panel-actions"); for (const id of [...new Set([relation.from, relation.to])]) { const node = state.graphNodeById.get(id); if (!node) continue;
const button = make("button", "aperture-control is-quiet", `Focus: ${node.title}`); button.type = "button"; button.addEventListener("click", () => setGraphFocus(id)); actions.append(button); }
fragment.append(declarationList, actions, relationBoundaryNote()); return fragment;
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
if (!state.pathResult) { fragment.append(make("p", "relation-panel-copy", state.pathMode === "directed" ? "No current, non-rejected path follows typed arrows to this target." : "No current, non-rejected path connects these records under the selected filters."), relationBoundaryNote()); if (target) fragment.append(buildLinkProposal(target.id)); return fragment; }
const list = make("ol", "connection-path"); for (const [index, id] of state.pathResult.nodeIds.entries()) { const node = state.graphNodeById.get(id);
const item = make("li", ""); const button = make("button", "connection-path-node", node?.title || id); button.type = "button";
button.addEventListener("click", () => setGraphFocus(id)); item.append(button);
const relationId = state.pathResult.relationIds[index]; const relation = state.graphRelations.find((candidate) => candidate.id === relationId);
if (relation) { const edge = make("button", "graph-list-connection", `${relationDisplayLabel(relation)} · ${humanize(relation.review)}`); edge.type = "button";
edge.setAttribute("aria-label", `Inspect ${humanize(relation.kind)} connection in this path`); edge.addEventListener("click", () => inspectGraphRelation(relation.id)); item.append(edge); }
list.append(item); }
fragment.append(list, make("p", "relation-panel-copy", `${state.pathResult.relationIds.length} assertion${state.pathResult.relationIds.length === 1 ? "" : "s"} in the deterministic ${state.pathMode === "directed" ? "typed directed" : "navigation"} path.`));
fragment.append(make("p", "relation-path-limit", "The full path is included in the graph, with each connection available for inspection."));
fragment.append(relationBoundaryNote()); return fragment;
}

function relationBoundaryNote() { return make("p", "relation-boundary-note", "Only recorded assertions are shown. No endorsement, causality, fit, or evidence quality is inferred."); }
function traceConnection(targetId) { if (!targetId || !state.graphNodeById.has(targetId) || targetId === state.focusId) return; resetGraphViewport();
state.graphPathOpen = true; state.pathTargetId = targetId; state.pathResult = shortestPath(state.graphNodes, visibleGraphRelations(), state.focusId, targetId, {
mode: state.pathMode, includeRejected: false, includeOutOfValidity: false,
});
state.selectedRelationId = null; if (state.pathResult?.relationIds.length > 1) state.focusDepth = 2; renderViewAndFocus(".relation-panel");
announce(state.pathResult ? `Found a ${state.pathResult.relationIds.length}-link connection` : "No connection found"); }
function clearConnection() { state.graphDrafts["path-picker"] = ""; state.pathTargetId = null; state.pathResult = null; renderViewAndFocus("#path-picker"); }
function setGraphFocus(id) { if (!state.graphNodeById.has(id)) return;
state.graphDrafts = {}; state.focusId = id; state.focusDepth = 1; state.graphRetainedIds = []; state.graphLimit = 200; state.selectedRelationId = null; state.pathTargetId = null; state.pathResult = null;
resetGraphViewport();
renderViewAndFocus(`[data-node-id="${CSS.escape(id)}"]`); announce(`Focused relationship view on ${state.graphNodeById.get(id).title}`); }
function openInAperture(id) { if (!state.graphNodeById.has(id)) return;
state.graphDrafts = {}; state.focusId = id; state.focusDepth = 1; state.graphRetainedIds = []; state.graphLimit = 200; state.selectedRelationId = null; state.pathTargetId = null; state.pathResult = null; resetGraphViewport();
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
legendKey("legend-line is-typed", "Typed · arrow shows direction"), legendKey("legend-line is-generic", "Links / source references · untyped"), );
toolbar.append(legend, make("span", "section-note", "Select any node to bring it into focus")); frame.append(toolbar);
const layout = layoutAtlas(nodes); const scroll = make("div", "atlas-scroll"); const svg = svgNode("svg", {
class: "atlas-canvas", viewBox: `0 0 ${layout.width} ${layout.height}`,
role: "group", "aria-labelledby": "atlas-svg-title atlas-svg-description",
}); svg.append(
svgTextNode("title", { id: "atlas-svg-title" }, "MyContext global relationship overview"), svgTextNode("desc", { id: "atlas-svg-description" }, "Visible canonical records are arranged by type. Solid arrowed lines are typed assertions; dashed lines are recorded links or source references."),
); svg.style.minWidth = `${layout.width}px`; appendArrowMarker(svg, "atlas-typed-arrow"); appendAtlasLanes(svg, layout.lanes);
const visibleById = new Map(layout.nodes.map((node) => [node.id, node])); const offsets = parallelOffsets(edges); for (const [index, edge] of edges.entries()) {
if (!visibleById.has(edge.from) || !visibleById.has(edge.to)) continue; appendAtlasEdge(svg, edge, layout.positions.get(edge.from), layout.positions.get(edge.to), offsets.get(edge.id) || 0);
} for (const node of layout.nodes) appendAtlasNode(svg, node, layout.positions.get(node.id));
scroll.append(svg); frame.append(scroll);
return frame; }
function appendAtlasLanes(svg, lanes) {
for (const lane of lanes) { svg.append(svgTextNode("text", { x: lane.x, y: 25, class: "atlas-lane-label" }, lane.label.toUpperCase()));
svg.append(svgNode("line", { x1: lane.x, y1: 36, x2: lane.x + lane.width, y2: 36, class: "atlas-lane-rule" })); }
} function appendAtlasEdge(svg, edge, from, to, offset = 0) {
const typed = edge.semanticStatus === "typed"; const attributes = { d: focusEdgeGeometry(from, to, offset).path,
class: `atlas-edge ${typed ? "is-typed" : "is-generic"} is-${safeToken(edge.kind)}` };
if (typed) attributes["marker-end"] = "url(#atlas-typed-arrow)"; const path = svgNode("path", attributes);
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
const inspect = () => { setGraphFocus(node.id); window.requestAnimationFrame(() => document.querySelector(".aperture-frame")?.scrollIntoView({ block: "start", behavior: reducedMotion() ? "auto" : "smooth" })); }; group.addEventListener("click", inspect);
group.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") {
event.preventDefault(); inspect();
} });
svg.append(group); }
async function openEntity(id) { if (!id || !state.entityById.has(id)) return;
const summary = state.entityById.get(id); dom.inspector.dataset.entityId = id; state.inspectorRequest += 1;
const requestId = state.inspectorRequest; dom.inspectorKicker.textContent = `${summary.type} · ${summary.privacy}`;
dom.inspectorTitle.textContent = summary.title; dom.inspectorRevision.textContent = shortRevision(state.snapshot?.revision);
replaceChildren(dom.inspectorBody, renderSkeleton()); if (!dom.inspector.open) dom.inspector.showModal();
announce(`Opened ${summary.title}`); try {
const revision = state.snapshot?.revision; let detail = state.detailCache.get(id); if (!detail) {
const payload = await getJson(API.entity(id, revision));
if (payload.revision && revision && payload.revision !== revision) { const changed = new Error("Context changed; refresh the page before opening this record."); changed.code = "revision_changed"; throw changed; }
detail = payload.entity; if (requestId !== state.inspectorRequest || revision !== state.snapshot?.revision) return; state.detailCache.set(id, detail); }
if (requestId !== state.inspectorRequest) return; renderInspector(detail);
} catch (error) { if (requestId !== state.inspectorRequest) return;
const changed = error?.code === "revision_changed" || error?.status === 409;
replaceChildren(dom.inspectorBody, renderError(changed ? "Context changed" : "Record unavailable", readableError(error)));
if (changed) { const retry = make("button", "aperture-control", "Refresh context and retry"); retry.type = "button"; retry.addEventListener("click", () => refreshContext(true)); dom.inspectorBody.append(retry); } }
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
: `${directionLabel} · ${relationDisplayLabel(reference.relation)} · reason not structured`;
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
function marginIsDrawer() { return dom.marginMedia.matches || state.activeView === "atlas"; }
function openMargin() { if (!marginIsDrawer()) return;
dom.margin.inert = false; dom.spine.inert = true; dom.desk.inert = true; dom.skipLink.inert = true;
dom.margin.setAttribute("role", "dialog"); dom.margin.setAttribute("aria-modal", "true");
dom.margin.classList.add("is-open");
dom.marginToggle.setAttribute("aria-expanded", "true"); dom.marginScrim.hidden = false;
dom.marginClose.focus(); }
function closeMargin() { if (!dom.margin.classList.contains("is-open")) return;
dom.margin.classList.remove("is-open"); dom.marginToggle.setAttribute("aria-expanded", "false");
dom.marginScrim.hidden = true; dom.spine.inert = false; dom.desk.inert = false;
dom.skipLink.inert = false; dom.margin.removeAttribute("role"); dom.margin.removeAttribute("aria-modal");
dom.margin.inert = marginIsDrawer(); dom.marginToggle.focus();
} function resetMarginForViewport() {
const mobile = marginIsDrawer(); dom.margin.classList.remove("is-open");
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
