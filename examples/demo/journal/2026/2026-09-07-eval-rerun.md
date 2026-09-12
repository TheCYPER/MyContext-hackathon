---
id: "journal.eval-rerun"
type: "journal"
title: "The grouped split has one completed seed"
privacy: "private"
updated: "2026-09-07T12:00:00Z"
sources: ["demo:fictional"]
aliases: ["grouped split rerun", "分组重跑", "single seed"]
tags: ["research-memory"]
links: ["project.eval-notebook", "person.rhea-sen", "person.nora-diaz", "journal.eval-leakage", "draft.lab-review"]
relations:
  - id: "relation.eval-rerun-supersedes-eval-split"
    predicate: "supersedes"
    target: "journal.eval-split"
    evidence: "artifact"
    sources: ["demo:fictional"]
    review: "confirmed"
    privacy: "private"
    valid_from: "2026-09-07"
    note: "For the synthetic scenario's current protocol, this grouped-split rerun replaces the earlier clip-random setup; the older fictional note remains historical context."
status: "active"
date: "2026-09-07"
---

# Current result

The replacement source-group split has a complete manifest, and one seed has run. I can now point to the grouping, exclusions, and saved configuration rather than relying on memory of how the dataset was divided.

# Interpretation

This repairs the protocol used for the earlier result; it does not establish an improvement. A single seed is not enough for the comparison I want to make, and the grouped-split procedure still needs review. The clip-random result remains withdrawn.

# Next discussion

Ask Rhea which remaining check should come first and ask Nora whether she can follow the manifest without extra explanation. Repeated runs should use the frozen protocol once those questions are settled. No additional seeds or stronger performance claim are recorded yet.
