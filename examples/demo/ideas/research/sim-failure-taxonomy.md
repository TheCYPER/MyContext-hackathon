---
id: "idea.sim-failure-taxonomy"
type: "idea"
title: "Separating simulator defects from policy failures"
privacy: "private"
updated: "2026-09-12T09:00:00+04:00"
sources: ["demo:fictional"]
aliases: ["simulation failure taxonomy", "reset validity", "失败分类", "研究想法", "仿真失败"]
tags: ["research-idea", "robotics", "simulation"]
links: ["project.tabletop-sim", "domain.robotics", "person.omar-patel"]
relations:
  - id: "relation.sim-failure-taxonomy-motivated-by-reset-note"
    predicate: "motivated_by"
    target: "journal.sim-reset"
    evidence: "inference"
    sources: ["demo:fictional"]
    review: "confirmed"
    privacy: "private"
    note: "Curated inference from this synthetic idea's stated dependence on the fictional reset-velocity finding."
status: "draft"
idea_kind: "research"
---

# Project Title

Which apparent manipulation failures originate in the episode harness?

# Project Description

Tabletop Sim's reset-velocity issue makes it unclear whether an unsuccessful episode reflects the action sequence or a changed initial state. Propose a small failure taxonomy that separates reset validity, observation validity, action execution, and task outcome.

First compare repeated scripted episodes from a fully specified initial state. Change the preceding episode while keeping the intended reset state fixed. Classify the first divergence before judging task success. A reset failure should invalidate the episode for policy comparison rather than become another policy failure in an aggregate success rate.

This is a diagnostic study in a single simple scene. It does not yet evaluate a learned policy, multiple objects, or physical robot transfer. The taxonomy may need revision when failures overlap; do not claim exhaustive coverage from the first examples.

# What kind of help do you need from an advisor?

Ask Omar to review the state variables that must reset and the tolerance for declaring two initial states equivalent. The first useful decision is whether the diagnostic can isolate a harness defect without relying on the downstream task outcome.
