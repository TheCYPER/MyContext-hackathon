# MyContext

**Keep the context behind your work. Pick it up in the next AI session.**

MyContext stores project decisions, experiment results, research questions, and
work experience in Markdown files you own. Your AI assistant can search those
records, cite their sources, and queue new facts for your review. A local dashboard
lets you browse the records and their connections.

Built for students, researchers, and early-career professionals working with Codex
or another local AI coding assistant. The application needs no API key, database,
or model download. You bring your own assistant.

[Quick start](#quick-start) · [Use your own context](#use-your-own-context) ·
[Capture from other projects](#capture-from-other-projects) ·
[中文设计说明](docs/design.zh-CN.md) · [Contributing](CONTRIBUTING.md)

## What you can keep

| Coming back to… | Retrieve… |
| --- | --- |
| An experiment | The setup, failed attempts, limits of the result, and next check |
| A research question | The motivation, proposed comparison, and questions for an advisor |
| An internship | Your contribution, supporting work, and wording awaiting review |
| A course | Topics covered, gaps in understanding, and problems to revisit |
| A project | Decisions made, alternatives considered, and unresolved questions |

- **Readable records.** Markdown and YAML hold the notes, sources, dates, and links.
- **Search with sources.** Find records by ID, title, alias, tag, or body text.
- **Inspectable connections.** Follow recorded relationships and see their evidence and review state.
- **Reviewed updates.** New facts queue for review by default. Git keeps the history of committed changes.

## Quick start

Requires **Git 2.28+, Node.js 22.13+, Ruby 2.6+, and a POSIX shell** on macOS,
Linux, or Windows through WSL. The dashboard uses local npm dependencies;
no Ruby gems are needed.

```bash
git clone --branch main https://github.com/TheCYPER/MyContext-hackathon.git
cd MyContext-hackathon
npm ci
npm run setup
npm run build
npm start
```

Open [localhost:4318](http://127.0.0.1:4318). If that port is occupied, run
`npm start -- --port 4319` instead.

The build creates the production dashboard in `dashboard/dist/`. For frontend
development with hot reload, use `npm run dev` and open port 5173.

Setup creates a fictional demo in `.local/demo/`, with its own Git history and no
remote. It installs no system packages or AI skills. Your personal context will
live in a separate repository.

The demo follows **Alex Lin / 林知远**, a fictional computer science student.
Its 67 records include three work experiences, ten projects, twelve ideas,
collaborators, and dated work notes. All people, institutions, and results are
invented. See the [demo walkthrough](examples/demo/README.md).

In a second terminal, from the software directory, check the installation and
search the demo:

```bash
npm test
bash scripts/search-context.sh --root "$PWD/.local/demo" --json "Eval Notebook"
```

The search returns ranked records with file paths, sources, snippets, and match
reasons. To try the demo with your assistant, install its project-scoped skills:

```bash
bash scripts/install-skills.sh "$PWD/.local/demo"
export MY_CONTEXT_ROOT="$PWD/.local/demo"
```

Open `.local/demo/` as the AI workspace and make sure the assistant's environment
has `MY_CONTEXT_ROOT` set to that absolute path. Then ask:

> Use $my-context to explain why the first evaluation result was withdrawn.
> Cite the records and distinguish what is known from what still needs testing.

The dashboard displays **committed Git HEAD** and checks for changes every five
seconds while the page is visible. Commit approved note changes to see them;
returning to the page also checks for updates. It is a read-only view; you work with your
assistant in its own app.

<details>
<summary>Prefer to have your AI assistant set up the demo?</summary>

Copy this prompt into an assistant with filesystem and terminal access:

```text
Set up the MyContext fictional demo from:
https://github.com/TheCYPER/MyContext-hackathon.git
Use branch main and an unused local directory. Preserve existing work.

Read README.md, AGENTS.md, SECURITY.md, and the setup scripts first.
Check Git 2.28+, Node.js 22.13+, Ruby 2.6+, and a POSIX shell. Report missing
prerequisites rather than installing system packages without permission.

Run npm ci, npm run setup, npm test, and npm run build. Install project-scoped skills into
.local/demo/ with scripts/install-skills.sh. Set MY_CONTEXT_ROOT to the
absolute demo path when using those skills.

Start the localhost dashboard, check /api/v1/health, and verify the visible
fictional records. Search for Eval Notebook and inspect a matching record.
Choose another port if needed. Do not expose the server publicly.

Use only fictional demo data. Do not import personal files, install global
skills, configure a remote, or enable automatic capture.

Report the software path, demo path, dashboard URL, checks that passed,
any unfinished steps, and how to open the demo as my AI workspace.
```

For a personal library or access from other projects, follow the sections below.

</details>

## Use your own context

From the software directory, choose a **new, unused path** for your personal data:

```bash
bash scripts/setup.sh personal "$HOME/MyContextData"
bash scripts/install-skills.sh "$HOME/MyContextData"
export MY_CONTEXT_ROOT="$HOME/MyContextData"
npm start -- --root "$MY_CONTEXT_ROOT" --port 4319
```

This creates a separate Git repository with blank profile documents, an index,
and folders for projects, experience, ideas, people, domains, journals, and sources.
It copies no fictional identity and configures no remote.

Open that data directory as your AI workspace. Keep `MY_CONTEXT_ROOT` set in the
assistant's environment. Skill links point to the software checkout, so keep that
checkout at its installed path.

Start with one project: its purpose, what you have tried, the evidence, and the
next question. Ask your assistant to read the context's `AGENTS.md` and
`meta/write-policy.md`, then propose the exact changes. Review the diff before
it is applied and committed.

To validate a staged context change, run this from the software directory:

```bash
bash scripts/validate.sh "$HOME/MyContextData"
```

This checks the staged snapshot and known secret patterns. Unstaged edits are not
validated. See the [write policy](meta/write-policy.md) for proposal approval and
optional private-remote synchronization.

## Capture from other projects

To make your library available across projects, explicitly install the global
`my-context` skill and bind it to your personal context:

```bash
bash scripts/install-global-skill.sh --context "$HOME/MyContextData"
bash scripts/capture-context.sh status
```

The installer adds `my-context` to `~/.agents/skills/` and `~/.claude/skills/`,
and saves the binding in `~/.config/mycontext/config.json` or under
`XDG_CONFIG_HOME`. It refuses conflicting links or bindings. Use `--skills-dir`
with an absolute directory to install for one client only. Restart your client
if the skill does not appear.

From another project, ask:

> Use $my-context to remember the experiment result, its limitations, and our next step.

The assistant selects facts from the current task and attaches evidence labels
and source descriptions. Capture runs when the skill is invoked; there is no
background transcript collector or guaranteed end-of-session hook.

| Mode | Result |
| --- | --- |
| **Review (default)** | A private candidate waits outside the context repository. It is not yet available in the dashboard or canonical search. |
| **Automatic journal (opt-in)** | One new private journal entry is committed locally. Existing records still require reviewed changes. |

Queued captures are separate from the dashboard's draft review list. Acceptance
uses the library's proposal process; there is no built-in queue approval command.
Automatic journal capture requires a separately approved, committed policy.
Installation does not enable it. Neither mode pushes data remotely.

See the [capture guide](skills/my-context/references/capture.md) for policy setup,
queue location, receipts, and retries. Repeating an identical event is idempotent;
reusing its ID with different content is rejected.

## Search and connections

Run these examples from the software directory after setting up the demo:

```bash
# Search current records by a distinctive phrase.
bash scripts/search-context.sh --root "$PWD/.local/demo" --json "Eval Notebook"

# Ideas have draft status, so include drafts when looking for one.
bash scripts/search-context.sh --root "$PWD/.local/demo" --json \
  --include-drafts "idea.evidence-calibration"

# Inspect recorded relationships around a person.
bash scripts/query-graph.sh --root "$PWD/.local/demo" --json neighbors person.rhea-sen

# Explore an idea's path to a project, allowing drafts and inference.
bash scripts/query-graph.sh --root "$PWD/.local/demo" --json \
  --include-drafts --include-inference \
  path idea.evidence-calibration project.eval-notebook
```

**Search is lexical.** Every query term must appear in a record's ID, title,
aliases, tags, or body. It has no semantic similarity or translation model.
Drafts, archived records, restricted records, and source exports require their
respective opt-in flags. Match scores measure relevance to the query, not truth.

**The readers use different snapshots today.** Lexical search reads files on disk,
including uncommitted edits. Graph queries and the dashboard read committed HEAD.
Keep this distinction in mind when comparing results.

**Connections carry evidence.** A plain `links` entry records a connection without
specifying its meaning. Exact `context:<id>` source locators create separate,
untyped references to the cited records. A typed `relations` entry records a directed assertion,
its sources, review state, privacy, and optional validity dates. Graph queries
return the Git revision and the evidence for each step. A path does not prove a
new fact about its endpoints.

In the dashboard, start with one hop and use **Expand to 2** to reveal nearby
records. Select a destination and **Trace** to inspect a recorded connection path.
See [graph controls](dashboard/README.md#what-appears-in-the-dashboard).

Default graph queries exclude drafts, archived records, unreviewed or rejected
assertions, inference, and legacy links. Restricted records are always excluded.
See the [retrieval guide](skills/my-context/references/retrieval.md) for filters
and the [schema](meta/schema.md) for relation types and examples.

## Privacy and current limits

Your context stays in a separate local Git repository with no remote by default.
The dashboard binds to `127.0.0.1`, accepts reads only, and excludes restricted
records and session exports. Keep personal data off public tunnels and hosted
previews.

`private` is a label, not encryption or access control. The dashboard displays
private records locally. If an AI assistant reads them, that assistant's own data
handling settings apply. A skill does not restrict its filesystem permissions.
Never store credentials or third-party confidential material in context.

MyContext does not send messages, collect entire chat histories, or automatically
back up personal data. Journal capture does not update older project summaries;
those changes need review. Retrieval quality has not been benchmarked.
Read [SECURITY.md](SECURITY.md) for the full boundaries.

## Troubleshooting

| Problem | What to check |
| --- | --- |
| Port 4318 is busy | Use `npm start -- --port 4319`. |
| Notes are missing from the dashboard | Check the selected root, commit approved edits, and refresh. Restricted or invalid records are excluded. |
| Search misses an idea | Use `--include-drafts`. Try its exact ID or a recorded alias. |
| Setup reports an outdated or modified demo | Stop the server and preserve `.local/demo/` under an unused backup name before rerunning setup. Setup does not migrate it. |
| A skill or binding conflicts | Inspect the existing installation. Preserve it before choosing a migration; the installer will not overwrite it. |
| Capture says queued | Inspect the receipt reason. Default review mode, policy changes, or a dirty context can prevent automatic append. |

## Documentation and contributing

- [Demo walkthrough](examples/demo/README.md)
- [Dashboard, graph, and API](dashboard/README.md)
- [Record schema](meta/schema.md) and [write policy](meta/write-policy.md)
- [Retrieval](skills/my-context/references/retrieval.md) and [capture](skills/my-context/references/capture.md)
- [Design notes in Chinese](docs/design.zh-CN.md)
- [Contributing](CONTRIBUTING.md)

Run `npm test` for the source checks and regression suite. Tests use disposable
fictional contexts and need no personal files or AI account.

[MIT license](LICENSE). All distributed context examples are fictional.
