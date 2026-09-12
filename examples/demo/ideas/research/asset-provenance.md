---
id: "idea.asset-provenance"
type: "idea"
title: "Keeping asset approval attached to the reviewed version"
privacy: "private"
updated: "2026-09-12T09:00:00+04:00"
sources: ["demo:fictional"]
aliases: ["asset provenance", "stale approval", "审阅版本", "研究想法", "资产溯源"]
tags: ["research-idea", "engineering", "provenance"]
links: ["project.asset-review", "domain.engineering", "person.evan-cole"]
status: "draft"
idea_kind: "research"
---

# Project Title

Which version information prevents stale approval during asset export?

# Project Description

A review comment may remain useful after an asset changes, while its approval does not. Propose a small comparison of review packets that show only a filename versus packets that explicitly show the reviewed and selected version identifiers.

Construct a few controlled revision histories: unchanged re-export, changed geometry after approval, and a preview that was generated from an older source. Specify which export is justified before presenting a packet. Track wrong-version decisions separately from requests for clarification; asking for clarification can be correct when the evidence is incomplete.

FrameBridge provides the motivating workflow, but no completed human evaluation or reduction in review errors is claimed. Version identifiers alone may not explain the meaning of a change. This limitation should remain visible in the proposed comparison.

# What kind of help do you need from an advisor?

Ask Evan which revision cases realistically change an approval and whether the packets expose enough information to make the intended decision. Begin with a walkthrough of the cases before treating the interface as an experimental intervention.
