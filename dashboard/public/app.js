import { buildLegacyRelations, chooseFocusNode, layoutAtlas, layoutFocusGraph,
relationReferences, relationTrail, rankWorkstreams, recordProvenance, recordSearchText, sourceWebUrl, shortestPath } from "./model.mjs";

const API = Object.freeze({ snapshot: "/api/v1/snapshot",
repo: "/api/v1/repo", entity: (id) => `/api/v1/entities/${encodeURIComponent(id)}`,
 });
const VIEW_META = Object.freeze({
  desk: { kicker: "A little context", title: "Your life, with the context kept.",
    deck: "People you care about, things you are learning, and plans you want to make time for." },
  workstreams: { kicker: "Make room for what matters", title: "What you have in mind.",
    deck: "A trip, a reading habit, a class, a weekend with friends. Pick up where you left off." },
  ideas: { kicker: "Room to explore", title: "Things you might try.",
    deck: "Keep a spark of an idea before it becomes a plan." },
  runs: { kicker: "Connected activity", title: "Tasks in progress.",
    deck: "Only tasks registered with this local app appear here." },
  people: { kicker: "People & relationships", title: "Remember the little things.",
    deck: "Shared interests, conversations to return to, and the context behind a name." },
  projects: { kicker: "Your plans", title: "What you have in mind.",
    deck: "The details, people, and resources behind each plan." },
  resources: { kicker: "Your shelves & saved places", title: "Things worth coming back to.",
    deck: "Books, courses, places, music, and tools, connected to the rest of your life." },
  journal: { kicker: "Notes & memories", title: "Pick up the thread.",
    deck: "Reading notes, conversations, small discoveries, and decisions you want to remember." },
  experience: { kicker: "What you have done", title: "Experiences that stay with you.",
    deck: "Roles, milestones, and what you learned along the way." },
  atlas: { kicker: "Connections", title: "See what belongs together.",
    deck: "Explore the people, plans, and resources around one record. Open a connection to see what was recorded." },
  system: { kicker: "Your local context", title: "How this space works.",
    deck: "Saved Markdown, a local read-only view, and changes you review with your own AI." },
});
const state = { snapshot: null,
repo: null, entities: [],
entityById: new Map(), detailCache: new Map(),
graphNodes: [], graphNodeById: new Map(), relations: [], graphRelations: [],
focusId: null, focusDepth: 1, selectedRelationId: null, pathTargetId: null, pathResult: null,
activeView: "desk", query: "",
scope: "all", inspectorRequest: 0,
loadError: null, repoError: null, resourceKind: "all", };
const dom = {}; document.addEventListener("DOMContentLoaded", initialize);
async function initialize() { cacheDom();
bindEvents(); selectInitialView();
const [snapshotResult, repoResult] = await Promise.allSettled([ getJson(API.snapshot),
getJson(API.repo), ]);
if (snapshotResult.status === "fulfilled") { state.snapshot = snapshotResult.value.snapshot;
state.entities = Array.isArray(state.snapshot.entities) ? state.snapshot.entities : []; state.entityById = new Map(state.entities.map((entity) => [entity.id, entity]));
const graph = state.snapshot.graph || {}; state.graphNodes = asArray(graph.nodes).filter(atlasNodeVisible);
state.graphNodeById = new Map(state.graphNodes.map((node) => [node.id, node]));
state.relations = buildLegacyRelations(state.entities, graph.edges);
state.graphRelations = state.relations.filter((relation) => state.graphNodeById.has(relation.from) && state.graphNodeById.has(relation.to));
state.focusId = chooseFocusNode(state.graphNodes, state.graphRelations, state.focusId);
} else { state.loadError = readableError(snapshotResult.reason);
} if (repoResult.status === "fulfilled") {
state.repo = repoResult.value.repo; } else {
state.repoError = readableError(repoResult.reason); }
updateCapabilityNavigation(); updateRepositoryStatus(); renderMargin();
renderView(); finishLoading();
} function cacheDom() {
dom.navItems = [...document.querySelectorAll("[data-view]")]; dom.viewKicker = document.getElementById("view-kicker");
dom.viewTitle = document.getElementById("view-title"); dom.viewDeck = document.getElementById("view-deck");
dom.viewContent = document.getElementById("view-content"); dom.search = document.getElementById("global-search");
dom.scope = document.getElementById("scope-filter"); dom.searchResults = document.getElementById("search-results");
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
renderSearchResults();
if (["people", "projects", "experience", "ideas", "resources", "journal", "workstreams"].includes(state.activeView)) renderView(); });
dom.search.addEventListener("focus", renderSearchResults); dom.scope.addEventListener("change", () => {
state.scope = dom.scope.value; renderSearchResults();
if (["people", "projects", "experience", "ideas", "resources", "journal", "workstreams"].includes(state.activeView)) renderView(); });
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
if (view === "runs" && state.snapshot && state.snapshot.capabilities?.operations !== true) view = "desk";
if (view !== state.activeView) { state.activeView = view;
renderView(); }
updateNav(); }
function setView(view) { if (!Object.hasOwn(VIEW_META, view)) return;
if (view === "runs" && state.snapshot?.capabilities?.operations !== true) view = "desk";
state.activeView = view; history.replaceState(null, "", `#${view}`);
closeSearch(); closeMargin();
updateNav(); renderView();
document.getElementById("main-content").focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
} function updateCapabilityNavigation() {
const enabled = state.snapshot?.capabilities?.operations === true;
for (const item of dom.navItems) if (item.dataset.view === "runs") item.hidden = !enabled;
if (state.activeView === "runs" && !enabled) state.activeView = "desk";
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
if (!response.ok || !payload?.ok) { throw new Error(payload?.error?.message || `Request failed (${response.status})`);
} return payload;
} finally { window.clearTimeout(timeout);
} }
function finishLoading() { if (state.loadError) {
dom.loadBanner.classList.add("is-error"); replaceChildren(dom.loadBanner, make("span", "", `MyContext could not open saved context: ${state.loadError}`));
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
dom.repoShortStatus.textContent = state.repo.dirty ? "Saved version · local edits waiting" : "Saved locally · read only"; dom.revisionLabel.textContent = `Saved context · ${revision}`;
} function renderView() {
const meta = VIEW_META[state.activeView] || VIEW_META.desk; dom.viewKicker.textContent = meta.kicker;
dom.viewTitle.textContent = meta.title; dom.viewDeck.textContent = meta.deck;
document.title = `${meta.title} · MyContext`; if (!state.snapshot) {
replaceChildren(dom.viewContent, renderLoadError()); return;
} const renderers = {
desk: renderDesk, workstreams: renderWorkstreamsView,
runs: renderRunsView, ideas: renderIdeasView, people: () => renderRecordsView("person"),
projects: () => renderRecordsView("project"), resources: renderResourcesView, journal: () => renderRecordsView("journal"), experience: () => renderRecordsView("experience"), atlas: renderAtlasView,
system: renderSystemView, };
replaceChildren(dom.viewContent, renderers[state.activeView]()); }
function renderDesk() {
  const fragment = document.createDocumentFragment();
  if (!state.entities.length) return renderOnboarding();
  if (state.entities.some((entity) => recordProvenance(entity))) {
    const note = make("aside", "demo-note");
    note.append(make("strong", "", "A life in context · sample collection"),
      make("p", "", "Records marked Fictional scenario illustrate an invented personal life. Public reference marks real books, figures, and places with linked sources."));
    fragment.append(note);
  }
  const overview = make("div", "personal-overview");
  for (const [type, label, view] of [["project", "Plans", "workstreams"], ["person", "People", "people"],
    ["resource", "Resources", "resources"], ["journal", "Notes", "journal"]]) {
    const button = make("button", "overview-count"); button.type = "button";
    button.append(make("strong", "", countType(type)), make("span", "", label));
    button.addEventListener("click", () => setView(view)); overview.append(button);
  }
  fragment.append(overview);
  const plans = prioritizedWorkstreams().filter((plan) => plan.status !== "archived").slice(0, 4);
  const plansSection = make("section", "section-block");
  plansSection.append(sectionHeading("workstream-heading", "On your mind", "A few plans to pick up again"), renderWorkstreamBoard(plans));
  fragment.append(plansSection);
  const shelves = make("div", "home-shelves");
  shelves.append(renderHomeShelf("People in the picture", "person", "people", 3),
    renderHomeShelf("From your shelves", "resource", "resources", 3));
  fragment.append(shelves);
  const notes = state.entities.filter((entity) => entity.type === "journal")
    .sort((a, b) => String(b.updated).localeCompare(String(a.updated)) || a.title.localeCompare(b.title)).slice(0, 3);
  if (notes.length) {
    const section = make("section", "section-block");
    section.append(sectionHeading("recent-notes-heading", "Recently remembered", "Notes from the saved collection"));
    const list = make("div", "record-list");
    for (const note of notes) list.append(renderRecordRow(note)); section.append(list); fragment.append(section);
  }
  const reviewItems = reviewQueue();
  if (reviewItems.length) {
    const section = make("section", "section-block");
    section.append(sectionHeading("judgment-heading", "For your review", `${reviewItems.length} draft${reviewItems.length === 1 ? "" : "s"} to look over`));
    const list = make("div", "judgment-lead");
    for (const item of reviewItems.slice(0, 2)) list.append(renderJudgmentRow(item));
    section.append(list); fragment.append(section);
  }
  if (state.snapshot.capabilities?.operations === true) {
    const section = make("section", "section-block");
    section.append(sectionHeading("desk-runs-heading", "Connected activity", "Tasks registered with this app"), renderOperations());
    fragment.append(section);
  }
  return fragment;
}
function renderHomeShelf(title, type, view, limit) {
  const section = make("section", "section-block home-shelf");
  section.append(sectionHeading(`home-${type}-heading`, title, ""));
  const records = state.entities.filter((entity) => entity.type === type)
    .sort((a, b) => Number(a.demoKind === "public_reference") - Number(b.demoKind === "public_reference") ||
      String(b.updated).localeCompare(String(a.updated)) || a.title.localeCompare(b.title)).slice(0, limit);
  for (const record of records) {
    const button = make("button", "home-shelf-item"); button.type = "button";
    const meta = make("span", "record-badges"); appendRecordBadges(meta, record);
    button.append(make("strong", "", record.title), make("span", "", record.summary || "Open this record"), meta);
    button.addEventListener("click", () => openEntity(record.id)); section.append(button);
  }
  if (!records.length) section.append(make("p", "section-note", "A little space for the next thing you want to remember."));
  const more = make("button", "inspect-button", "See all"); more.type = "button";
  more.addEventListener("click", () => setView(view)); section.append(more); return section;
}
function renderOnboarding() {
  const section = make("section", "empty-context");
  section.append(make("span", "eyebrow", "A fresh start"), make("h2", "", "This space is yours to fill."),
    make("p", "", "Start with a little about yourself, someone you want to remember, or something you are looking forward to."));
  const examples = make("div", "onboarding-examples");
  for (const [title, copy] of [["About you", "Interests, preferences, and how you like your AI to help."],
    ["People", "A friend’s favorite book or a conversation to return to."],
    ["Plans & resources", "A trip, a course, a recipe, or your next read."]]) {
    const card = make("div"); card.append(make("h3", "", title), make("p", "", copy)); examples.append(card);
  }
  section.append(examples, make("h3", "", "Start a conversation with your AI"),
    make("blockquote", "onboarding-prompt", "Help me set up my personal MyContext. Read this context folder’s instructions, ask me about my interests and one thing I want to remember, then show me a proposed update to review."),
    make("p", "", "Open your personal context folder with your AI and share this prompt. Once you review and save your first records, refresh this page to see them here."));
  return section;
}
function renderWorkstreamsView() {
  const section = make("section", "section-block"); const plans = prioritizedWorkstreams()
    .filter((plan) => matchesQuery(state.entityById.get(plan.id) || plan));
  section.append(sectionHeading("all-workstreams-heading", "Your plans", `${plans.length} saved plans`), renderWorkstreamBoard(plans));
  return section;
}
function renderResourcesView() {
  const section = make("section", "section-block");
  const allResources = state.entities.filter((entity) => entity.type === "resource");
  const kinds = [...new Set(allResources.map((entity) => entity.resourceKind).filter(Boolean))].sort();
  if (!kinds.includes(state.resourceKind)) state.resourceKind = "all";
  const filters = make("div", "resource-filters"); filters.setAttribute("aria-label", "Resource kind");
  for (const kind of ["all", ...kinds]) {
    const button = make("button", `aperture-control${state.resourceKind === kind ? " is-active" : ""}`, kind === "all" ? "All resources" : humanize(kind));
    button.type = "button"; button.dataset.resourceKind = kind;
    button.setAttribute("aria-pressed", String(state.resourceKind === kind));
    button.addEventListener("click", () => { state.resourceKind = kind; renderViewAndFocus(`[data-resource-kind="${kind}"]`); }); filters.append(button);
  }
  const records = allResources.filter((entity) => state.resourceKind === "all" || entity.resourceKind === state.resourceKind)
    .filter(matchesQuery).sort((a, b) => a.title.localeCompare(b.title));
  section.append(sectionHeading("resource-records-heading", "Your collection", `${records.length} resources`), filters);
  if (!records.length) section.append(renderEmpty("Room on your shelves.", "Save a book, course, place, or tool with your AI, or try another search."));
  else { const list = make("div", "record-list relation-record-list");
    for (const record of records) list.append(renderRecordRow(record)); section.append(list); }
  return section;
}
function renderRunsView() { const fragment = document.createDocumentFragment();
const section = make("section", "section-block"); section.append(sectionHeading("runs-heading", "App-managed operations", "Ephemeral · never canonical by default"));
section.append(renderOperations()); fragment.append(section);
const boundary = make("section", "section-block"); boundary.append(sectionHeading("runs-boundary-heading", "Visibility boundary", "No background transcript watcher"));
boundary.append(renderBoundaryList([ "Margin does not inspect other Codex or Claude tasks.",
"A future run must be explicitly registered with this local harness before it can appear here.", "Run status exposes phases, inputs, and artifacts—not hidden reasoning.",
"A completed run still requires human review before any durable context change.", ]));
fragment.append(boundary); return fragment;
} function renderIdeasView() {
  const section = make("section", "section-block idea-section");
  const ideas = state.entities.filter((entity) => entity.type === "idea").filter(matchesQuery)
    .sort((a, b) => a.title.localeCompare(b.title));
  section.append(sectionHeading("ideas-heading", "For another day", `${ideas.length} ideas to explore`));
  if (!ideas.length) section.append(renderEmpty("An idea can start small.", "Keep something you would like to try with your AI, or change the search text."));
  else { const list = make("div", "record-list relation-record-list");
    for (const idea of ideas) list.append(renderRecordRow(idea)); section.append(list); }
  return section;
}
function renderRecordsView(type) {
const fragment = document.createDocumentFragment(); const scope = type;
const records = state.entities .filter((entity) => entity.type === scope && entity.role !== "research")
.filter(matchesQuery) .sort((a, b) => type === "journal" ? String(b.updated).localeCompare(String(a.updated)) || a.title.localeCompare(b.title) : a.title.localeCompare(b.title));
const section = make("section", "section-block"); const noun = ({
person: "people", project: "plans", experience: "experiences", journal: "notes & memories",
})[type] || "canonical records";
section.append(sectionHeading(`${type}-records-heading`, noun[0].toUpperCase() + noun.slice(1), `${records.length} saved records`)); if (!records.length) {
section.append(renderEmpty(`No ${noun} match this view.`, "Try another search, or save your first record with your AI.")); } else {
const list = make("div", "record-list relation-record-list"); for (const record of records) list.append(renderRecordRow(record));
section.append(list); }
fragment.append(section); return fragment;
} function renderAtlasView() {
const fragment = document.createDocumentFragment(); const section = make("section", "section-block");
section.append(sectionHeading("atlas-heading", "Around one record", "Saved links connect your people, plans, and resources"));
if (!state.graphNodes.length) {
section.append(renderEmpty("No visible relationship exists yet.", "The aperture only uses visible canonical frontmatter links.")); } else {
state.focusId = chooseFocusNode(state.graphNodes, state.graphRelations, state.focusId);
section.append(buildFocusGraph());
const overview = make("details", "global-overview"); const summary = make("summary", "global-overview-toggle", "Global overview");
summary.append(make("span", "section-note", "Secondary · all visible legacy links")); overview.append(summary, buildAtlas(state.graphNodes, state.graphRelations));
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
["Plans", counts.byType?.project ?? countType("project")], ["Experiences", counts.byType?.experience ?? countType("experience")],
["Resources", counts.byType?.resource ?? countType("resource")],
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
const boundary = make("section", "section-block"); boundary.append(sectionHeading("system-boundary-heading", "Stage 1 invariants", "Local and read-only"));
boundary.append(renderBoundaryList([ "Canonical entities are parsed from the committed Git HEAD, not dirty working-tree files.",
"Restricted context and session exports are excluded before data reaches the browser.", "Markdown is displayed as text; embedded HTML is never executed.",
"No send, schedule, apply, write, shell, or arbitrary-file control is present.", ]));
fragment.append(boundary); return fragment;
} function renderMargin() {
const items = reviewQueue(); dom.queueCount.textContent = String(items.length);
dom.mobileQueueCount.textContent = String(items.length); replaceChildren(dom.queue);
if (!state.snapshot) { dom.queue.append(make("p", "margin-empty", "Canonical review items are unavailable."));
return; }
if (!items.length) { dom.queue.append(make("p", "margin-empty", "All clear for now. Drafts you prepare with your AI will appear here for review."));
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
function renderWorkstreamBoard(workstreams) { if (!workstreams.length) return renderEmpty("What would you like to make time for?", "Add a plan with your AI, or try another search.");
const board = make("div", "workstream-board"); workstreams.forEach((workstream, index) => {
const row = make("article", "workstream-row"); row.append(make("div", "workstream-index", String(index + 1).padStart(2, "0")));
const main = make("div", "workstream-main"); const titleButton = make("button", "text-button", workstream.title || workstream.id);
titleButton.type = "button"; titleButton.addEventListener("click", () => openEntity(workstream.id));
const heading = make("h3"); heading.append(titleButton);
const badges = make("div", "record-badges"); appendRecordBadges(badges, state.entityById.get(workstream.id) || workstream);
main.append(heading, badges, make("p", "", workstream.summary || "No summary is available in the tracked canonical record.")); const related = linkedIds(workstream);
if (related.length) { const thread = make("div", "entity-thread");
for (const id of related.slice(0, 5)) { const entity = state.entityById.get(id);
if (!entity) continue; const node = make("button", "thread-node", entity.title);
node.type = "button"; node.addEventListener("click", () => openEntity(entity.id));
thread.append(node); }
if (thread.childElementCount) main.append(thread); }
row.append(main); const focus = make("div", "workstream-focus");
focus.append(make("span", "", "Next small step")); focus.append(make("p", "", workstream.nextAction || attentionText(workstream)));
row.append(focus); board.append(row);
}); return board;
} function renderRecordRow(record) {
const row = make("article", "record-row relation-record"); const open = make("button", "record-open"); open.type = "button";
open.addEventListener("click", () => openEntity(record.id)); const title = make("span", "record-title");
title.append(make("strong", "", record.title));
const badges = make("span", "record-badges"); appendRecordBadges(badges, record); title.append(badges); open.append(title, make("span", "record-summary", record.summary || "No summary available."));
const tags = make("span", "tag-list"); for (const tag of asArray(record.tags).slice(0, 3)) tags.append(make("span", "tag", tag));
open.append(tags); const status = make("span", "status-label", record.status || "unknown");
status.dataset.status = safeToken(record.status); open.append(status); row.append(open, renderRelationTrail(record));
return row; }

function renderRelationTrail(record) {
const trail = make("div", "relation-trail"); const header = make("div", "relation-trail-header");
header.append(make("span", "relation-trail-label", "Connected context"));
if (state.graphNodeById.has(record.id)) { const focus = make("button", "relation-focus", "See connections"); focus.type = "button";
focus.addEventListener("click", () => openInAperture(record.id)); header.append(focus); }
trail.append(header); const items = relationTrail(state.relations, record.id);
if (!items.length) { trail.append(make("span", "relation-trail-empty", "No connections saved yet.")); return trail; }
const list = make("div", "relation-trail-nodes"); for (const item of items.slice(0, 4)) {
const related = state.entityById.get(item.otherId); if (!related) continue;
const marker = item.direction === "mutual" ? "↔" : item.direction === "outgoing" ? "→" : "←";
const button = make("button", "relation-trail-node", `${marker} ${related.title}`); button.type = "button";
button.title = "Legacy link · reason not structured · open canonical record";
button.addEventListener("click", () => openEntity(related.id)); list.append(button); }
if (items.length > 4) list.append(make("span", "relation-trail-more", `+${items.length - 4}`));
trail.append(list); return trail;
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
const focus = state.graphNodeById.get(state.focusId); const layout = layoutFocusGraph(
state.graphNodes, state.graphRelations, state.focusId, state.focusDepth,
); const frame = make("div", "aperture-frame");
const toolbar = make("div", "aperture-toolbar"); const identity = make("div", "aperture-focus-identity");
identity.append(make("span", "eyebrow", "Current focus"), make("strong", "", focus?.title || "No focus"),
make("span", "relation-boundary", `${layout.nodes.length} visible nodes · ${layout.relations.length} legacy links`));
const controls = make("div", "aperture-controls"); const depthGroup = make("div", "aperture-depth");
depthGroup.setAttribute("aria-label", "Relationship depth"); for (const depth of [1, 2]) {
const button = make("button", `aperture-control${state.focusDepth === depth ? " is-active" : ""}`, depth === 1 ? "1 hop" : "Expand to 2");
button.type = "button"; button.dataset.depth = String(depth); button.setAttribute("aria-pressed", String(state.focusDepth === depth));
button.addEventListener("click", () => { state.focusDepth = depth; state.selectedRelationId = null; renderViewAndFocus(`[data-depth="${depth}"]`); }); depthGroup.append(button); }
const targetLabel = make("label", "connection-picker"); targetLabel.append(make("span", "sr-only", "Find connection from current focus"));
const target = make("select", "connection-target"); target.setAttribute("aria-label", "Connection target");
target.append(makeOption("", "Find connection…")); for (const node of state.graphNodes.filter((node) => node.id !== state.focusId)
.sort((left, right) => String(left.title).localeCompare(String(right.title)))) target.append(makeOption(node.id, node.title));
if (state.pathTargetId && state.pathTargetId !== state.focusId) target.value = state.pathTargetId; targetLabel.append(target);
const trace = make("button", "aperture-control", "Trace"); trace.type = "button"; trace.addEventListener("click", () => traceConnection(target.value));
controls.append(depthGroup, targetLabel, trace); if (state.pathResult || state.pathTargetId) { const clear = make("button", "aperture-control is-quiet", "Clear path");
clear.type = "button"; clear.addEventListener("click", clearConnection); controls.append(clear); }
toolbar.append(identity, controls); frame.append(toolbar);

const workspace = make("div", "aperture-workspace"); const stage = make("div", "aperture-stage");
const svg = svgNode("svg", { class: "aperture-canvas", viewBox: `0 0 ${layout.width} ${layout.height}`,
role: "group", "aria-labelledby": "aperture-svg-title aperture-svg-description" });
svg.append(svgTextNode("title", { id: "aperture-svg-title" }, `Context aperture focused on ${focus?.title || "a record"}`),
svgTextNode("desc", { id: "aperture-svg-description" }, `A deterministic ${state.focusDepth === 2 ? "two-hop" : "one-hop"} view of visible legacy frontmatter links. Select a neighboring node to refocus, or select an edge to inspect why it is connected.`));
const pathRelationIds = new Set(asArray(state.pathResult?.relationIds)); const pathNodeIds = new Set(asArray(state.pathResult?.nodeIds));
for (const relation of layout.relations) appendFocusEdge(svg, relation, layout.positions, {
selected: relation.id === state.selectedRelationId, path: pathRelationIds.has(relation.id),
});
for (const node of layout.nodes) appendFocusNode(svg, node, layout.positions.get(node.id), {
focus: node.id === state.focusId, path: pathNodeIds.has(node.id), distance: layout.distances.get(node.id),
});
stage.append(svg, renderMobileFocusTrail(state.focusId, layout)); workspace.append(stage, renderRelationPanel()); frame.append(workspace);
return frame;
}

function appendFocusEdge(svg, relation, positions, flags) {
  const from = positions.get(relation.from); const to = positions.get(relation.to); if (!from || !to) return;
const geometry = focusEdgeGeometry(from, to); const left = state.entityById.get(relation.from); const right = state.entityById.get(relation.to);
const group = svgNode("g", { class: `aperture-edge-control${flags.selected ? " is-selected" : ""}${flags.path ? " is-path" : ""}`,
"aria-hidden": "true" });
group.append(svgNode("path", { d: geometry.path, class: `aperture-edge is-generic${flags.selected ? " is-selected" : ""}${flags.path ? " is-path" : ""}` }));
const relationSelector = `[data-relation-id="${CSS.escape(relation.id)}"]`;
const inspect = () => { state.selectedRelationId = relation.id; renderViewAndFocus(relationSelector); announce("Opened legacy link explanation"); };
const handle = svgNode("circle", { cx: geometry.midpoint.x, cy: geometry.midpoint.y, r: 22,
class: `aperture-edge-handle${flags.selected ? " is-selected" : ""}${flags.path ? " is-path" : ""}`,
"data-relation-id": relation.id, tabindex: "0", role: "button", "aria-label": `Inspect legacy link between ${left?.title || relation.from} and ${right?.title || relation.to}; reason not structured` });
handle.append(svgTextNode("title", {}, "Inspect legacy canonical link · reason not structured · review state not represented"));
handle.addEventListener("click", inspect); handle.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") {
event.preventDefault(); inspect(); } }); svg.append(group);
const marker = svgNode("circle", { cx: geometry.midpoint.x, cy: geometry.midpoint.y, r: 8,
class: `aperture-edge-marker${flags.selected ? " is-selected" : ""}${flags.path ? " is-path" : ""}`, "aria-hidden": "true" });
svg.append(handle, marker);
}

function appendFocusNode(svg, node, box, flags) {
if (!box) return; const className = `aperture-node is-${safeToken(node.type)}${flags.focus ? " is-focus" : ""}${flags.path ? " is-path" : ""}`;
const action = flags.focus ? "Inspect" : "Focus on"; const group = svgNode("g", { class: className, tabindex: "0", role: "button",
"data-node-id": node.id,
"aria-label": `${action} ${node.title}; ${flags.distance === 0 ? "current focus" : `${flags.distance} hop${flags.distance === 1 ? "" : "s"} away`}` });
group.append(svgTextNode("title", {}, `${node.title} · ${entityTypeLabel(node)} · ${recordProvenance(node) || node.status}`), svgNode("rect", {
x: box.x, y: box.y, width: box.width, height: box.height, rx: flags.focus ? 18 : node.type === "person" ? box.height / 2 : 10,
class: "aperture-node-surface",
}));
const lines = wrapLabel(node.title, flags.focus ? 24 : 19); const title = svgNode("text", { x: box.x + 14, y: box.y + (flags.focus ? 30 : 23), class: "aperture-node-title" });
lines.forEach((line, index) => title.append(svgTextNode("tspan", { x: box.x + 14, dy: index === 0 ? 0 : 15 }, line))); group.append(title);
group.append(svgTextNode("text", { x: box.x + box.width - 13, y: box.y + box.height - 10,
class: "aperture-node-meta", "text-anchor": "end" }, flags.focus ? `${entityTypeLabel(node)} · inspect` : `${entityTypeLabel(node)} · refocus`));
const activate = () => flags.focus ? openEntity(node.id) : setGraphFocus(node.id);
group.addEventListener("click", activate); group.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") {
event.preventDefault(); activate(); } }); svg.append(group);
}

