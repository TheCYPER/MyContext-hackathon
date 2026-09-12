---
id: "project.score-follow"
type: "project"
title: "ScoreLine"
privacy: "private"
updated: "2026-09-12T09:00:00+04:00"
sources: ["demo:fictional"]
aliases: ["score following", "symbolic alignment", "repeated passage", "乐谱跟随"]
tags: ["music-computing", "sequence-alignment", "evaluation", "ambiguity"]
links: ["person.jun-park", "domain.music-computing", "idea.score-ambiguity", "journal.score-baseline", "journal.score-revision"]
status: "active"
---

# Current state

A symbolic score-following prototype that estimates position from incoming note events. A monotonic aligner follows a clean MIDI example, but loses position at repeated passages. The revised evaluation retains repeats rather than removing the ambiguous examples.

# Technical design

The aligner compares a short event history with candidate score positions and advances through a permitted search window. Similar note sequences can occur at several locations. A locally plausible match therefore may not identify the correct occurrence in the piece.

The present input is symbolic note events. This project does not include microphone transcription, live accompaniment generation, or a claim of low-latency performance with a musician. Jun helps reason about the musical ambiguity and inspect where position estimates become misleading.

# Evidence and limits

The July 23 baseline demonstrates that the input and alignment path can work on a clean sequence. The August 6 revision records the failure at repeats. An estimate that is correct before a repeat and wrong after it should not be hidden by a single average score.

There is no frozen listening protocol, performance study, or measured live interaction result. Synthetic timing variations are useful diagnostic inputs, not evidence of natural performance robustness.

# Next action

Annotate both occurrences of a repeated phrase and inspect the candidate positions at the first distinguishing note. Compare a single best-position output with retaining two hypotheses, and report how long uncertainty lasts before claiming the position has recovered.
