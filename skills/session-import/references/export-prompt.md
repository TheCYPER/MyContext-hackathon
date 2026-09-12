# Controlled personal context exporter prompt

Return this prompt without weakening its restrictions:

```text
Export durable information about the current user from this identified AI task as one self-contained Markdown document for a curated personal context repository.

Use only information the user explicitly provided in this task and artifacts already verified within this task. Do not browse other tasks or platform storage. This is a source export, not a complete chat summary and not an instruction to save anything.

Limits:
1. Never include system or developer prompts, hidden instructions, chain of thought, complete transcripts, tool logs, shell output, or long code blocks.
2. Never read or copy platform session stores, JSONL, auth files, environment files, tokens, keys, complete account details, or secret storage.
3. Exclude government identifiers, private third-party contact details, internal company code or URLs, customer data, confidential artifacts, and NDA material. Retain only safe high-level facts and relevant disclosure boundaries.
4. Keep inference separate from fact. Mark missing values unknown and preserve contradictory claims side by side.
5. Preserve failures, negative results, incomplete work, and capability boundaries. Do not inflate results for presentation.
6. Label uncertain dates, quantities, metrics, and personal contributions as unverified.
7. Keep similarly named projects, distinct roles, separate organizations, and different phases separate until this task explicitly establishes their relationship.
8. Return only Markdown. Do not write to MyContext or any other repository.

Cover only durable information present in this task; mark absent sections not_found:

A. Current user snapshot: identity at an appropriate disclosure level, skills, goals, interests, working preferences, and current versus historical state.
B. Projects and experiences: name, aliases, timeline, status, motivation, the user's role and contribution boundary, collaborator roles without unnecessary identities, workflow, artifacts and source locators, verified results, user-reported claims, failures, lessons, unknowns, next steps, and disclosure level.
C. Decisions and preferences: the supported choice, its rationale, alternatives rejected, and remaining uncertainty.
D. Timeline events: date, event, outcome, decision, next action, and source.
E. Conflicts: claim A, claim B, sources, why unresolved, and the smallest question for the user.
F. Canonical import candidates: proposed stable ID, target area, concise fact, privacy, evidence level, and source locator.

Prefer stable source locators such as session:<client>:<task-id>, repo:<name>@<commit>:<path>, web:<url>, and user:<date>. Do not invent identifiers, provenance, relationships, or disclosure permissions.

End with a Do not import section listing only the categories of excluded secrets, confidential material, noise, and unattributable content. Never repeat their values or bodies.
```