function renderMobileFocusTrail(focusId, layout) {
const region = make("section", "aperture-mobile-trail"); region.setAttribute("aria-label", "Focus relationships as a list");
region.append(make("h3", "", state.focusDepth === 2 ? "Records within two hops" : "Nearest records"));
const immediate = new Map(relationTrail(state.graphRelations, focusId).map((item) => [item.otherId, item]));
const items = asArray(layout?.nodes).filter((node) => node.id !== focusId);
if (!items.length) { region.append(make("p", "relation-trail-empty", "This record has no visible graph neighbors.")); return region; }
const list = make("ul", "backlink-list"); for (const node of items) { const item = immediate.get(node.id); const distance = layout.distances.get(node.id);
const row = make("li", "backlink-item"); const button = make("button", "relation-list-button"); button.type = "button";
const direction = distance > 1 ? `${distance} hops away via legacy links` : item?.direction === "mutual" ? "Linked both ways" : item?.direction === "outgoing" ? "Declared by focus" : "Links to focus";
button.append(make("strong", "", node.title), make("span", "", `${direction} · reason not structured`)); button.addEventListener("click", () => setGraphFocus(node.id));
row.append(button); list.append(row); } region.append(list); return region;
}

function renderRelationPanel() {
const panel = make("aside", "relation-panel"); panel.tabIndex = -1; panel.setAttribute("aria-live", "polite");
const relation = state.graphRelations.find((candidate) => candidate.id === state.selectedRelationId);
if (relation) { panel.append(renderWhyConnected(relation)); return panel; }
if (state.pathTargetId) { panel.append(renderConnectionResult()); return panel; }
const focus = state.graphNodeById.get(state.focusId); const references = relationReferences(state.graphRelations, state.focusId);
panel.append(make("span", "eyebrow", "Why connected?"), make("h3", "", focus?.title || "Current focus"),
make("p", "relation-panel-copy", "Select an edge to inspect what the repository actually records. Spatial proximity is navigation, not evidence of fit."));
const counts = make("dl", "relation-ledger"); counts.append(make("dt", "", "Outgoing declarations"), make("dd", "", String(references.outgoing.length)),
make("dt", "", "Incoming backlinks"), make("dd", "", String(references.incoming.length)), make("dt", "", "Evidence"), make("dd", "", "Reason not structured"),
make("dt", "", "Review"), make("dd", "", "Not represented")); panel.append(counts, relationBoundaryNote()); return panel;
}

