---
id: "journal.score-baseline"
type: "journal"
title: "A position trace for clean MIDI"
privacy: "private"
updated: "2026-07-23T12:00:00Z"
sources: ["demo:fictional"]
aliases: ["MIDI", "score following", "乐谱跟踪"]
tags: ["research-memory"]
links: ["project.score-follow", "person.jun-park", "domain.music-computing", "journal.score-revision"]
status: "active"
date: "2026-07-23"
---

# Baseline

The ScoreLine monotonic aligner follows the clean MIDI example and produces a score-position trace I can inspect. Jun and I can now discuss what the aligner assumes instead of reasoning only from an architecture sketch.

# Limit of this check

Clean input is a convenient starting point. It does not show how the system handles ambiguity, repetitions, timing variation, or recovery after a wrong match. There is no live-performance or audio-transcription result here.

# Next example

Retain a passage with repeated musical material and watch which position the aligner chooses. If it loses the location, that should become part of the evaluation set rather than a reason to choose an easier score.
