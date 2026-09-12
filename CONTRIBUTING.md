# Contributing to MyContext

Clone this repository, then run `npm ci`, `npm run setup`, `npm test`,
`npm run build`, and `npm start`.
The implementation uses Node.js 22.13+, Ruby 2.6+, Git 2.28+, and a POSIX shell
(macOS, Linux, or WSL). The dashboard uses npm frontend dependencies; no Ruby
gems are needed. Setup checks prerequisites; it does not install system packages.

## Work areas

| Area | Files | Contract |
| --- | --- | --- |
| Retrieval | `scripts/search_context.rb`, `skills/` | Explicit context root; privacy-filtered, evidence-grounded results |
| Knowledge model | `meta/schema.md`, `templates/context/` | Portable Markdown/YAML, stable IDs, clear evidence labels |
| Dashboard | `dashboard/` | Read-only projection of the selected context's committed HEAD |
| Onboarding | `scripts/setup.*`, `examples/demo/` | Repeatable synthetic demo and separate blank personal context |
| Cross-session capture | `scripts/context_binding.rb`, `scripts/capture-context.*`, `scripts/install-global-skill.*` | Explicit library binding; external review queue or enabled journal-only local commit |

Use a branch such as `codex/retrieval-ranking` for changes. Keep application
development separate from personal context repositories.

## Checks

`npm test` checks the public file boundary and known secret patterns, validates
the demo and blank scaffold, and runs retrieval, setup, installation, capture, and dashboard
tests with disposable synthetic repositories. It also installs the locked frontend
dependencies, runs component tests, and builds the dashboard in a temporary source
snapshot. Run `npm run build` to create `dashboard/dist/` in your own checkout before
starting the production server. `scripts/check.sh --staged` checks
the actual staged snapshot before publication. No test needs personal files or an
AI account. These checks are regression tests, not a guarantee that arbitrary
prose contains no personal information; manually review every release diff.

Use small behavior-focused tests when changing parsing, privacy, paths, ranking,
or installation. UI copy-only changes do not require new tests. Keep the existing
read-only API and security checks when changing presentation.

Capture tests must use disposable synthetic contexts and external temporary state.
Do not run the capture writer against a contributor's personal library as a smoke
test. Exercise idempotence, interruption recovery, rejected payloads, policy changes,
and preservation of unrelated Git state. Test global installation with temporary
`--config` and `--skills-dir` paths; the test suite must not install real global links.

## Data and contributions

Keep the demo focused on students' academic and professional context: internship
contributions, research questions, project evidence, coursework and collaboration.
Write specific current states and unresolved questions so an assistant can resume
work, rather than filling records with generic tasks or feature-status labels.

Only explicitly fictional examples belong in public fixtures. Use reserved example
domains when a test needs a contact address. Do not contribute your profile, CV,
relationship history, raw conversations, third-party documents, or exports.
Personal context belongs in a separate local/private repository and follows its
own approval policy. Do not attach private notes to public issues or pull requests.

Contributions are under the MIT license in `LICENSE`.
