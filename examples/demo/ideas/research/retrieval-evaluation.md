---
id: "idea.retrieval-evaluation"
type: "idea"
title: "Evaluating research-note retrieval"
privacy: "private"
updated: "2026-09-12T09:00:00+04:00"
sources: ["demo:fictional"]
aliases: ["retrieval benchmark", "query relevance", "笔记检索评估", "研究想法", "检索评估"]
tags: ["research-idea", "retrieval", "evaluation"]
links: ["project.lab-search", "domain.context-systems", "person.nora-diaz", "person.rhea-sen"]
status: "draft"
idea_kind: "research"
---

# Project Title

When does lexical retrieval stop serving a small research notebook?

# Project Description

Build a bounded query set before adding a new retrieval method. Include exact identity lookup, paraphrased terminology, a question requiring two notes, and a question whose answer is not present. Label relevant records and acceptable abstention separately from the final answer's wording.

Compare the existing LabNotes ranker with a small alias change. Hold out paraphrases so the test is not simply a list of phrases inserted into the notes. Report missed relevant records, irrelevant records opened, and failures to abstain; a single aggregate score could hide the failure mode that matters.

Only after that comparison should an embedding-based candidate be considered. The current synonym miss does not establish that embeddings are necessary, and a better top result on one example would not settle the question.

# What kind of help do you need from an advisor?

Nora can help judge relevance without seeing the method's ranking. Rhea can review how to separate known-item lookup from synthesis questions and whether the held-out queries are independent enough to support the proposed conclusion.
