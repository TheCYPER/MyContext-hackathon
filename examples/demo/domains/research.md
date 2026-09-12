---
id: "domain.research"
type: "domain"
title: "Research methods and evaluation"
privacy: "private"
updated: "2026-09-12T12:00:00Z"
sources: ["demo:fictional"]
aliases: ["研究", "evaluation", "实验方法"]
tags: ["research", "evaluation"]
links: ["project.eval-notebook", "project.paper-trail", "person.rhea-sen", "person.nora-diaz", "idea.evidence-calibration", "idea.question-drift"]
status: "active"
---

# Working question

Alex is investigating what can go wrong when related samples appear on both sides of an evaluation split. The current focus is source-sequence leakage in a small visual-computing experiment. He is not claiming to have defined a new evaluation method.

# Evidence to preserve

Keep the rejected clip-random result, the reason it was withdrawn, the grouping rule, and the replacement run separate. The current grouped-split manifest is complete and one seed has run. Multiple seeds and protocol review still matter before interpreting a comparison.

PaperTrail supplies reading notes with claim, source location, and applicability to the current question. Its shortlist is exploratory and may miss relevant work. Eval Notebook supplies the implementation and run history; a paper note is not evidence that its method was reproduced.

# Conversation with Rhea

Bring one concrete leakage example and the grouping rule. Ask which comparison is worth completing before widening the project. Nora is the first reader for whether the manifest and report can be followed without reconstructing Alex's memory.
