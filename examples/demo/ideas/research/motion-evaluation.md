---
id: "idea.motion-evaluation"
type: "idea"
title: "Evaluating contact quality in motion transitions"
privacy: "private"
updated: "2026-09-12T09:00:00+04:00"
sources: ["demo:fictional"]
aliases: ["motion evaluation", "contact drift", "动作质量评估", "研究想法", "动作评估"]
tags: ["research-idea", "animation", "evaluation"]
links: ["project.motion-atlas", "domain.engineering", "person.evan-cole", "person.jun-park"]
status: "draft"
idea_kind: "research"
---

# Project Title

Does a lower transition discontinuity also mean better foot contact?

# Project Description

Motion Atlas can align root positions while a planted foot still slides. The question is whether a continuity measure and a contact-drift measure disagree on the same transition pairs, especially during sharp turns.

Start with the existing blend baseline and one bounded contact-aware modification. Freeze the clip pairs, identify the intended contact intervals, and inspect per-pair outcomes before aggregating. Keep the development pairs separate from a small held-out selection. A method that improves one metric but looks less plausible is a useful result to explain, not a case to drop.

This is a proposed evaluation study. No contact-aware method, new benchmark, or claim of novelty has been established. The completed internship prototype is the motivation, not evidence that the proposed comparison will succeed.

# What kind of help do you need from an advisor?

Help define contact intervals and a defensible held-out unit. Evan can clarify the original contribution boundary; Jun can help judge whether the diagnostic captures an observer's assessment of motion quality. A first review should decide whether this small comparison is informative before broadening the motion set.
