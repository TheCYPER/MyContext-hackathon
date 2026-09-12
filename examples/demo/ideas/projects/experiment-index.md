---
id: "idea.experiment-index"
type: "idea"
title: "An experiment index that distinguishes absent, failed, and complete runs"
privacy: "private"
updated: "2026-09-12T09:00:00+04:00"
sources: ["demo:fictional"]
aliases: ["experiment index", "run manifest", "实验索引", "项目想法", "实验记录"]
tags: ["project-idea", "research", "reproducibility"]
links: ["project.eval-notebook", "project.lab-search", "domain.context-systems", "person.nora-diaz"]
status: "draft"
idea_kind: "project"
---

# Problem

Experiment notes are hard to search when a planned run, a failed run, and a completed run all have similarly polished titles. A missing result can be mistaken for a negative result or quietly replaced by the latest output.

# Product direction

Keep a small file-based index with stable run identifiers, the question being tested, status, split and configuration references, expected outputs, and supersession links. Search should return the relevant run state before attempting to summarise its result.

# First validation

Construct a minimal chain with a planned run, a run that failed before evaluation, a completed but invalid split, and a corrected rerun. With Nora, check that queries such as which result can support this comparison return the proper evidence and explain the invalid earlier result without deleting its history.

# Current boundary

This is a proposed organisation layer, not an experiment tracker already operating in the lab. It does not launch runs, monitor jobs, import entire transcript stores, or infer success merely because an output filename exists.
