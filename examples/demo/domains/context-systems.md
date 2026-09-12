---
id: "domain.context-systems"
type: "domain"
title: "Finding the right research note"
privacy: "private"
updated: "2026-09-12T12:00:00Z"
sources: ["demo:fictional"]
aliases: ["上下文", "research-note retrieval"]
tags: ["retrieval", "research-notes", "context"]
links: ["project.lab-search", "person.nora-diaz", "idea.retrieval-evaluation", "journal.retrieval-fixtures", "journal.retrieval-miss"]
status: "active"
---

# Why this matters

Alex wants to resume work without asking Codex to reread an entire folder. A useful lookup brings back the note about the actual assumption or failure, with a path he can inspect. LabNotes explores this problem over a small Markdown research collection.

# Current evidence

Exact identifiers retrieve known records. A natural phrase can still miss a relevant note: a query for data contamination did not match the note phrased as split leakage. That is a concrete vocabulary failure, not proof that every query needs a semantic search system.

# Evaluation before expansion

Build a frozen set of realistic questions, relevant records, and no-answer cases. Compare a small alias change against the same judged set. Keep scope and privacy filtering intact. Embeddings, a database, and automatic transcript collection are not part of the current prototype.

Skills are how Alex asks Codex to consult the context. The material being organized is his research, learning, and engineering history rather than a catalog of Skills.
