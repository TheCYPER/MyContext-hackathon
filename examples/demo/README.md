# A student's academic and professional context

Alex Lin / 林知远 is a fictional third-year computer science student. This scenario connects internship engineering, research exploration, course learning and future project ideas so a local AI assistant can continue a working session with relevant context.

All people, institutions, employment dates, contributions and experiment outcomes are invented. Every record uses `sources: ["demo:fictional"]`. Technical descriptions are scenario content, not shipped software, real performance claims, real institutional affiliations or published research results. No private original records, transcripts, contact details or employer materials are included.

## What is inside

| Records | Count | What they preserve |
| --- | ---: | --- |
| Profile | 3 | Background, priorities, learning and working preferences |
| Domains | 6 | Learning, research, engineering, robotics, music computing and context systems |
| Experience | 3 | Internship, student lab work and peer mentoring |
| Projects | 10 | Implemented exercises, bounded prototypes and work still in progress |
| Research ideas | 8 | Questions, proposed comparisons and advisor help |
| Project ideas | 4 | Problems and first validation steps |
| People | 8 | Fictional mentors, instructors and collaborators |
| Journal | 20 | Decisions, failed attempts, revisions and learning gaps |
| Drafts | 5 | Material awaiting review, with no sending capability |
| **Total** | **67** | Linked context for the next working session |

## Questions for your Codex session

Open the generated `.local/demo/` directory in your local AI assistant after running setup and installing project-scoped skills. The browser provides navigation and search; ask these questions in your AI assistant.

- “Summarize my internship contributions for a portfolio. What still needs my supervisor's review?”
- “Why was Eval Notebook's first result withdrawn, and what is the current evaluation setup?”
- “Which research ideas grow out of limitations I actually encountered?”
- “Prepare a brief for Rhea: current research state, one unresolved question, and the help I need.”
- “Have I mastered backpropagation, or only followed a worked explanation?”
- “What is implemented in Tabletop Sim, and what remains untested outside simulation?”
- “Which future project can I validate with one bounded experiment?”
- “Find the last retrieval failure and explain how it changes the next search experiment.”

Useful answers should cite the current project and relevant historical note, keep ideas separate from active work, and preserve uncertainty. A link alone does not establish authorship, supervision or evidence quality.

The demo also contains ten manually curated typed relation assertions. They cover
fictional mentor and supervisor participation, internship projects, journal topics,
a newer evaluation note that supersedes an earlier protocol, and research ideas
motivated by recorded project problems. Every assertion uses
`sources: ["demo:fictional"]`; `review: "confirmed"` means the fictional scenario
statement was curated, not that a real user's claim was verified. Assertions marked
`evidence: "inference"` remain explicit interpretations. Existing `links` are left
unchanged and stay untyped.

Research and project ideas use the existing `draft` lifecycle, so an explicit idea lookup uses `--include-drafts`. A current overview can remain `active` after the underlying internship has ended; the body records that completion. The parked CourseQuery exercise requires `--include-archived` when specifically retrieving it.

## Run the scenario

From the application source, run `npm run setup`, `bash scripts/install-skills.sh`, and `npm start`. Setup creates `.local/demo/` as an independent local Git repository. The dashboard reads committed records. If the example seed is outdated, preserve the existing folder under a backup name before creating the new one.

For your own academic/work context, create a separate directory using `bash scripts/setup.sh personal /absolute/new/path`. It contains the original blank profile templates, not Alex's identity or experiences.
