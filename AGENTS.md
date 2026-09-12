# MyContext software development

This is the public application and skill source repository. Personal context lives
in a separate local Git repository. `examples/demo/` separates fictional personal-life records from attributed public references;
`templates/context/` is an empty scaffold, not information about the user.

- Work on software here under the user's task authorization. Run `npm test` before
  reporting a completed implementation. Do not read personal data to develop or
  test software; use synthetic fixtures or reviewed, attributed public references.
- Never copy an existing context repository, its `.git` history, session stores,
  credentials, personal exports, or local configuration into this repository.
- Keep generated demo data, local settings, and skill links under ignored `.local/`
  or in an explicitly selected external context directory.
- Do not install or replace global AI skills. `scripts/install-skills.sh` installs
  project-scoped links in the selected context directory and refuses conflicts.
- Resolve personal context explicitly; read that context's `AGENTS.md`, `INDEX.md`,
  and `meta/write-policy.md` before using or updating it. Personal-data edits require
  the owner's reviewed proposal approval. Source-code edits do not grant permission
  to change personal data.
- Keep Markdown/YAML as canonical knowledge. The dashboard projects committed Git
  HEAD and remains read-only. Do not add sending, scheduling, inbox access, background
  transcript ingestion, or claims that a draft has been sent.
- A generic graph link means a recorded connection, not a proven semantic relation.
  Keep inference, user confirmation, sources, and uncertainty distinct.
- Read `CONTRIBUTING.md` for setup, tests, and the source/data boundary.
