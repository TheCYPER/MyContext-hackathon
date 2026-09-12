# MyContext dashboard

The MyContext dashboard is a local, read-only view of academic and professional
context. It projects Markdown committed in a context Git repository into projects,
internship and work experiences, research and project ideas, collaborators and a
relationship graph. Codex or another local AI uses the same records while helping
the owner study, research and build.

## Run the demo

Requirements: Node.js 22.13+, Ruby 2.6+ with Psych, Git 2.28+ and a POSIX shell.
Install the dashboard's React, shadcn/Radix, Tailwind, and Zustand packages from
the source root.

From the MyContext source directory:

```bash
npm ci
bash scripts/setup.sh demo
npm run build
npm start
```

Open <http://127.0.0.1:4318>. The default context is `.local/demo`, resolved
relative to the source checkout. This is a separate Git repository created by
setup from fictional sample data.

## Use your own context repository

Pass the path to a context Git repository root that has at least one commit:

```bash
node dashboard/server.mjs --root /absolute/path/to/context --port 4318
```

You can also set `MY_CONTEXT_ROOT`. The older `MYCONTEXT_ROOT` name remains a
fallback; an explicit `--root` takes precedence over both. Set
`MYCONTEXT_MARGIN_PORT` to override the default port, or use `--port`.
The server always binds to `127.0.0.1`.

For frontend development with Vite hot reload and the local API proxy, run:

```bash
npm run dev
```

Open <http://127.0.0.1:5173>. Theme selection supports light, dark, and system
preferences and is persisted locally in the browser with Zustand.

Source code and personal context can stay in separate repositories. For a
second local instance, choose another port. No browser control can change the
configured context root or write to either repository.

## What appears in the dashboard

- Markdown and Git are the durable source of truth. The projector reads
  tracked canonical files from **Git `HEAD`**; uncommitted edits do not appear.
  The page checks for committed changes every five seconds while visible and
  when returning to the page. Uncommitted edits remain outside the projection.
- Canonical records live under `profile/`, `domains/`, `projects/`, `ideas/`,
  `experience/`, `people/`, and `journal/` in the context repository. The graph
  includes visible journal records and review drafts as well as the main entity
  types.
- `restricted` records and all `sources/session-exports/` are excluded.
  Both `public` and `private` canonical records can appear locally.
- Drafts appear for human review and stay drafts. The dashboard cannot approve,
  apply, sign, send, or schedule anything.
- Work experience stays separate from project workstreams. Candidate ideas
  remain outside active workstreams until a project record is approved.
- Other AI tasks and transcript stores are not inspected. Runs is hidden unless
  the API explicitly reports an available operations capability.
- The distributed academic scenario is labelled as synthetic. That notice does
  not appear on unmarked personal records.

The relationship view preserves these connection classes:

- A frontmatter `relations` entry is a directed semantic assertion. Its stable ID,
  predicate, evidence, sources, review state, privacy, optional validity dates, and
  note remain attached to the edge. Parallel assertions between the same records
  remain separate.
- An existing `links` entry remains a legacy, untyped `related_to` connection. It
  can support navigation and undirected connection paths, but it has no structured
  reason, evidence, or review state.
- Exact `sources: ["context:<stable-id>"]` references create separate untyped
  recorded source connections. Their provenance remains `frontmatter.sources`;
  they do not become typed evidence or confirmed assertions automatically.

One- and two-hop neighborhoods can be filtered by predicate, review state,
evidence availability, and current validity using the controls above the graph.
Choose **1 hop** or **Expand to 2** around the focused record. Click a record to
focus it, click the focused record to inspect it, and select an edge marker to
inspect its declaration. The graph scrolls when it exceeds the available space;
record and edge controls also support keyboard activation.

Select a **Connection target**, choose **Trace mode**, and press **Trace** to
follow directed typed arrows or navigate both directions across visible
connections. The graph retains and highlights the complete selected path,
including records beyond the current neighborhood.
**Needs you** opens the review drawer while exploring the graph, preserving space
for the canvas. Escape closes the drawer and returns focus to its button. Paths always omit rejected assertions and
assertions outside their validity window, even when those edges are visible through
inspection filters. A path
describes recorded connectivity; it does not establish causality, endorsement, or
personal fit. The projector never infers a typed relation from a legacy link or
from body text.

