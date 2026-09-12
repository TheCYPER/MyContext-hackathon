---
id: "idea.score-ambiguity"
type: "idea"
title: "Preserving uncertainty at repeated score passages"
privacy: "private"
updated: "2026-09-12T09:00:00+04:00"
sources: ["demo:fictional"]
aliases: ["score ambiguity", "multiple hypotheses", "重复乐句", "研究想法", "乐谱歧义"]
tags: ["research-idea", "music-computing", "sequence-alignment"]
links: ["project.score-follow", "domain.music-computing", "person.jun-park"]
status: "draft"
idea_kind: "research"
---

# Project Title

Does retaining two score positions help at repeated passages?

# Project Description

A single best-position output can appear confident while choosing the wrong occurrence of a repeated phrase. Compare ScoreLine's existing monotonic estimate with a bounded two-hypothesis tracker on a frozen set of symbolic passages.

Annotate when the occurrences first become distinguishable from the incoming notes. Measure whether the correct position remains among the candidates and how long ambiguity persists. Keeping both candidates forever is not a useful solution, so report delayed commitment as well as incorrect commitment.

Start with clean MIDI and controlled timing variation. Do not call this a live performance result or infer listening quality from alignment accuracy. Repeated passages must stay in the evaluation because they are the question, not noise to remove.

# What kind of help do you need from an advisor?

Ask Jun to check the score annotations and whether the first distinguishing event is musically meaningful. Guidance is needed on a tolerable commitment delay and on which symbolic disturbances should be introduced before involving a performer.
