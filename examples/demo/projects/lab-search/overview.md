---
id: "project.lab-search"
type: "project"
title: "LabNotes"
privacy: "private"
updated: "2026-09-12T09:00:00+04:00"
sources: ["demo:fictional"]
aliases: ["research note retrieval", "lexical search", "data contamination", "实验笔记检索", "检索", "词法检索"]
tags: ["context-systems", "retrieval", "evaluation", "lexical-search"]
links: ["person.nora-diaz", "domain.context-systems", "idea.retrieval-evaluation", "journal.retrieval-fixtures", "journal.retrieval-miss"]
status: "active"
---

# Current state

Lexical retrieval over research notes using stable IDs, titles, aliases, tags, and bounded snippets. Exact identifiers find known records. A query using data contamination missed a note phrased as split leakage, so the current problem is retrieval coverage rather than evidence that a larger search architecture is necessary.

# Technical design

The retrieval path ranks exact identity and title matches before general body mentions. It returns a small set of source records that can be opened for their evidence. Related names can be recorded as aliases, but an alias must describe the same topic rather than manufacture a relationship between unrelated notes.

Restricted and source-export material stays outside default retrieval. An answer should distinguish what a returned note states from what the assistant infers across several notes. A plausible answer generated from memory is not a successful retrieval result.

# Evidence and limits

The August 31 fixtures cover known-note lookups. The September 9 miss exposed vocabulary mismatch. Those observations do not estimate usefulness across real research questions, and adding the exact missed phrase to one record would not by itself establish a general improvement.

No embedding index, vector database, or automatic transcript ingestion has been built. The next decision should depend on a judged query set, not on the current tool's name.

# Next action

With Nora, freeze queries before changing aliases: exact note lookup, paraphrased concept, multi-record question, and a question with no answer. Record relevant IDs and acceptable abstention. Compare the existing ranker with a small alias revision on held-out wording.
