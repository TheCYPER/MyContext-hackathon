# Get started with MyContext

Run the fictional demo, then create a separate library for your own academic and
professional context. Your local AI assistant uses the library while you work;
the dashboard lets you browse the same committed records.

[Install with your AI](#install-with-your-ai) · [Use your own context](#use-your-own-context) ·
[Capture from another project](#capture-from-another-project) · [中文指南](guide.zh-CN.md)

## Run the demo

Requirements: **Git 2.28+, Node.js 22.13+, Ruby 2.6+, and a POSIX shell** on macOS,
Linux, or WSL. The dashboard uses local npm dependencies. No Ruby gems, API keys,
model downloads, or database services are needed. Use your existing local AI assistant.

```bash
git clone https://github.com/TheCYPER/MyContext-hackathon.git
cd MyContext-hackathon
npm ci
npm run setup
npm test
npm run build
npm start -- --root "$PWD/.local/demo"
```

Open **http://127.0.0.1:4318**. If that port is occupied, run
`npm start -- --root "$PWD/.local/demo" --port 4319` from the software directory
instead. The server stays on localhost. `npm run build` creates `dashboard/dist/`
for production; run it again after frontend changes. For frontend development
with hot reload, use `npm run dev` and open port 5173.

Setup creates `.local/demo/`, an ignored, independent Git repository with
[67 fictional records](../examples/demo/README.md). The dashboard reads its
committed state and checks for new commits every five seconds while the page is
visible, and when you return to it. A note you edit becomes visible after it is committed.

To try the demo with your assistant, install project-scoped Skills:

```bash
bash scripts/install-skills.sh "$PWD/.local/demo"
```

Open `.local/demo/` as the assistant's workspace and set `MY_CONTEXT_ROOT` to that
directory's absolute path. This explicitly selects the demo for its Skills. Start
with one of the [four scenarios](scenarios.md), or test retrieval from the source
directory:

```bash
bash scripts/search-context.sh --root "$PWD/.local/demo" --json "Eval Notebook"
```

Setup preserves an unchanged current demo. If it reports an outdated seed, stop
the demo server and move `.local/demo/` to an unused backup name before running
setup again. Keep any notes you added; setup does not overwrite or migrate them.

## Install with your AI

Copy this prompt into a local AI coding assistant with filesystem and terminal
access. It covers the demo, a blank personal library, and cross-project access.

```text
Install and verify MyContext for me from:
https://github.com/TheCYPER/MyContext-hackathon.git
Use the default branch, main.

I want a working fictional demo and a separate, initially empty library for my
academic and professional context. Complete the setup and report the actual
verification results.

1. Check the current directory and installed Git, Node.js, Ruby, and shell
   versions. Requirements are Git 2.28+, Node.js 22.13+, Ruby 2.6+, and a POSIX
   shell; use WSL on Windows. If a prerequisite is missing, explain how to
   install it and obtain any required system permission. Do not inspect auth
   files or print credentials.

2. Choose an unused software directory and clone the repository above. If a
   matching checkout already exists, inspect its origin and status before
   reusing it. Preserve existing work. Read the clone's README.md, AGENTS.md,
   SECURITY.md, docs/getting-started.md, and setup/install scripts. The
   dashboard uses local npm dependencies; no Ruby gems or model API key are needed.

3. From the source directory, run `npm ci`, `npm run setup`, `npm test`, and
   `npm run build` in that order. Verify that
   `.local/demo/` is an independent Git repository with its own initial commit
   and fictional records. Diagnose any failed check without disabling it.
   Preserve an outdated or modified demo before creating a replacement.

4. From the source directory, run
   `bash scripts/install-skills.sh "$PWD/.local/demo"` to link Skills into
   the demo's `.agents/skills/` and `.claude/skills/` directories. Preserve
   conflicts. Explain that the demo must be opened as the AI workspace and
   MY_CONTEXT_ROOT set to its absolute path when using those Skills.

5. From the source directory, start
   `npm start -- --root "$PWD/.local/demo"`. Check the health endpoint at
   http://127.0.0.1:4318/api/v1/health and inspect the visible dashboard.
   If needed, add `--port <port>` to that command to choose an unused port.
   Keep it on localhost. Confirm that projects, internship experiences,
   research ideas, collaborators, and the graph load. The dashboard displays
   committed context; questions are asked in my AI assistant.

6. From the source directory, run
   `bash scripts/search-context.sh --root "$PWD/.local/demo" --json
   "Eval Notebook"` as a single command. Read the relevant current note and
   a linked historical note. Explain why the first result was withdrawn,
   citing the files and preserving the limitations of the later run.

7. Choose an unused absolute directory for my own context, for example
   `$HOME/MyContextData`, outside the public source tree. Run
   `bash scripts/setup.sh personal "$HOME/MyContextData"`, replacing the
   example with the selected path. Verify its separate Git root, blank
   initial records, and absence of a remote. Leave unknown facts blank;
   do not copy Alex's fictional identity or import my other files or chats.

8. From the source directory, run
   `bash scripts/install-skills.sh "$HOME/MyContextData"` with the real
   selected path. Then run `bash scripts/install-global-skill.sh --context
   "$HOME/MyContextData"` as a single command. This installs only my-context
   globally and binds it to my new library. Preserve conflicting existing
   Skills or bindings and report them instead of replacing them. The other
   Skills stay project-scoped. Keep the software checkout in place because
   installed links refer to it.

9. From an unrelated directory, run the source checkout's absolute
   `scripts/capture-context.sh status` command and confirm the selected
   library. Explain how to invoke `$my-context` there to retrieve context or
   capture a selected outcome with its source. New libraries queue candidates
   for review outside canonical context. Leave automatic journal capture
   disabled; describe its separate reviewed policy opt-in. Existing-record
   changes follow the library's proposal rules. Do not configure a remote or
   push personal data as part of installation.

10. Start a second dashboard from the software directory with
    `npm start -- --root "$HOME/MyContextData" --port 4319`, substituting the
    selected path and an unused port. Verify the blank library. Finish with
    the software path, demo path, personal context path, dashboard URLs,
    checks and results, any unfinished step, and the next action I can take.
```

## Use your own context

After installing dependencies and building the dashboard as above, choose a new
data directory from the software directory:

```bash
bash scripts/setup.sh personal "$HOME/MyContextData"
bash scripts/install-skills.sh "$HOME/MyContextData"
npm start -- --root "$HOME/MyContextData" --port 4319
```

The initializer creates `profile/`, `people/`, `projects/`, `experience/`,
`ideas/`, `domains/`, `journal/`, and `sources/`, plus an index, blank profile
documents, and a separate Git history. It does not configure a remote.

Open `MyContextData` as your AI workspace and set `MY_CONTEXT_ROOT` to its
absolute path for project-scoped Skills. Begin with a course, internship, or
research project: the objective, what you have tried, supporting records, and
the next unresolved question. Read the new library's `AGENTS.md` before adding
information. Your assistant prepares existing-record edits as an exact proposal
with sources and privacy information for your approval.

For explicit command-line retrieval:

```bash
bash scripts/search-context.sh --root "$HOME/MyContextData" --json "your topic"
```

After staging a reviewed change, use the software checkout's
`bash scripts/validate.sh /absolute/path/to/context` to validate that staged
snapshot and check known secret patterns. Remote synchronization is separately
configured; local commits alone do not provide remote backup.

## Capture from another project

Bind your library once from the software directory:

```bash
bash scripts/install-global-skill.sh --context "$HOME/MyContextData"
bash scripts/capture-context.sh status
```

This installs `my-context` into `~/.agents/skills/` and `~/.claude/skills/`,
and records the library binding in `~/.config/mycontext/config.json`, or under
`XDG_CONFIG_HOME` if set. Pass `--skills-dir /absolute/path/to/client/skills`
to select one client. Existing conflicting links or bindings are preserved.

From your next research or coursework task, ask:

> Use $my-context to remember the experiment result, its limitations, and our next step.

The assistant captures selected facts from that task with sources and evidence
labels. It reports the result of the capture command:

| Mode | Result |
| --- | --- |
| Review, the default | A private candidate waits outside the context repository. It does not appear as a canonical fact. |
| Automatic journal, explicitly enabled | A new private journal entry is committed locally and becomes available to retrieval and the dashboard. |

Queued captures are separate from the dashboard's draft review list. Acceptance
uses the library's proposal process; there is no built-in queue approval command.

Existing-record edits and corrections retain the proposal workflow in both modes.
Automatic capture never pushes. To enable it, ask your assistant to prepare the
policy proposal in the [capture guide](../skills/my-context/references/capture.md)
and approve it under your library's rules. Installation does not enable it.

The Skill runs when invoked explicitly or selected by the assistant. For
predictable capture, request it in the task; it is not a background session
collector. See the capture guide for receipt inspection and retries.

## Troubleshooting

| Symptom | Action |
| --- | --- |
| A prerequisite is missing | Install the reported Git, Node.js, or Ruby version, then rerun setup. |
| Port 4318 is occupied | Keep the selected `--root` and add `--port 4319` or another unused port to the start command. |
| An edited note is absent from the dashboard | Check that the intended context is selected and the change is committed. Keep the page visible for the next five-second update, or return to it to trigger a check. |
| A Skill cannot resolve a library | Set an explicit `MY_CONTEXT_ROOT` or check the global binding with the capture `status` command. |
| An idea is missing from search | Use `--include-drafts`; draft ideas are excluded by default. |
| Capture says “queued” | The candidate awaits review. Inspect its receipt and the library's capture policy before expecting a journal entry. |

## Search and saved records

Search matches query terms in IDs, titles, aliases, tags and body text. Every term
must match; it does not use semantic similarity or a translation model. Include
`--include-drafts` when looking for a draft idea. Match scores describe relevance
to the query, not truth.

Lexical search reads files on disk, including uncommitted edits. Graph queries and
the dashboard read committed Git HEAD. Compare results against the same saved
state when checking a change. See the [retrieval guide](../skills/my-context/references/retrieval.md)
for filters and the [write policy](../meta/write-policy.md) for proposal approval.

Continue with [scenarios](scenarios.md), the [dashboard guide](../dashboard/README.md),
or the [context schema](../meta/schema.md).
