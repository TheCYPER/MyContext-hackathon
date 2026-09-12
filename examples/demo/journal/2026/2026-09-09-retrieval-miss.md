---
id: "journal.retrieval-miss"
type: "journal"
title: "Different wording hid the right note"
privacy: "private"
updated: "2026-09-09T12:00:00Z"
sources: ["demo:fictional"]
aliases: ["retrieval miss", "检索漏召回", "vocabulary gap"]
tags: ["research-memory"]
links: ["project.lab-search", "project.eval-notebook", "person.nora-diaz", "journal.retrieval-fixtures", "journal.eval-leakage", "idea.retrieval-evaluation"]
status: "active"
date: "2026-09-09"
---

# Miss

A LabNotes query for data contamination failed to find the relevant note phrased as split leakage. Exact identifiers had worked in the earlier check, so this is a vocabulary gap in the current lexical retrieval behavior, not evidence that the record is absent.

# Next comparison

Try an explicit alias, then compare the change against a frozen judged query set. The single miss is useful for constructing a test; it is not a complete evaluation of aliases, embeddings, or every natural-language query.

# Boundary

Keep the record source visible and preserve the normal scope and privacy filters. Nora can help decide whether the candidate result answers the question. No embedding system or broad retrieval improvement has been implemented on the basis of this note.
