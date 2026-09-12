---
id: "project.tabletop-sim"
type: "project"
title: "Tabletop Sim"
privacy: "private"
updated: "2026-09-12T09:00:00+04:00"
sources: ["demo:fictional"]
aliases: ["tabletop manipulation", "simulation reset", "reset velocity", "仿真重置"]
tags: ["robotics", "simulation", "reproducibility", "failure-analysis"]
links: ["person.omar-patel", "domain.robotics", "idea.sim-failure-taxonomy", "journal.sim-scope", "journal.sim-reset"]
status: "active"
---

# Current state

A bounded manipulation simulation with one cube, one table, and a fixed gripper setup. The August 13 scope deliberately excluded a varied object set or hardware transfer. Evaluation is paused because a September 2 check found that reset can leave velocity from the previous episode.

# Technical design

An episode specifies the object pose, gripper state, initial velocities, action sequence, and terminal condition. Reset must restore the complete intended state before an outcome can be compared. Returning the cube to its starting position while retaining velocity changes the next episode's initial conditions.

The project currently tests the simulator harness and a simple scripted interaction. It does not establish a trained general manipulation policy. A visible grasp in one scene would not establish robustness to different shapes, friction, or camera views.

# Evidence and limits

The reset defect means apparent success or failure can depend on the preceding episode. Aggregate grasp results from that harness should not be treated as a valid benchmark. Omar is the person to consult on the reset contract and a suitable minimal diagnostic.

No physical robot experiment, safety validation, or sim-to-real result is recorded.

# Next action

Reset the same saved initial condition after two deliberately different preceding episodes. Compare object pose, linear and angular velocity, gripper state, and the first observation before issuing an action. Resume the benchmark only when those states agree within a stated tolerance.