function renderWhyConnected(relation) {
const fragment = document.createDocumentFragment(); const declarations = asArray(relation.declarations);
const first = declarations[0] || { from: relation.from, to: relation.to }; const reverse = declarations.some((declaration) => declaration.from === first.to && declaration.to === first.from);
const source = state.entityById.get(first.from); const target = state.entityById.get(first.to); const heading = reverse ? `${source?.title || first.from} ↔ ${target?.title || first.to}` : `${source?.title || first.from} → ${target?.title || first.to}`;
fragment.append(make("span", "eyebrow", "Why connected?"), make("h3", "", heading),
make("p", "relation-panel-copy", "The repository records one or more frontmatter link declarations between these records. It does not yet record why the relationship exists."));
const ledger = make("dl", "relation-ledger"); ledger.append(make("dt", "", "Relation"), make("dd", "", "Generic legacy link"),
make("dt", "", "Evidence"), make("dd", "", "Reason not structured"), make("dt", "", "Review"), make("dd", "", "Not represented"),
make("dt", "", "Privacy"), make("dd", "", relation.privacy || "unknown")); fragment.append(ledger);
const declarationList = make("div", "relation-declarations"); declarationList.append(make("h4", "", "Recorded declarations"));
for (const declaration of declarations) { const from = state.entityById.get(declaration.from); const to = state.entityById.get(declaration.to);
declarationList.append(make("p", "", `${from?.title || declaration.from} → ${to?.title || declaration.to}`)); }
fragment.append(declarationList, relationBoundaryNote()); return fragment;
}

