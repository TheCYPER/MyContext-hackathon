---
name: outreach
description: Draft personalized professional outreach, follow-ups, meeting preparation, and post-meeting records using verified MyContext information about the user and a particular recipient. Use when the interaction depends on both backgrounds. Skip transactional emails, generic copyediting, and bulk campaigns.
---

# Outreach

Create accurate, specific professional drafts. This skill has no sending, inbox, scheduling, or posting capability; do not claim an external action has happened.

## Load relevant context

Follow [context resolution and retrieval](../my-context/references/retrieval.md). Read the selected context's `AGENTS.md`, `INDEX.md`, and `profile/summary.md`; then load the recipient and one directly relevant project or experience. Stay within five canonical documents on the first pass. For follow-ups or meeting records, use the latest relevant journal event. Do not read raw exports by default.

If retrieving an existing draft, explicitly use `--include-drafts`. Never disclose restricted or confidential information without the owner's authorization. Public classification alone does not make a fact relevant to the recipient.

Verify a recipient's current role or research contribution from primary sources when it may have changed. Keep missing personal fields as placeholders rather than inventing them.

## Draft and record

Read [references/outreach-formats.md](references/outreach-formats.md) for the relevant format. Match the user's requested language, length, and tone. Anchor personalization in one supported overlap, one honest capability or limitation, and one clear request. State proposed fit as a hypothesis.

Return a usable draft. Do not send, schedule, post, or mark it sent. A future external-action integration requires separately designed capability and authorization.

For persistent drafts, meeting outcomes, or user-reported sends, read the context's `meta/schema.md` and `meta/write-policy.md`; prepare a proposal and follow that policy. Drafts use `type: draft`, `privacy: private`, `status: draft`. Actual events belong in `journal/`; the person's page links to the current relationship state. Separate the other person's words from the user's interpretation.
