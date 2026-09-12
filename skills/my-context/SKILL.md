---
name: my-context
description: Retrieve and maintain a user's curated personal context when an answer, decision, plan, or draft depends on their identity, preferences, goals, experience, projects, relationships, or recent events. Also use when the user asks to remember, correct, update, or forget personal context. Skip ordinary coding and general knowledge questions that do not need personal context.
---

# My Context

Use curated memory as evidence with provenance and uncertainty. The public application repository contains software and fictional examples; it is not the user's personal memory.

## Locate and retrieve

Read [references/retrieval.md](references/retrieval.md). Resolve the context from `MY_CONTEXT_ROOT`, then the compatibility alias `MYCONTEXT_ROOT`, then the nearest canonical context above the working directory, otherwise the application's `.local/demo`. An explicitly configured but invalid path is an error; never fall back to another person's or the fictional context. Never search the home directory for memory.

Read the selected context's `AGENTS.md`, `INDEX.md`, and `profile/summary.md`. In the first pass, open at most five canonical documents including the summary. Use the application's ranked search with `--root` and the narrowest scope. The optional `$mycontext-librarian` skill provides evidence-led candidate selection for difficult lookups.

Exclude restricted files, sources, drafts, and archived records by default. A draft idea therefore needs `--include-drafts`. Explicitly enable an excluded category only when the user's task calls for that category and the context's policy permits it. Restricted retrieval is not authorization for external disclosure.

## Use and maintain context

Use only task-relevant facts. Separate source-backed facts, user confirmation, and inference; resolve conflicts with the user instead of silently choosing a claim. Prefer current state to superseded state, while retaining historical events when the question asks about them.

Before preparing or applying a durable update, read the selected context's `meta/schema.md` and `meta/write-policy.md`. Prepare proposals outside that context and follow its exact approval, hash, validation, commit, and synchronization contract. A request to change application code does not grant permission to edit personal memory. Never store credentials, complete account records, government identifiers, or third-party confidential information.

When useful new durable information emerges, offer at most one consolidated update at task end. If the user directly asks to remember or correct something, prepare that proposal without an extra save question; the context's write policy still applies.
