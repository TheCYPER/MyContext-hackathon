# MyContext

**Your academic and professional context, ready for your next AI session.**

MyContext keeps the context behind your work: what you tried, what you learned,
which evidence supports a result, and what to do next. Use it with Codex or another
local AI assistant to continue a research project, prepare an internship summary,
or return to a course topic without explaining everything again.

[Watch the demo](#watch-the-demo) · [Get started](#get-started) · [Try a scenario](docs/scenarios.md) ·
[Skills](#skills-and-workflows) · [Tech stack](#tech-stack) ·
[Install with your AI](docs/getting-started.md#install-with-your-ai) ·
[中文指南](docs/guide.zh-CN.md)

![MyContext connects projects, experience, ideas and learning across AI sessions.](docs/assets/hero.svg)

## Watch the demo

A recorded walkthrough of MyContext · 4 min 10 sec.

https://github.com/user-attachments/assets/21dbb683-00e7-41c3-8356-64bcffb37c41

## See your work in context

The local dashboard brings projects, research ideas, collaborators and experience
together. Open a record to see its current state, supporting notes and unresolved
questions.

![The current MyContext dashboard, with academic record counts, project context and recorded next steps.](docs/assets/screenshots/overview.png)

*The demo follows Alex Lin, a fictional computer science student. All people,
institutions, experiences and results in its 67 linked records are invented.*

## Four ways to use it

| You are about to… | Ask your assistant… | Context to bring back |
| --- | --- | --- |
| Resume a research experiment | “Why was the earlier result withdrawn, and what should I run next?” | The leakage review, revised split, remaining uncertainty and next comparison |
| Prepare an internship summary | “Help me describe my contribution accurately.” | Your role, project evidence, handover notes and claims still awaiting review |
| Return to a difficult course topic | “What did I understand last time, and where did I get stuck?” | Earlier reasoning, independent attempts and the next practice question |
| Explore a project idea | “What is the smallest useful test before I start building?” | The motivation, constraints and first validation step |

[Walk through these scenarios →](docs/scenarios.md)

## Skills and workflows

Five local AI Skills connect your assistant to the library. Open a Skill below
for its instructions, tools and examples.

| Skill | What it helps you do |
| --- | --- |
| [`my-context`](skills/my-context/SKILL.md) | Resume work with relevant records; capture decisions, checked results, learning gaps and next steps with sources. New captures wait for review by default, or become local journal commits under an explicitly enabled policy. |
| [`mycontext-librarian`](skills/mycontext-librarian/SKILL.md) | Find evidence through ranked lexical search, recorded aliases, graph neighborhoods and shortest recorded paths. Return supporting records and preserve their uncertainty. |
| [`session-import`](skills/session-import/SKILL.md) | Export one explicitly selected task or import a supplied Markdown export, then prepare a separate proposal to distill useful facts into canonical records. |
| [`research-person`](skills/research-person/SKILL.md) | Research a potential collaborator or mentor using dated primary sources, resolve identity and distinguish verified professional facts from inferred fit. |
| [`outreach`](skills/outreach/SKILL.md) | Prepare personalized outreach drafts, follow-ups, meeting preparation and post-meeting records using relevant context about both parties. |

Use `my-context` for [portfolio and internship summaries](docs/scenarios.md#internship-portfolio):
bring together your contribution, project evidence and wording awaiting review.
[Setup tools](docs/getting-started.md) create a fictional demo or blank personal
library, install all five Skills in that library, or bind `my-context` for use
across projects. For library maintenance, [`validate.sh`](scripts/validate.sh)
checks a staged snapshot for schema, relationship targets and known secret patterns.

Skills run when invoked or selected by your assistant and follow the chosen
library's access and write policies. Research and drafting use your assistant's
available tools. Outreach stays draft-only; the dashboard's draft review list is
separate from the capture queue.

## Carry context between sessions

The **My Context Skill** connects your assistant to your library from other
projects. Retrieve the relevant records before starting work; capture useful
outcomes when the session produces something worth keeping.

![The context loop: work with AI, capture selected facts with sources, save with review or an enabled journal policy, and retrieve them in the next session.](docs/assets/context-cycle.svg)

Capture queues new information for **review by default**. An explicit opt-in can
allow automatic private journal entries and local Git commits. Changes to existing
records still require review. Capture uses selected information from the active
task; it does not collect conversations in the background or automatically push
your notes to a remote.

Your records live in a separate local Git repository as readable Markdown and
YAML. The dashboard displays committed records and is read-only; your AI assistant
handles retrieval and proposed updates.

## Follow the connections

Start from a project, person or idea and explore its neighborhood. Typed
relationships can explain who participates in a project, which note supports a
claim, or what supersedes an earlier result. Open an edge to inspect its evidence.
Start with **1 hop**, then use **Expand to 2** to reveal nearby records. Choose a
**Connection target** and select **Trace** to inspect a recorded path.

![The demo graph connects a research project with its collaborators, ideas and supporting records.](docs/assets/screenshots/graph.png)

Generic links help you navigate. Typed relationships carry recorded meaning.
The dashboard checks for new commits every five seconds while visible, preserving
your current focus when that record remains available.

[Graph controls and queries →](dashboard/README.md)

## Get started

Requires **Git 2.28+, Node.js 22.13+, Ruby 2.6+** and a POSIX shell (macOS, Linux or WSL).
The dashboard uses local npm dependencies. No Ruby gems or API key are needed.

```bash
git clone https://github.com/TheCYPER/MyContext-hackathon.git
cd MyContext-hackathon
npm ci
npm run setup
npm test
npm run build
npm start -- --root "$PWD/.local/demo"
```

Open **http://127.0.0.1:4318**. Setup creates an independent fictional demo in
`.local/demo/`. If the port is occupied, use `npm start -- --root "$PWD/.local/demo" --port 4319`.

The build creates `dashboard/dist/` for the production server. For frontend
development with hot reload, run `npm run dev` and open port 5173.

Prefer to have your AI set it up? Copy the
[complete installation prompt](docs/getting-started.md#install-with-your-ai). It
covers the demo, verification, a blank personal library, and cross-project Skill
setup.

When you are ready to add your own context, follow the
[personal library guide](docs/getting-started.md#use-your-own-context). Start with
one course, internship or project; the initializer leaves your profile blank.

## Tech stack

| Layer | Technologies |
| --- | --- |
| Dashboard | React 19, TypeScript and Vite |
| UI and styling | Tailwind CSS 4, shadcn/ui components built on Radix UI, Phosphor Icons and Zustand for theme preferences |
| Local server | Node.js HTTP server serving the dashboard and read-only JSON API |
| Context tools | Ruby and shell scripts for retrieval, graph queries, capture, validation and setup |
| Knowledge storage | Markdown with YAML frontmatter, stable record IDs, recorded relationships and Git history |
| Verification | Ruby Minitest, Node.js test runner, Vitest, Testing Library and GitHub Actions |

The graph uses custom SVG views. The dashboard and graph queries project committed
Git `HEAD`; lexical search reads files on disk. Context lives in a separate local
repository, with no database or embedding service required.

## Guides and reference

- [Getting started](docs/getting-started.md) — installation, your own library and cross-session capture.
- [Scenarios](docs/scenarios.md) — four concrete workflows with demo records and prompts.
- [Demo walkthrough](examples/demo/README.md) — explore the fictional academic workspace.
- [Dashboard guide](dashboard/README.md) — views, graph controls and read-only API.
- [Context schema](meta/schema.md) — record fields, evidence and relationships.
- [Privacy boundaries](SECURITY.md) · [Contributing](CONTRIBUTING.md) · [MIT license](LICENSE)

## Contributors

Thanks to everyone contributing code, design, documentation and ideas.

[![MyContext contributors](https://contrib.rocks/image?repo=TheCYPER/MyContext-hackathon)](https://github.com/TheCYPER/MyContext-hackathon/graphs/contributors)

Contributor image by [contrib.rocks](https://contrib.rocks).
