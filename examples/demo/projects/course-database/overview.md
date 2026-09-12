---
id: "project.course-database"
type: "project"
title: "CourseQuery"
privacy: "private"
updated: "2026-09-12T09:00:00+04:00"
sources: ["demo:fictional"]
aliases: ["relational query lab", "SQL joins", "COUNT NULL", "数据库课程", "关系查询", "空值计数"]
tags: ["learning", "databases", "sql", "coursework"]
links: ["person.theo-grant", "domain.learning", "journal.query-review"]
status: "archived"
---

# Current state

Completed and archived relational-query lab. Joins and aggregates were checked against the course fixtures. The May 14 review corrected a misunderstanding about NULL and counting; completion describes the exercise, not a deployed database application.

# Technical scope

The work involved reading relation schemas, selecting join keys, grouping rows, and explaining what each aggregate counts. A join can duplicate a row when the matching side has several records. The number of resulting rows is therefore not automatically the number of distinct entities.

The important distinction in the final review was COUNT(*) versus COUNT(column): the former counts rows in the result, while the latter counts non-NULL values of the selected expression. A nullable value must not be treated as evidence that the row itself is absent.

# Evidence and limits

The completed queries were checked on the provided course cases. This supports the lab's expected cases, but not correctness for every possible schema, production-scale performance, transaction handling, or operational database administration.

Theo's course framing was to justify keys and expected cardinality before running a query. A query that happens to return the expected number on one tiny fixture can still encode the wrong relation.

# Future reference

When revisiting a similar problem, draw the small relation instance and predict the join cardinality first. Reopen this project only for a new learning question; keep the completed lab state and its review event intact.
