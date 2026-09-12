---
id: "journal.gradient-question"
type: "journal"
title: "Following a gradient one dependency at a time"
privacy: "private"
updated: "2026-04-07T12:00:00Z"
sources: ["demo:fictional"]
aliases: ["反向传播", "链式法则", "backpropagation", "gradient explanation"]
tags: ["research-memory"]
links: ["project.study-map", "experience.peer-mentoring", "person.maya-ortiz", "domain.learning", "journal.recall-gap"]
status: "active"
date: "2026-04-07"
---

# The question

I could repeat the chain-rule formula but lost track of which intermediate quantity depended on the weight I was differentiating. Maya asked me to draw the computational graph before writing another line of algebra. That made the missing dependency visible.

# What helped

With the notes open, I could explain a guided example by naming the intermediate value, its input, and the local derivative at each step. StudyMap should keep both the original question and the explanation, including the point where I had skipped an intermediate dependency.

# What remains untested

This was an explanation I followed with help. I have not yet shown that I can reconstruct it on a different graph without the notes. A fresh exercise should come next, rather than marking backpropagation as mastered.
