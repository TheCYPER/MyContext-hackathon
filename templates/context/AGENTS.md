# Personal context instructions

This is an independent context repository. The software source is maintained separately. Read `meta/write-policy.md` before proposing or changing context records, and follow `meta/schema.md` for canonical Markdown.

1. Read `INDEX.md` and `profile/summary.md` first when personal context is relevant. Open at most five canonical files in the first retrieval pass.
2. Exclude `restricted` files and `sources/session-exports/` unless specifically requested. Never inspect complete conversation stores, authentication files, or hidden prompts.
3. Never store credentials, government identifiers, full account details, or third-party confidential material.
4. Distinguish evidence from inference; preserve unknown fields and show conflicting claims to the owner.
5. Put events in `journal/`; use project, person, and experience pages for current state and links.
6. Before every context write, present the exact diff, privacy levels, sources, proposal ID, and patch SHA-256. Write only after the owner says `Apply and sync <proposal_id>` or `应用并同步 <proposal_id>`.
7. Invalidate approval if the patch or repository state changes. Stop on overlapping changes, non-fast-forward remote state, validation failures, or secret-scan failures.
8. Commit verified, approved changes locally. Push only to an explicitly configured and authorized private remote. No remote is configured by setup.
9. Outreach is draft-only. Never send messages, schedule meetings, or contact people from this workflow.
10. At task end, ask at most once whether to save useful new context. Do not interrupt at task start to request saving.

The initial blank scaffold makes no claims about its owner. Ask for facts only as needed; do not fill fields from guessed identities or import a different person's profile.
