# MyContext schema

## Knowledge frontmatter

Every Markdown file under `profile/`, `experience/`, `projects/`, `ideas/`, `people/`, `domains/`, `journal/`, and `sources/` starts with:

```yaml
---
id: project.atlas
type: project
title: Atlas
privacy: private
updated: 2026-08-19T18:00:00+08:00
sources:
  - "user:2026-08-19"
aliases: []
tags: []
links: []
status: active
---
```

Required fields: `id`, `type`, `title`, `privacy`, `updated`, `sources`.

- `type`: `profile | domain | experience | person | project | idea | journal | draft | session_export`
- `privacy`: `public | private | restricted`
- `status`: `active | archived | draft`
- `date`: optional event date in `YYYY-MM-DD` format; use it for journal files.
- `aliases`, `tags`, `links`: optional YAML lists.

IDs are globally unique and stay stable when a file moves. `updated` is the content update time; historical event time belongs in `date` and the body.

## Idea convention

- `ideas/research/<slug>.md` and `ideas/projects/<slug>.md` use `type: idea`.
- Every idea adds `idea_kind: research | project` matching its directory and remains `status: draft` until selected or `status: archived` when parked, superseded, or converted into a project.
- An idea records a possibility, not an implementation claim. When work starts, create a separate `project.*` record, link both records, and archive the idea rather than moving it into `projects/`.
- Research ideas contain the exact headings `Project Title`, `Project Description`, and `What kind of help do you need from an advisor?` to keep the question, proposed work, and requested guidance separate.
- Project ideas contain `Problem`, `Product direction`, `First validation`, and `Current boundary`. Market demand and expected impact remain inference until tested.

## Work experience convention

- `experience/<slug>/overview.md` uses `type: experience` and records the current state of one real employment, internship, contract, or sustained professional engagement.
- `experience/<slug>/drafts/*.md` uses `type: draft`, `status: draft`, and stores unsigned certificates, role summaries, or other documents awaiting human review.
- Experience records own employer, role, official dates, disclosure boundaries, and the relationship between the engagement and its artifacts. Technical implementation details remain in linked `project` records.
- Completion, certificate issuance, manager feedback, and later verification are events and belong in `journal/`; the experience overview links to their current outcome without duplicating the event log.
- Artifact coverage dates are not employment dates. Keep an unknown field unknown until an official document or the owner confirms it.

## Evidence vocabulary

Use evidence labels next to externally reusable claims when provenance could be ambiguous:

- `[artifact]`: directly inspectable repository, demo, paper, or measured output.
- `[first_party]`: public claim on the owner's site, CV, or profile.
- `[user_confirmed]`: the owner explicitly confirmed it in a private interaction.
- `[external_primary]`: official page or original paper about another person or organization.
- `[external_secondary]`: reputable reporting or index that is not the original source.
- `[inference]`: a reasoned connection, not a fact.

An inference never silently becomes canonical fact. Quantitative claims need a source and an `as of` date.

## Privacy

- `public`: may be reused in public material after checking its source.
- `private`: normal personal context in the private repository.
- `restricted`: committed in plaintext by explicit user choice, but excluded from default retrieval and re-confirmed before external use.

No privacy value permits secrets, authentication data, government identifiers, full financial/account data, or third-party confidential material.

## Source locators

Prefer stable locators:

```text
user:YYYY-MM-DD
session:codex:<thread-id>
session:claude:<thread-id>
repo:<name>@<commit>:<path>
web:<url>
context:<stable-id>
artifact:sha256:<digest>
```

Use `artifact:sha256:<digest>` for a user-supplied document retained outside the repository. Store only its safe extracted facts and fingerprint; do not copy signatures, seals, verification codes, identity documents, or other sensitive document imagery into MyContext.

Curated session exports are `type: session_export`, default to `restricted`, and are append-only except for an approved privacy deletion.
