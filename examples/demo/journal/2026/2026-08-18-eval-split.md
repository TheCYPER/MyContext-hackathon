---
id: "journal.eval-split"
type: "journal"
title: "A clip-random split was an untested assumption"
privacy: "private"
updated: "2026-08-18T12:00:00Z"
sources: ["demo:fictional"]
aliases: ["clip-random split", "initial protocol"]
tags: ["research-memory"]
links: ["project.eval-notebook", "person.nora-diaz", "domain.research", "journal.eval-leakage", "journal.eval-rerun"]
status: "active"
date: "2026-08-18"
---

# Initial setup

I created a clip-random train/test split for the Eval Notebook experiment. It made the pipeline easy to run, but I had not yet checked whether clips from one source sequence could land on both sides.

# Question for review

The manifest needs to make the sample's source identity visible, not just the final partition name. Otherwise Nora would have to infer the grouping from filenames or reconstruct it elsewhere.

# Status of this note

This records the initial setup, not the current approved protocol. The August 24 review found source overlap and withdrew the associated result. The later grouped split and rerun should be used when asking about the current experiment.
