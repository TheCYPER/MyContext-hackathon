---
id: "project.eval-notebook"
type: "project"
title: "Eval Notebook"
privacy: "private"
updated: "2026-09-12T09:00:00+04:00"
sources: ["demo:fictional"]
aliases: ["experiment reports", "grouped split", "evaluation manifest", "评估记录", "实验记录", "数据泄漏", "实验复现"]
tags: ["research", "reproducibility", "data-leakage", "experiments"]
links: ["experience.visual-computing-lab", "person.rhea-sen", "person.nora-diaz", "domain.research", "idea.evidence-calibration", "journal.eval-split", "journal.eval-leakage", "journal.eval-rerun"]
status: "active"
---

# Current state

A report format for connecting an experiment's question, data split, configuration, outputs, and interpretation. The earlier clip-random result was withdrawn after a leakage review. A grouped-split rerun has a complete manifest, but only one seed; there is no current claim that a method improves on the baseline.

# Technical design

Every clip retains its source-sequence identifier. Splitting should assign whole source sequences to a partition before any derived clips are selected. The report records that partition, the evaluated examples, configuration differences, and the location expected for each output.

A report must distinguish an absent artifact, a failed run, a completed run, and a supported conclusion. Filling every field in a notebook establishes documentation coverage, not experimental validity.

# Evidence and limits

The August 18 attempt randomly split clips. On August 24, Alex and Nora found that clips from the same source sequence appeared in both training and testing. Its apparently favourable result cannot support a generalisation claim.

The September 7 rerun grouped by source sequence and retained the manifest. That addresses the identified overlap in this run. It does not estimate seed variation, prove all leakage paths are closed, or show superiority over another method. Rhea asked for a valid comparison before a headline result.

# Next action

Review the partition manifest with Nora, then run the unchanged baseline and candidate under the same grouped split and metric definitions. Preserve per-sequence outputs so a difference can be inspected. Repeat seeds only after this comparison is valid and the compute scope is agreed.