function renderConnectionResult() {
const fragment = document.createDocumentFragment(); const target = state.graphNodeById.get(state.pathTargetId);
fragment.append(make("span", "eyebrow", "Connection trail"), make("h3", "", target ? `${state.graphNodeById.get(state.focusId)?.title} → ${target.title}` : "Target unavailable"));
if (!state.pathResult) { fragment.append(make("p", "relation-panel-copy", "No path exists across the currently visible legacy-link graph."), relationBoundaryNote()); return fragment; }
const list = make("ol", "connection-path"); for (const id of state.pathResult.nodeIds) { const node = state.graphNodeById.get(id);
const item = make("li", ""); const button = make("button", "connection-path-node", node?.title || id); button.type = "button";
button.addEventListener("click", () => setGraphFocus(id)); item.append(button); list.append(item); }
fragment.append(list, make("p", "relation-panel-copy", `${state.pathResult.relationIds.length} legacy link${state.pathResult.relationIds.length === 1 ? "" : "s"} in the deterministic shortest path.`));
if (state.pathResult.relationIds.length > 2) fragment.append(make("p", "relation-path-limit", "The full trail is listed here; the aperture highlights at most two hops from the current focus."));
fragment.append(relationBoundaryNote()); return fragment;
}

function relationBoundaryNote() { return make("p", "relation-boundary-note", "Boundary: this view explains reachability only. It does not infer endorsement, causality, research fit, or evidence quality."); }
function traceConnection(targetId) { if (!targetId || !state.graphNodeById.has(targetId)) return;
state.pathTargetId = targetId; state.pathResult = shortestPath(state.graphNodes, state.graphRelations, state.focusId, targetId);
state.selectedRelationId = null; if (state.pathResult?.relationIds.length > 1) state.focusDepth = 2; renderViewAndFocus(".relation-panel");
announce(state.pathResult ? `Found a ${state.pathResult.relationIds.length}-link connection` : "No connection found"); }
function clearConnection() { state.pathTargetId = null; state.pathResult = null; renderViewAndFocus(".connection-target"); }
function setGraphFocus(id) { if (!state.graphNodeById.has(id)) return;
state.focusId = id; state.focusDepth = 1; state.selectedRelationId = null; state.pathTargetId = null; state.pathResult = null;
renderViewAndFocus(`[data-node-id="${CSS.escape(id)}"]`); announce(`Focused relationship view on ${state.graphNodeById.get(id).title}`); }
function openInAperture(id) { if (!state.graphNodeById.has(id)) return;
state.focusId = id; state.focusDepth = 1; state.selectedRelationId = null; state.pathTargetId = null; state.pathResult = null;
if (state.activeView === "atlas") renderViewAndFocus(`[data-node-id="${CSS.escape(id)}"]`); else {
setView("atlas"); window.requestAnimationFrame(() => focusElement(`[data-node-id="${CSS.escape(id)}"]`)); } }

