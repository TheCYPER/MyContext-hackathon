---
id: "idea.evidence-calibration"
type: "idea"
title: "Calibrating claims from experiment reports"
privacy: "private"
updated: "2026-09-12T09:00:00+04:00"
sources: ["demo:fictional"]
aliases: ["evidence calibration", "claim strength", "结论与证据", "研究想法", "实验记录", "证据校准"]
tags: ["research-idea", "reproducibility", "evaluation"]
links: ["project.eval-notebook", "domain.research", "person.rhea-sen", "person.nora-diaz"]
status: "draft"
idea_kind: "research"
---

# Project Title

Can structured experiment evidence reduce overstated conclusions?

# Project Description

Compare summaries written from a result table alone with summaries written from a report that also exposes the split unit, run status, seed count, and unresolved failures. The target is whether the summary correctly limits its claim, not whether it sounds more cautious.

Use a small frozen set of invented experiment reports with known defects: sequence overlap, missing outputs, a single-seed comparison, and a run that failed before evaluation. Define allowed and unsupported conclusions before inspecting the summaries. Separate detection of a defect from the quality of the resulting explanation.

The Eval Notebook leakage episode motivates the question, but one corrected report cannot establish an effect. There is no completed user study or validated scoring rubric. A rule-based report check should be included as a simple baseline before assuming an AI judge is necessary.

# What kind of help do you need from an advisor?

Ask Rhea to narrow what counts as an overstated claim and review whether the comparison isolates the report format. Ask Nora to independently label a few cases; disagreements would expose an unclear rubric before a larger experiment.
