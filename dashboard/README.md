# MyContext dashboard

Browse your projects, internship experiences, research ideas, collaborators, and
work notes in one local view. The dashboard reads the committed records in your
context repository; your AI assistant uses those same records during a task.

![Connected academic and professional context](../docs/assets/screenshots/graph.png)

This screenshot shows the earlier layout; the current dashboard uses the React
and shadcn interface described below.

## Run locally

Requirements: Node.js 22.13+, Ruby 2.6+ with Psych, Git 2.28+, and a POSIX shell.
From the software directory, install dependencies, create the fictional demo,
and build and start the dashboard:

```bash
npm ci
npm run setup
npm run build
npm start -- --root "$PWD/.local/demo"
```

Open **http://127.0.0.1:4318**. For prerequisites and a complete AI installation
prompt, see [getting started](../docs/getting-started.md).

To view a different context repository with at least one commit:

```bash
node dashboard/server.mjs --root /absolute/path/to/context --port 4319
```

An explicit `--root` takes precedence over `MY_CONTEXT_ROOT`, then the older
`MYCONTEXT_ROOT` alias. Without these, the dashboard uses `.local/demo/` relative
to the software checkout. `--port` overrides `MYCONTEXT_MARGIN_PORT` and the
default port 4318. The server binds to `127.0.0.1`.

For frontend development, run `npm run dev` and open **http://127.0.0.1:5173**.
Vite provides hot reload and proxies the local API. Light, dark, and system theme
preferences are saved locally in the browser.

## Explore the graph

1. Open a record in the graph, or expand **Global overview** and select a record
   to focus it. Choose **1 hop** or **Expand to 2** around the focused record.
2. Click another record to focus it; click the focused record to inspect its
   details. Select an edge marker to inspect its declaration, source, evidence,
   and review state. Parallel assertions remain individually accessible.
3. Use the **Predicate**, **Review**, and **Evidence** selectors above the graph.
   **Include rejected** and **Include outside validity** reveal those assertions
   for inspection.
4. Select a **Connection target**, choose **Trace mode**, and press **Trace**.
   Directed mode follows typed arrows; undirected mode navigates visible
   connections in either direction. Every record and edge in the selected path
   remains visible, including steps beyond two hops.
5. Click a record in the path to refocus without losing the path. **Clear path**
   returns to the current neighborhood. Changing filters or trace mode clears the
   old path so the next trace uses the new selection.

The focused neighborhood has a 200-record display limit; selected path records
are retained even beyond that limit. Every recorded edge between visible nodes
is included. The canvas scrolls when it exceeds the available space, and record
and edge controls support Enter or Space for keyboard activation.
**Needs you** opens the review drawer while exploring the graph. Escape closes
it and returns focus to its button.

## Understand the connections

| Connection | What it represents |
| --- | --- |
| Typed relation | A directed assertion such as a person participating in an experience or a journal entry about a project. It keeps its own source, evidence, review state, and optional validity dates. |
| Navigation link | A record's explicit `links` entry. It connects records without asserting a specific semantic relationship. |
| Recorded source reference | An exact `context:<stable-id>` source locator connecting a record to the canonical record it cites. It remains untyped. |

The supported predicates are `participates_in`, `part_of`, `about`, `motivated_by`,
`supports`, `contradicts`, and `supersedes`. Evidence and review are separate:
`inference` labels an interpretation, while `confirmed` records that the assertion
was reviewed. Inspect [the schema](../meta/schema.md) for allowed endpoint types,
source locators, and privacy rules.

Paths describe recorded connectivity. They omit rejected assertions and assertions
outside their validity window, even if inspection filters display those edges.
Following several links does not establish a new fact about their endpoints.

## Automatic updates

The page checks for new committed context every five seconds while visible,
and when the tab becomes visible or the window regains focus. Checks that find
an unchanged revision preserve the current graph and open details. A new revision
preserves valid focus and filters, clears old traces and relation selections, and
removes targets that are no longer available. If the focused record disappears,
the graph chooses another visible record. A failed refresh keeps the last loaded
revision visible with an error notice and retries on subsequent checks.

New `context:<id>` source references connect when both records are available.
References to missing, restricted, removed, or ambiguous records are excluded;
missing targets can connect after they are committed. Duplicate and self
references are ignored. Projection diagnostics report unresolved or excluded
references as `unavailableSourceReference`.

The dashboard remains read-only; approved changes become visible after they are
committed to the context repository.

## Records and privacy

- The dashboard reads tracked canonical files from Git **HEAD**. Uncommitted
  changes and capture candidates awaiting review are outside this view.
- Projects, experiences, ideas, profiles, domains, people, journal entries, and
  review drafts can appear. Ideas retain their draft status until their records
  are updated through review.
- `restricted` records and `sources/session-exports/` are excluded. Both `public`
  and `private` records can appear in this local view. Live refresh removes records
  that become restricted or are deleted and clears their previously loaded details.
- A typed edge uses the strictest privacy of the assertion, its endpoints, and
  canonical source records. Missing or excluded source records exclude the edge.
- Drafts remain material for review. The dashboard has no approval, writing,
  message-sending, or scheduling endpoint.

## Local API

```text
GET /api/v1/health
GET /api/v1/repo
GET /api/v1/snapshot
GET /api/v1/graph
GET /api/v1/entities/:id
```

`/api/v1/graph` returns the graph, predicate registry, revision, and projection
boundaries. Entity requests accept `?revision=<40-character-commit>` and return
`409 revision_changed` if HEAD changed after the caller loaded the graph.
Responses carry the current revision. HTTP routes use `/api/v1`; the projected
document uses `schemaVersion: 5`.

The API is read-only and has no arbitrary-file or shell endpoint. The browser
loads no remote assets or previews and displays Markdown as text without
executing embedded HTML.

## Query from the command line

Graph queries use the same committed context, schema, and privacy rules:

```bash
bash scripts/query-graph.sh --root "$PWD/.local/demo" --json \
  neighbors person.rhea-sen
bash scripts/query-graph.sh --root "$PWD/.local/demo" --include-inference --include-drafts --json \
  path idea.evidence-calibration project.eval-notebook
```

`neighbors ID` defaults to one hop and accepts `--depth 1..3`. `path START TARGET`
defaults to three hops and accepts `--max-hops 1..6`. Both accept
`--direction outgoing|incoming|both`, an exact `--predicate`, and
`--as-of YYYY-MM-DD`. JSON output includes revision, nodes, edge metadata, filters,
and traversal direction.

Queries default to current, confirmed, non-inference typed assertions. Use
`--include-unreviewed`, `--include-rejected`, `--include-legacy`,
`--include-inference`, `--include-drafts`, or `--include-archived` to include those
categories. An unreviewed inference needs both relevant switches. Restricted
records remain excluded.

## Test

Run `npm --prefix dashboard run test:run` from the software directory for component
tests. The complete application check is `npm test`; it includes the production
build, frontend model tests, and backend tests. Backend tests use fictional
temporary Git repositories and an available local port.
