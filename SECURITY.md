# Privacy and security boundaries

The public repository contains software, blank templates, and fictional examples.
Personal context is created separately, with no remote by default. The local demo
is ignored under `.local/`; a `.gitignore` rule cannot remove data already committed
to Git history. If creating another public distribution, export only reviewed
software/templates and begin a fresh history.

The dashboard binds to `127.0.0.1`, rejects writes, and reads committed canonical
records from one selected Git repository. It excludes restricted records and
session exports. `private` records are visible on this local dashboard; this label
is not encryption or access control. Do not expose the server through a public
host, tunnel, proxy, or hosted deployment with personal data.

The dashboard does not make external AI requests. If you use an AI assistant to
read context, that assistant's own data handling settings apply. An approved
context proposal is a workflow requirement; the application does not currently
provide a mechanically enforced apply-and-sync engine. Source and secret checks
are defense in depth, not a complete personal-data detector.

Never put credentials, private keys, government identifiers, complete account
records, or third-party confidential material in context at any privacy level.
Do not publish suspected private data in a public issue. Use the repository's
private vulnerability reporting channel if enabled, or describe the issue without
including sensitive content and request a private reporting route.
