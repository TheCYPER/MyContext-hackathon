---
id: "domain.music-computing"
type: "domain"
title: "Symbolic music alignment"
privacy: "private"
updated: "2026-09-12T12:00:00Z"
sources: ["demo:fictional"]
aliases: ["音乐计算", "MIDI", "score following"]
tags: ["music-computing", "alignment"]
links: ["project.score-follow", "person.jun-park", "idea.score-ambiguity", "journal.score-baseline", "journal.score-revision"]
status: "active"
---

# Current experiment

ScoreLine is a symbolic score-following prototype. Alex and Jun are exploring how a monotonic aligner relates incoming MIDI events to a score position. The current baseline follows clean MIDI examples but loses its place when the score repeats material.

# Scope of the evidence

The repeated passage is a useful failure case, not an inconvenient sample to remove. Following a clean input does not establish live performance robustness. The current work does not transcribe audio, generate accompaniment, or evaluate the quality of a musical performance.

# Next question

Make the ambiguous repeated passage explicit and inspect the alternatives available to the aligner. An evaluation should retain those passages and distinguish temporary uncertainty from a confident wrong position. Jun can help interpret the musical structure before Alex adds a more complicated model.
