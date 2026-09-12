---
id: "journal.query-review"
type: "journal"
title: "COUNT needed a more careful reading"
privacy: "private"
updated: "2026-05-14T12:00:00Z"
sources: ["demo:fictional"]
aliases: ["SQL", "COUNT", "NULL", "数据库课程"]
tags: ["research-memory"]
links: ["project.course-database", "person.theo-grant", "domain.learning"]
status: "active"
date: "2026-05-14"
---

# Misconception

I had treated counting rows and counting values in a column as interchangeable. The course fixture with NULL values made the difference concrete. I corrected the COUNT expression before checking the aggregate result again.

# Exercise result

The joins and aggregate queries now produce the expected results on the course fixtures. This completes the CourseQuery lab exercise, which can be archived with the misconception and its correction intact.

# Scope

The check belongs to a course assignment. It does not establish behavior on an unseen production dataset or a deployed database. If I return to SQL later, the useful memory is why the original count was wrong and which fixture exposed it, not a general claim that I have finished learning databases.
