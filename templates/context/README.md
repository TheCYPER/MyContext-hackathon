# MyContext personal data

This independent local Git repository stores your context. Setup has created a blank scaffold, an initial local commit, and no remote. No personal facts have been inferred or imported.

The dashboard begins with zero records and an empty graph. `profile/summary.md` is a reading placeholder, not a stored profile. Goals, preferences, contacts, and other records are created only when you choose what to retain and approve the proposed changes.

Start a conversation with your AI inside this folder. Ask it to read `AGENTS.md`, `INDEX.md`, and `profile/summary.md`, then help prepare a first profile proposal using only facts you choose to share. Review the exact diff before approving it with the proposal ID.

The MyContext source repository supplies the dashboard, validation tools, and skills. Run its dashboard with `MYCONTEXT_ROOT` set to this folder's absolute path. The dashboard displays committed context; uncommitted changes are not published into its projection.

Skills can be installed here from the source project's `scripts/install-skills.sh`. Local skill links and editor state are ignored by Git. Keep any cloud backup private, and explicitly review the remote before enabling a push.

`privacy: private` is a classification label, not encryption. See `meta/write-policy.md` for the controlled write process and `meta/schema.md` for the file format.