function focusEdgeGeometry(from, to) { const fromCenter = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
const toCenter = { x: to.x + to.width / 2, y: to.y + to.height / 2 }; const start = rectangleIntersection(from, toCenter);
const end = rectangleIntersection(to, fromCenter); const bend = Math.min(72, Math.abs(end.x - start.x) * 0.18 + Math.abs(end.y - start.y) * 0.08);
const normalX = end.y === start.y ? 0 : Math.sign(end.y - start.y) * bend; const normalY = end.x === start.x ? 0 : -Math.sign(end.x - start.x) * bend;
const midpointX = (start.x + end.x) / 2 + normalX; const midpointY = (start.y + end.y) / 2 + normalY;
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
legendKey("legend-shape is-domain", "Life area"), legendKey("legend-shape is-idea", "Idea"), legendKey("legend-shape", "Plan"),
legendKey("legend-shape is-experience", "Experience"),
legendKey("legend-shape is-person", "Person"), legendKey("legend-shape is-resource", "Resource"), legendKey("legend-shape is-profile", "Profile"),
legendKey("legend-line is-generic", "Legacy link · reason not structured"), );
toolbar.append(legend, make("span", "section-note", "Select any node to bring it into focus")); frame.append(toolbar);
const layout = layoutAtlas(nodes); const scroll = make("div", "atlas-scroll"); const svg = svgNode("svg", {
class: "atlas-canvas", viewBox: `0 0 ${layout.width} ${layout.height}`,
role: "group", "aria-labelledby": "atlas-svg-title atlas-svg-description",
}); svg.append(
svgTextNode("title", { id: "atlas-svg-title" }, "MyContext global relationship overview"), svgTextNode("desc", { id: "atlas-svg-description" }, "Visible domains, ideas, projects, work experiences, people, and profile records are arranged in lanes. Every line is a legacy frontmatter link whose reason is not structured."),
); appendAtlasLanes(svg, layout.lanes);
const visibleById = new Map(layout.nodes.map((node) => [node.id, node])); for (const edge of edges) {
if (!visibleById.has(edge.from) || !visibleById.has(edge.to)) continue; appendAtlasEdge(svg, edge, layout.positions.get(edge.from), layout.positions.get(edge.to));
} for (const node of layout.nodes) appendAtlasNode(svg, node, layout.positions.get(node.id));
scroll.append(svg); frame.append(scroll);
return frame; }
function appendAtlasLanes(svg, lanes) {
for (const lane of lanes) { svg.append(svgTextNode("text", { x: lane.x, y: 25, class: "atlas-lane-label" }, lane.label.toUpperCase()));
svg.append(svgNode("line", { x1: lane.x, y1: 36, x2: lane.x + lane.width, y2: 36, class: "atlas-lane-rule" })); }
} function appendAtlasEdge(svg, edge, from, to) {
const [pathData] = atlasPath(from, to);
svg.append(svgNode("path", { d: pathData, class: "atlas-edge is-generic" }));
} function appendAtlasNode(svg, node, box) {
const group = svgNode("g", { class: `atlas-node is-${safeToken(node.type)}`,
tabindex: "0", role: "button",
"aria-label": `Focus relationship view on ${node.title}`, });
group.append(svgTextNode("title", {}, `${node.title} · ${entityTypeLabel(node)} · ${recordProvenance(node) || node.status}`)); const radius = node.type === "domain" ? 26 : node.type === "person" ? 18 : node.type === "experience" ? 10 : node.type === "idea" ? 2 : 4;
group.append(svgNode("rect", { x: box.x,
y: box.y, width: box.width,
height: box.height, rx: radius,
class: "node-surface", }));
const lines = wrapLabel(node.title, 29); const title = svgNode("text", { x: box.x + 15, y: box.y + 23, class: "atlas-node-title" });
lines.slice(0, 2).forEach((line, index) => { title.append(svgTextNode("tspan", { x: box.x + 15, dy: index === 0 ? 0 : 15 }, line));
}); group.append(title);
group.append(svgTextNode("text", { x: box.x + box.width - 14,
y: box.y + box.height - 10, class: "atlas-node-meta",
"text-anchor": "end", }, `${entityTypeLabel(node)} · ${node.status}`));
const inspect = () => setGraphFocus(node.id); group.addEventListener("click", inspect);
group.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") {
event.preventDefault(); inspect();
} });
svg.append(group); }
async function openEntity(id) { if (!id || !state.entityById.has(id)) return;
const summary = state.entityById.get(id); state.inspectorRequest += 1;
const requestId = state.inspectorRequest; dom.inspectorKicker.textContent = `${entityTypeLabel(summary)} · ${summary.privacy}`;
dom.inspectorTitle.textContent = summary.title; dom.inspectorRevision.textContent = shortRevision(state.snapshot?.revision);
replaceChildren(dom.inspectorBody, renderSkeleton()); if (!dom.inspector.open) dom.inspector.showModal();
announce(`Opened ${summary.title}`); try {
let detail = state.detailCache.get(id); if (!detail) {
const payload = await getJson(API.entity(id)); detail = payload.entity;
state.detailCache.set(id, detail); }
if (requestId !== state.inspectorRequest) return; renderInspector(detail);
} catch (error) { if (requestId !== state.inspectorRequest) return;
replaceChildren(dom.inspectorBody, renderError("Record unavailable", readableError(error))); }
} function renderInspector(entity) {
dom.inspectorKicker.textContent = `${entityTypeLabel(entity)} · ${entity.privacy}`; dom.inspectorTitle.textContent = entity.title;
const fragment = document.createDocumentFragment(); const meta = make("div", "entity-meta-strip");
appendRecordBadges(meta, entity);
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
sourceSection.append(make("h3", "", "Sources")); const sources = make("ul", "source-list");
for (const source of entity.sources) {
const item = make("li"); const url = sourceWebUrl(source);
if (url) { const link = make("a", "source-link", source); link.href = url; link.target = "_blank"; link.rel = "noopener noreferrer"; item.append(link); }
else item.textContent = source; sources.append(item);
} sourceSection.append(sources);
fragment.append(sourceSection); }
replaceChildren(dom.inspectorBody, fragment); }

