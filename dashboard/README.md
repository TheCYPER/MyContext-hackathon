# MyContext dashboard

MyContext is a local, read-only view of your personal context: people, plans,
books, saved places, ideas, and notes. Its Home page brings these together;
Resources filters a collection by kind, and Connections explores recorded links.
The dashboard displays Markdown committed in a context Git repository.

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
setup from an invented personal-assistant scenario and sourced public references.
Compact badges distinguish **Fictional scenario** from **Public reference** on
records. Public sources are linked in the record inspector; they do not imply
that the fictional owner has a relationship with a public figure.

## Start completely empty

```bash
bash scripts/setup.sh empty
node dashboard/server.mjs --root .local/empty
```

The empty scaffold contains no personal entities. Home displays an invitation
to begin with your AI, rather than inventing records or displaying demo data.
Your AI follows the selected context folder’s review policy when adding records.
Refresh after the approved update is committed.

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
  `experience/`, `people/`, `resources/`, and `journal/` in the context repository.
- `restricted` records and all `sources/session-exports/` are excluded.
  Both `public` and `private` canonical records can appear locally.
- Drafts appear for human review and stay drafts. The dashboard cannot approve,
  apply, sign, send, or schedule anything.
- The UI calls `project` records **Plans** so reading, travel, learning, and
  other personal goals share the same portable model. Experience and ideas
  retain their own record types.
- `resource` records may carry `resource_kind`: `book`, `course`, `place`,
  `tool`, `music`, or `artwork`. Optional `demo_kind` is `fictional` or
  `public_reference`; unmarked personal records receive no demo badge.
- Other AI tasks and transcript stores are not inspected. Runs navigation and
  its Home section stay hidden unless the API explicitly reports an operation
  capability; the current dashboard has no connected operation feed.

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
