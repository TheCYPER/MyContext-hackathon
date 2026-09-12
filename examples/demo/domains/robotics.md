---
id: "domain.robotics"
type: "domain"
title: "Small simulation experiments"
privacy: "private"
updated: "2026-09-12T12:00:00Z"
sources: ["demo:fictional"]
aliases: ["机器人", "simulation"]
tags: ["robotics", "simulation", "reset"]
links: ["project.tabletop-sim", "person.omar-patel", "idea.sim-failure-taxonomy", "journal.sim-scope", "journal.sim-reset"]
status: "active"
---

# Current boundary

Tabletop Sim has one cube, one table, and a fixed gripper configuration. Alex wants a scene simple enough that an unexpected trajectory has an inspectable cause. It is a simulation exercise, not a hardware manipulation result.

# Problem to resolve

A reset can leave velocity from the previous episode. That makes repeated attempts incomparable even when the initial pose looks the same. The current benchmark is paused while Alex checks the full reset state with Omar.

# What comes next

Define which state variables must be restored and what a deterministic reset check should compare. Only after repeated resets agree should Alex inspect manipulation failures or propose a taxonomy. A new object set, a learning controller, and physical deployment are outside this step.
