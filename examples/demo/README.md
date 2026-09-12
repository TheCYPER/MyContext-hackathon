# Explore the academic demo

Follow **Alex Lin / 林知远**, a fictional third-year computer science student,
through an internship, research experiments, course learning, and future project
ideas. The 67 linked records give your AI enough context to continue a task with
its earlier decisions and unresolved questions in view.

![The MyContext academic demo](../../docs/assets/screenshots/overview.png)

All people, institutions, dates, contributions, and results are invented.
Every record uses `sources: ["demo:fictional"]`. Projects described in these
records are scenario content, separate from the MyContext application itself.

## Run and explore

From the software checkout:

```bash
npm run setup
bash scripts/install-skills.sh "$PWD/.local/demo"
npm start -- --root "$PWD/.local/demo"
```

Open **http://127.0.0.1:4318**. Setup creates `.local/demo/` with its own Git
history. Open that directory as your AI workspace and set `MY_CONTEXT_ROOT` to
its absolute path when using the demo's Skills. Ask questions in your assistant;
the dashboard provides the visual view of committed records.

| Start with | Follow the context to | Try asking |
| --- | --- | --- |
| [Eval Notebook](projects/eval-notebook/overview.md) | Withdrawn result, split correction, advisor discussion | Why was the first result withdrawn, and what should I check next? |
| [Meridian internship](experience/meridian-internship/overview.md) | Motion Atlas, FrameBridge, contribution draft | What can I accurately say about my internship? |
| [StudyMap](projects/study-map/overview.md) | Guided explanation, recall gap, later practice | What should I practise before calling this topic understood? |
| [Experiment Index](ideas/projects/experiment-index.md) | Evaluation problems and a proposed first validation | How can I test this idea before building it? |

See [four scenarios with prompts and source-backed outputs](../../docs/scenarios.md).

## What is included

| Record type | Count |
| --- | ---: |
| Profile | 3 |
| Domains | 6 |
| Experiences | 3 |
| Projects | 10 |
| Research ideas | 8 |
| Project ideas | 4 |
| People | 8 |
| Journal entries | 20 |
| Review drafts | 5 |
| **Total** | **67** |

Ten curated typed relation assertions illustrate how a mentor connects to an
experience, a journal entry describes a project, or a later protocol replaces an
earlier one. Their evidence and review labels describe the fictional scenario.
Ordinary links remain navigation connections. Use the [graph guide](../../dashboard/README.md#explore-the-graph)
to inspect both.

Ideas use the `draft` lifecycle, so command-line idea searches need
`--include-drafts`. The parked CourseQuery exercise requires
`--include-archived`. An internship overview can remain an active record after
the internship ends; its body explains the completed experience.

## Start a personal library

Create an empty repository with
`bash scripts/setup.sh personal /absolute/new/path` from the software directory.
The initializer uses blank templates. Follow [the setup guide](../../docs/getting-started.md#use-your-own-context)
to connect it to your AI.

If setup reports an outdated demo, stop its server and preserve `.local/demo/`
under an unused backup name before creating a new copy. Keep any notes you added.
