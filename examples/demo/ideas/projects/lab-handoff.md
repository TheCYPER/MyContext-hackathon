---
id: "idea.lab-handoff"
type: "idea"
title: "A bounded handoff packet for a research prototype"
privacy: "private"
updated: "2026-09-12T09:00:00+04:00"
sources: ["demo:fictional"]
aliases: ["lab handoff", "prototype restart", "项目交接", "项目想法", "实验交接"]
tags: ["project-idea", "research", "handoff"]
links: ["project.eval-notebook", "project.tabletop-sim", "domain.research", "person.nora-diaz"]
status: "draft"
idea_kind: "project"
---

# Problem

A collaborator can receive a repository and a result figure without knowing which run is valid, what state must be reset, or which conclusion has been withdrawn. The next person then repeats debugging that should have been documented.

# Product direction

A small handoff packet would collect the current question, minimal reproduction steps, expected inputs and outputs, known failures, and the decision that blocks the next experiment. It would link to canonical project and journal records instead of becoming another independent status document.

# First validation

Use the Eval Notebook grouped-split scenario and ask Nora to identify the valid manifest and the next unresolved comparison using the packet alone. Separately check whether the Tabletop Sim packet makes the reset defect visible before any benchmark is started. Record missing information instead of adding automatic execution first.

# Current boundary

This is an unimplemented idea. No environment provisioning, remote job launch, credential sharing, or claim of successful reproduction is included. A checklist filled by the author is not proof that another person can reproduce the work.
