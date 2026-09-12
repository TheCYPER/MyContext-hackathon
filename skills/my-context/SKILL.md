---
name: my-context
description: Retrieve and capture a user's academic and professional context across working sessions. Use when a task depends on their studies, internships, projects, research ideas, collaborators, decisions, or recent results; when they ask to remember, update, correct, or forget something; or when ongoing work produces a durable decision, verified result, or next step worth retaining. Skip routine coding details and general questions with no lasting personal context.
---

# My Context

Help the user's AI pick up academic and professional work with accurate context. Markdown records are evidence, with sources and uncertainty. The application repository and fictional demo are not facts about the user.

## Resolve the selected library

Resolve this skill's symlink to find `APP_ROOT`, the parent of `skills/`. Use `ruby "$APP_ROOT/scripts/context_binding.rb"` to resolve the library. Explicit `MY_CONTEXT_ROOT`, the compatibility alias `MYCONTEXT_ROOT`, or the installed global binding selects it. Pass the returned `context_root` explicitly to every search/capture command and preserve the returned `state_dir` for capture. Never fall back to the current project or fictional demo. If unconfigured or invalid, report the configuration issue; do not discover personal folders or create a library on a lookup.

Read the selected library's `AGENTS.md` and access policy. When personal context is relevant, read `INDEX.md` and `profile/summary.md`, opening at most five canonical documents in the first pass. Use the smallest relevant scope and the application's ranked search. See [retrieval.md](references/retrieval.md) for commands and evidence handling; consult [Librarian guidance](../mycontext-librarian/SKILL.md) only for a difficult lookup.

## Retrieve with evidence

Use only task-relevant facts. Exclude restricted files, sources, drafts, and archived records unless the request specifically needs that category and its policy allows it. A draft idea needs `--include-drafts`. Follow explicit record links; a generic link is not proof of a semantic relationship. Distinguish confirmed facts, artifacts, and inference. Show conflicts instead of silently choosing a claim. Pending captures are proposals, not canonical facts.

## Capture useful outcomes

When the user asks to remember something, or this skill is active and work produces lasting academic/professional context, follow [capture.md](references/capture.md). Consolidate the smallest useful set once near task completion: a project decision and its reason, a checked experiment result and limitation, an internship contribution, a research question, or a concrete next step. Use only information already visible in this task and selected artifacts actually checked. Do not capture routine commands, speculative achievements, or whole conversations.

Read the selected library's `meta/write-policy.md` and `meta/schema.md`, then submit the selected facts through `scripts/capture-context.sh` with a stable event ID and honest evidence labels. The command either queues a private candidate outside canonical context or, when the library has explicitly enabled automatic capture, appends one new private journal entry and commits it locally. Never enable the policy yourself. Check and report the receipt: **queued for review** or **committed locally**. Never say “saved to MyContext” for a failed or queued capture, and never claim automatic remote synchronization.

Existing records, corrections, conflicting claims, deletion, and policy changes still need the library's exact diff/proposal/hash approval workflow. Prepare those proposals outside the context. Do not turn automatic capture into a shortcut for updating a profile or current project state. If no approved capture exception exists, respect review mode; do not bypass it with direct file edits. Never store credentials, identifiers, full account details, or third-party confidential material.

The skill acts when invoked, explicitly or by the assistant. It does not monitor other sessions, guarantee execution at every session end, or grant filesystem permissions. Never enumerate tasks or read transcript stores, auth files, hidden prompts, JSONL/SQLite session logs, or unrelated folders to collect context.