Typed assertions use the record containing `relations` as their subject. The
supported predicates are `participates_in`, `part_of`, `about`, `motivated_by`,
`supports`, `contradicts`, and `supersedes`; endpoint types are validated against
the schema. `supersedes` requires two records of the same type. Evidence and review
are independent: `inference` labels an interpretation, while `confirmed` says the
assertion itself was reviewed. Optional `valid_from` and `valid_to` values are ISO
dates and bound when the assertion applies. A projected edge uses the strictest
privacy of the assertion, its two endpoint records, and any canonical `context:*`
source records it cites. An assertion is omitted when one of those context sources
is missing or excluded from the projection.

| Predicate | Allowed subject types | Allowed target types |
| --- | --- | --- |
| `participates_in` | person, profile | project, experience, domain, idea |
| `part_of` | project, experience, idea | project, experience, domain |
| `about` | journal, draft, idea | any canonical record type |
| `motivated_by` | project, idea | project, idea, experience, person, journal, domain |
| `supports`, `contradicts` | any canonical record type | any other canonical record |
| `supersedes` | any type except profile | another record of the same type |

All predicates reject self-relations and missing targets. Evidence is one of
`artifact`, `first_party`, `user_confirmed`, `external_primary`,
`external_secondary`, or `inference`; it describes the support, not a numeric trust
score. Review is `unreviewed`, `confirmed`, or `rejected` and remains independent
of evidence. Source locators must be non-empty, and the demo uses only
`demo:fictional`.

## Local API

```text
GET /api/v1/health
GET /api/v1/repo
GET /api/v1/snapshot
GET /api/v1/graph
GET /api/v1/entities/:id
```

`/api/v1/graph` returns the graph, predicate registry, current revision, and
projection boundaries without duplicating every entity body. Entity requests can
include `?revision=<40-character-commit>`; the server returns `409 revision_changed`
if `HEAD` changed after the caller loaded the graph. Responses carry the current
Git revision. The API has no mutation, shell,
email, scheduling, or arbitrary-file endpoint. The browser loads no remote
assets or previews and displays Markdown as text without executing embedded
HTML. The `/api/v1` route version identifies the HTTP contract;
`schemaVersion: 5` independently identifies the projected document shape.

## Query the graph from the command line

`scripts/query-graph.sh` projects the selected context's committed `HEAD`, using
the same privacy and schema rules as the dashboard. Select the context with an
absolute `--root` or `MY_CONTEXT_ROOT` path, then request a neighborhood or path:

```bash
bash scripts/query-graph.sh --root "$PWD/.local/demo" --json \
  neighbors person.rhea-sen
bash scripts/query-graph.sh --root "$PWD/.local/demo" --include-inference --include-drafts --json \
  path idea.evidence-calibration project.eval-notebook
```

`neighbors ID` defaults to one hop and accepts `--depth 1..3`. `path START TARGET`
finds the shortest recorded path within three hops by default and accepts
`--max-hops 1..6`. Both commands accept `--direction outgoing|incoming|both`, an
exact `--predicate`, and `--as-of YYYY-MM-DD`; `--json` includes the revision,
nodes, complete edge metadata, applied filters, and traversal direction.

By default the query includes current, confirmed, non-inference typed assertions
and excludes restricted, inference-evidence, rejected, unreviewed, legacy, draft,
and archived graph data. The explicit `--include-unreviewed`,
`--include-rejected`, `--include-legacy`,
`--include-inference`, `--include-drafts`, and `--include-archived` switches widen
those boundaries. Review and inference filters are independent: an unreviewed
inference needs both corresponding switches.
Restricted data is always excluded. The human-readable output is intentionally
compact; use `--json` when evidence and provenance must be inspected.

## Test

```bash
npm test
npm run build
bash scripts/query-graph.sh --root "$PWD/.local/demo" --json neighbors person.rhea-sen
```

The full check includes component tests, frontend model tests, backend tests, and
the production build. Backend tests create fictional temporary Git repositories
and use an available local port. They do not need access to anyone's personal
context repository.
