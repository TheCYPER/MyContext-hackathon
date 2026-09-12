# MyContext dashboard

Margin is the local, read-only dashboard for MyContext. It projects Markdown
committed in a context Git repository into a review desk, workstreams, people,
ideas, experience records, and a relationship graph.

## Run the demo

Requirements: Node.js 20 or later, Ruby with Psych, Git, and ripgrep for setup
and repository checks. The dashboard has no npm dependencies to install.

From the MyContext source directory:

```bash
bash scripts/setup.sh demo
npm --prefix dashboard start
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

Source code and personal context can stay in separate repositories. For a
second local instance, choose another port. No browser control can change the
configured context root or write to either repository.

## What appears in the dashboard

- Markdown and Git are the durable source of truth. The projector reads
  tracked canonical files from **Git `HEAD`**; uncommitted edits do not appear.
  After an approved context update is committed, refresh the page.
- Canonical records live under `profile/`, `domains/`, `projects/`, `ideas/`,
  `experience/`, `people/`, and `journal/` in the context repository.
- `restricted` records and all `sources/session-exports/` are excluded.
  Both `public` and `private` canonical records can appear locally.
- Drafts appear for human review and stay drafts. The dashboard cannot approve,
  apply, sign, send, or schedule anything.
- Work experience stays separate from project workstreams. Candidate ideas
  remain outside active workstreams until a project record is approved.
- Other AI tasks and transcript stores are not inspected. The Runs view has no
  connected operation feed.

The relationship view follows existing frontmatter `links`. It supports
backlinks, one- and two-hop neighborhoods, and connection paths. Each edge is
a generic `related_to` link: its reason, evidence, and review status are not yet
structured. A path shows which records are connected; it does not establish
causality, endorsement, or personal fit.

## Local API

```text
GET /api/v1/health
GET /api/v1/repo
GET /api/v1/snapshot
GET /api/v1/entities/:id
```

Responses carry the current Git revision. The API has no mutation, shell,
email, scheduling, or arbitrary-file endpoint. The browser loads no remote
assets or previews and displays Markdown as text without executing embedded
HTML. The `/api/v1` route version identifies the HTTP contract;
`schemaVersion` independently identifies the projected document shape.

## Test

```bash
npm --prefix dashboard test
tests/dashboard-smoke.sh .
```

Backend tests create fictional temporary Git repositories and use an available
local port. They do not need access to anyone's personal context repository.
