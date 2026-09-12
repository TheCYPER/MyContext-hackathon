---
id: "journal.eval-leakage"
type: "journal"
title: "One source sequence crossed the split"
privacy: "private"
updated: "2026-08-24T12:00:00Z"
sources: ["demo:fictional"]
aliases: ["数据泄漏", "split leakage", "source-sequence leakage"]
tags: ["research-memory"]
links: ["project.eval-notebook", "person.rhea-sen", "person.nora-diaz", "journal.eval-split", "journal.eval-rerun", "idea.evidence-calibration"]
status: "active"
date: "2026-08-24"
---

# Finding

The split review found material from the same source sequence in both training and test partitions. The clip-random split did not enforce the separation the comparison needed. A completed run on that split cannot support the interpretation I had wanted to give it.

# Decision

I withdrew the original result rather than relabeling it as a clean baseline. The replacement protocol will group by source sequence, and the manifest must show the grouping rule and exclusions so Nora and Rhea can inspect the decision.

# Follow-through

Keep the rejected run and this explanation linked to the new work. The correction is a change in what evidence is usable, not an improvement score. A grouped split and rerun are still needed before looking for a comparative result.