function renderInspectorRelations(entity, references) {
const section = make("section", "entity-section relation-inspector"); const heading = make("div", "relation-inspector-heading");
heading.append(make("h3", "", "Relationship index")); if (state.graphNodeById.has(entity.id)) { const focus = make("button", "relation-focus", "See connections");
focus.type = "button"; focus.addEventListener("click", () => { dom.inspector.close(); openInAperture(entity.id); }); heading.append(focus); }
section.append(heading, make("p", "relation-boundary", "Direction reflects where a frontmatter link is declared. Reason, evidence, and review state are not structured."));
if (references.outgoing.length) section.append(renderReferenceGroup("Outgoing declarations", references.outgoing, "This record links to"));
if (references.incoming.length) section.append(renderReferenceGroup("Incoming backlinks", references.incoming, "Links here from"));
return section;
}

function renderReferenceGroup(title, references, directionLabel) {
const group = make("div", "backlink-group"); group.append(make("h4", "", `${title} · ${references.length}`)); const list = make("ul", "backlink-list");
for (const reference of references) { const related = state.entityById.get(reference.otherId); if (!related) continue;
const item = make("li", "backlink-item"); const button = make("button", "relation-list-button"); button.type = "button";
button.append(make("strong", "", related.title), make("span", "", `${directionLabel} · legacy link`)); button.addEventListener("click", () => openEntity(related.id));
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
make("span", "search-result-type", entityTypeLabel(entity)), make("span", "", ""),
make("span", "status-label", entity.status), );
const copy = result.children[1]; copy.append(make("strong", "", entity.title), make("small", "", entity.summary || entity.id));
const badges = make("span", "record-badges"); appendRecordBadges(badges, entity); copy.append(badges);
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
return "Read and edit this draft before sharing. Nothing has been sent."; }
return item.reason || item.summary || "Inspect the linked context and make the decision manually."; }
function linkedIds(workstream) { const ids = [...asArray(workstream.linkedPeople), ...asArray(workstream.linkedEntities)];
return [...new Set(ids)].filter((id) => state.entityById.has(id)); }
function attentionText(workstream) { const attention = asArray(workstream.attention);
if (attention.length) return `Review: ${attention.slice(0, 3).join(" · ")}`; return "No next step saved yet. Open this plan to pick up the details.";
} function matchesQuery(entity) {
if (!state.query) return true; return searchableText(entity).includes(state.query.toLocaleLowerCase());
} function searchableText(entity) { return recordSearchText(entity); }
function entityTypeLabel(entity) {
  return entity.type === "project" ? "Plan" : entity.type === "journal" ? "Note" :
    entity.type === "domain" ? "Life area" : humanize(entity.resourceKind || entity.type);
}
function appendRecordBadges(parent, entity) {
  if (entity.resourceKind) parent.append(make("span", "record-kind", humanize(entity.resourceKind)));
  const provenance = recordProvenance(entity);
  if (provenance) { const badge = make("span", "record-provenance", provenance);
    badge.dataset.kind = entity.demoKind; parent.append(badge); }
}
function atlasNodeVisible(node) {
  return ["domain", "idea", "project", "experience", "person", "profile", "resource"].includes(node.type);
}
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
