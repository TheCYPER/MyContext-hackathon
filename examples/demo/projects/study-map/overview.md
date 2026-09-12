---
id: "project.study-map"
type: "project"
title: "StudyMap"
privacy: "private"
updated: "2026-09-12T09:00:00+04:00"
sources: ["demo:fictional"]
aliases: ["question library", "deep learning notes", "独立解题", "反向传播", "学习问题库", "梯度", "链式法则"]
tags: ["learning", "deep-learning", "retrieval-practice", "questions"]
links: ["experience.peer-mentoring", "person.maya-ortiz", "person.theo-grant", "domain.learning", "idea.study-retention", "journal.gradient-question", "journal.recall-gap", "journal.study-recheck"]
status: "active"
---

# Current state

A deep-learning question library that separates reading an explanation from solving a new problem independently. Alex can explain the chain-rule example with notes. A later no-notes attempt exposed a gap; one new example was then solved correctly. The topic remains in review rather than being marked mastered.

# Record design

Each question keeps the original confusion, the quantities and their shapes, a worked example, and a separate self-check. A status such as explained describes the note; independently solved describes an attempt. The same item can have a good explanation and still need practice.

For gradients, the check starts by naming the input, parameters, scalar loss, and derivative shapes. A memorised expression is not enough if Alex cannot say which value is held fixed or explain how the gradient reaches an earlier layer.

# Evidence and limits

On April 7, the chain-rule explanation made sense with guidance. The April 10 recall exercise failed without notes. On April 17, Alex solved one different numerical example. This is evidence of that attempt, not durable retention or general competence across neural networks.

Maya is a study collaborator. Theo can clarify the course's mathematical expectations. Neither person has certified mastery of the topic.

# Next action

Use another short example after a delay, without displaying the worked solution. Record the reasoning step that fails, if any, and update that question rather than adding a second near-duplicate explanation. Ask the assistant for one hint at a time until the missing step is clear.
