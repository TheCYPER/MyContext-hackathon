# MyContext software development

This is the public application and skill source repository. Personal context lives
in a separate local Git repository. `examples/demo/` is fictional;
`templates/context/` is an empty scaffold, not information about the user.

- Work on software here under the user's task authorization. Run `npm test` before
  reporting a completed implementation. Do not read personal data to develop or
  test software; use synthetic fixtures.
- Never copy an existing context repository, its `.git` history, session stores,
  credentials, personal exports, or local configuration into this repository.
- Keep generated demo data, local settings, and skill links under ignored `.local/`
  or in an explicitly selected external context directory.
- Install global AI skills only when the user explicitly requests cross-project
  access. `scripts/install-global-skill.sh` binds one selected context and refuses
  conflicts. Preserve an existing installation before an authorized migration.
  `scripts/install-skills.sh` remains available for project-scoped links.
- Resolve personal context explicitly; read that context's `AGENTS.md`, `INDEX.md`,
  and `meta/write-policy.md` before using or updating it. Personal-data edits require
  the owner's reviewed proposal approval, except new journal entries through the
  capture command when that context has explicitly enabled its narrow automatic
  capture policy. Source-code edits do not enable that policy in existing contexts.
- Keep Markdown/YAML as canonical knowledge. The dashboard projects committed Git
  HEAD and remains read-only. A local capture queue outside canonical context is
  allowed. Do not add sending, scheduling, external mailbox access, background
  transcript ingestion, or claims that a draft has been sent.
- A generic graph link means a recorded connection, not a proven semantic relation.
  Keep inference, user confirmation, sources, and uncertainty distinct.
- Read `CONTRIBUTING.md` for setup, tests, and the source/data boundary.
