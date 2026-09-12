# Context write policy

This policy governs personal context records. It does not require proposal approval for ordinary software development in the MyContext source repository. Creating the blank or fictional scaffold through an explicitly requested setup command is authorized setup; recording personal facts afterward follows this policy.

## Before writing

1. Read `INDEX.md` and `profile/summary.md` when personal context is relevant. Open at most five canonical files in the first retrieval pass.
2. Exclude `restricted` material and `sources/session-exports/` unless the owner explicitly requests the specific material.
3. Never scan complete conversation stores, authentication files, hidden prompts, or unrelated personal folders. Never record credentials, government identifiers, full account details, or third-party confidential material.
4. Distinguish artifacts, public self-reports, owner-confirmed facts, external sources, and inference. Keep unknowns unknown. Show conflicting claims to the owner instead of choosing one silently.
5. Put events in `journal/`. Keep current state and links on the related project, person, or experience page.
6. Present an exact proposed diff, affected privacy levels, source evidence, a unique proposal ID, and the patch SHA-256. Record the current repository revision and working-tree state used to prepare it. Keep the patch outside the canonical repository until approved.

## Approval and application

The owner must explicitly approve the concrete proposal with either:

```text
Apply and sync <proposal_id>
应用并同步 <proposal_id>
```

Approval covers only that exact patch and repository state. If either changes, regenerate the proposal and request fresh approval. Before applying, recheck the base revision, working-tree state, patch hash, and any configured remote state. Stop if there are overlapping local changes or a non-fast-forward remote state.

Apply only the approved patch. Validate the context schema and scan the staged diff for secrets and unintended personal disclosures. Stop on validation or secret-scan failure. Commit the approved, verified patch. Never stage unrelated changes.

Setup creates a local Git repository with no remote. Report changes as **committed locally** when no private remote is configured; do not claim they were pushed or synchronized to a server. Push only when the owner has explicitly configured and authorized a private remote for this context repository. Verify that remote visibility is private before pushing personal context. Do not add a remote or make a repository public as part of an ordinary context update.

## External actions

Outreach remains draft-only. Do not send messages, schedule meetings, or contact people through MyContext. A draft is not a sent message. Do not infer permission for an external action from permission to save a context record.

The `privacy` field is a retrieval and review label, not encryption or access control. Personal context belongs in a separate private repository. The source project's `.gitignore` provides an extra guard; it cannot remove data from Git history or prevent an explicit forced add.
