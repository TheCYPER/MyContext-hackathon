#!/usr/bin/env ruby
# frozen_string_literal: true

require "date"
require "fileutils"
require "json"
require "open3"
require "rbconfig"
require "tmpdir"
require_relative "../scripts/knowledge_relations"

def assert(condition, message)
  raise "knowledge-relations test failed: #{message}" unless condition
end

def assert_validation_error(fragment)
  yield
  raise "knowledge-relations test failed: expected validation error containing #{fragment.inspect}"
rescue KnowledgeRelations::ValidationError => e
  assert(e.errors.any? { |error| error.include?(fragment) }, "missing error #{fragment.inspect}: #{e.errors.inspect}")
end

valid = {
  "relations" => [{
    "id" => "relation.person.mentor.participates_in.project.alpha",
    "predicate" => "participates_in",
    "target" => "project.alpha",
    "evidence" => "user_confirmed",
    "sources" => ["user:2026-08-20", "context:journal.alpha.started"],
    "review" => "confirmed",
    "privacy" => "public",
    "valid_from" => Date.new(2026, 1, 2),
    "valid_to" => "2026-08-20",
    "note" => "  Evaluation contributor.  "
  }]
}
normalized = KnowledgeRelations.normalize_relations(valid,
  declared_by: "person.mentor", source_path: "people/mentor/profile.md")
assert(normalized.length == 1, "valid relation was not normalized")
assert(normalized[0]["valid_from"] == "2026-01-02", "date was not normalized")
assert(normalized[0]["note"] == "Evaluation contributor.", "note was not stripped")
assert(KnowledgeRelations.normalize_relations({}).empty?, "relations should be optional")

assert_validation_error("unknown fields") do
  KnowledgeRelations.normalize_relations({ "relations" => [valid["relations"][0].merge("weight" => 1)] })
end
assert_validation_error("sources must be") do
  KnowledgeRelations.normalize_relations({ "relations" => [valid["relations"][0].merge("sources" => [])] })
end
assert_validation_error("valid_from must not be after") do
  KnowledgeRelations.normalize_relations({ "relations" => [valid["relations"][0].merge(
    "valid_from" => "2026-09-01", "valid_to" => "2026-08-20"
  )] })
end
assert_validation_error("target must differ") do
  KnowledgeRelations.normalize_relations(valid, declared_by: "project.alpha")
end

assert(KnowledgeRelations.endpoint_allowed?("part_of", from_type: "project",
  to_type: "experience"), "project should be allowed as part of experience")
assert(KnowledgeRelations.endpoint_allowed?("motivated_by", from_type: "idea",
  to_type: "project"), "idea should be allowed to be motivated by a project")
assert(!KnowledgeRelations.endpoint_allowed?("participates_in", from_type: "project",
  to_type: "person"), "participates_in direction was not enforced")
assert(!KnowledgeRelations.endpoint_allowed?("supersedes", from_type: "project",
  to_type: "idea"), "supersedes same-type constraint was not enforced")
assert(KnowledgeRelations.effective_privacy("public", "private", "public") == "private",
  "effective privacy did not select the strictest value")
assert(KnowledgeRelations.predicate_registry.keys.sort == KnowledgeRelations::PREDICATES.keys.sort,
  "projected predicate registry is incomplete")

def yaml_list(values)
  return "[]" if values.empty?
  "\n" + values.map { |value| "  - #{value.to_json}" }.join("\n")
end

def document(id:, type:, title:, privacy: "public", status: "active", links: [], date: nil,
    relations: nil, body: "# Notes\n\nFixture")
  relation_yaml = if relations
    "relations:\n" + relations.map do |relation|
      lines = ["  - id: #{relation.fetch('id')}"]
      relation.each do |key, value|
        next if key == "id"
        if value.is_a?(Array)
          lines << "    #{key}:"
          value.each { |item| lines << "      - #{item.to_json}" }
        else
          lines << "    #{key}: #{value.to_json}"
        end
      end
      lines.join("\n")
    end.join("\n")
  end
  ["---", "id: #{id}", "type: #{type}", "title: #{title}", "privacy: #{privacy}",
    'updated: "2026-08-20T12:00:00+00:00"', "sources:", '  - "user:2026-08-20"',
    "aliases: []", "tags: []", "links: #{yaml_list(links)}", "status: #{status}",
    ("date: #{date}" if date), relation_yaml, "---", "", body, ""].compact.join("\n")
end

Dir.mktmpdir("mycontext-relations-test-") do |root|
  files = {
    "profile/summary.md" => document(id: "profile.summary", type: "profile", title: "Summary"),
    "projects/alpha/overview.md" => document(id: "project.alpha", type: "project", title: "Alpha",
      links: ["person.mentor"]),
    "people/mentor/profile.md" => document(id: "person.mentor", type: "person", title: "Mentor",
      relations: [{
        "id" => "relation.person.mentor.participates_in.project.alpha",
        "predicate" => "participates_in", "target" => "project.alpha",
        "evidence" => "user_confirmed", "sources" => ["context:journal.alpha.started"],
        "review" => "confirmed", "privacy" => "public"
      }]),
    "journal/2026/2026-08-20-alpha-started.md" => document(id: "journal.alpha.started",
      type: "journal", title: "Alpha started", privacy: "private", date: "2026-08-20", relations: [{
        "id" => "relation.journal.alpha.about.project.alpha",
        "predicate" => "about", "target" => "project.alpha", "evidence" => "artifact",
        "sources" => ["repo:alpha@abc123:README.md"], "review" => "unreviewed",
        "privacy" => "private", "valid_from" => "2026-08-20"
      }]),
    "people/mentor/drafts/note.md" => document(id: "draft.mentor.note", type: "draft",
      title: "Draft note", status: "draft", relations: [{
        "id" => "relation.draft.mentor.about.project.alpha",
        "predicate" => "about", "target" => "project.alpha", "evidence" => "inference",
        "sources" => ["user:2026-08-20"], "review" => "rejected", "privacy" => "restricted"
      }]),
    "INDEX.md" => "# Index\n"
  }
  files.each do |relative, content|
    path = File.join(root, relative)
    FileUtils.mkdir_p(File.dirname(path))
    File.write(path, content)
  end
  Open3.capture3("git", "-C", root, "init", "-b", "main")
  Open3.capture3("git", "-C", root, "config", "user.email", "test@example.invalid")
  Open3.capture3("git", "-C", root, "config", "user.name", "Test")
  Open3.capture3("git", "-C", root, "add", ".")
  _stdout, stderr, status = Open3.capture3("git", "-C", root, "commit", "-m", "fixture")
  assert(status.success?, "fixture commit failed: #{stderr}")

  projector = File.expand_path("../dashboard/projector.rb", __dir__)
  stdout, stderr, status = Open3.capture3(RbConfig.ruby, projector, root)
  assert(status.success?, "projector failed: #{stderr}")
  projection = JSON.parse(stdout)
  assert(projection["schemaVersion"] == 5, "schema version was not incremented")
  assert(projection["graph"]["nodes"].any? { |node| node["type"] == "journal" && node["date"] == "2026-08-20" },
    "journal node or event date is missing")
  assert(projection["graph"]["nodes"].any? { |node| node["type"] == "draft" },
    "draft node is missing")
  typed = projection["graph"]["edges"].select { |edge| edge["semanticStatus"] == "typed" }
  assert(typed.map { |edge| edge["id"] }.sort == [
    "relation.journal.alpha.about.project.alpha",
    "relation.person.mentor.participates_in.project.alpha"
  ], "typed edge inclusion or restricted filtering is incorrect")
  participant = typed.find { |edge| edge["kind"] == "participates_in" }
  assert(participant["privacy"] == "private", "private context evidence did not raise edge privacy")
  assert(participant["declarations"] == [{ "from" => "person.mentor", "to" => "project.alpha" }],
    "typed declaration provenance is missing")
  assert(projection["graph"]["edges"].any? { |edge| edge["kind"] == "related_to" },
    "legacy untyped links were not preserved")
  assert(projection["entities"].none? { |entity| entity.key?("relations") || entity.key?("_relations") },
    "raw relations leaked through entity projection")

  # A public assertion must disappear when its context evidence becomes
  # restricted; removing just the source node would leave its locator exposed.
  journal_path = "journal/2026/2026-08-20-alpha-started.md"
  File.write(File.join(root, journal_path), files.fetch(journal_path).sub("privacy: private", "privacy: restricted"))
  Open3.capture3("git", "-C", root, "add", journal_path)
  _stdout, stderr, status = Open3.capture3("git", "-C", root, "commit", "-m", "restrict synthetic evidence")
  assert(status.success?, "restricted fixture commit failed: #{stderr}")
  stdout, stderr, status = Open3.capture3(RbConfig.ruby, projector, root)
  assert(status.success?, "restricted evidence projector failed: #{stderr}")
  restricted_projection = JSON.parse(stdout)
  assert(restricted_projection["graph"]["nodes"].none? { |node| node["id"] == "journal.alpha.started" },
    "restricted context evidence node leaked")
  assert(restricted_projection["graph"]["edges"].none? { |edge| edge["semanticStatus"] == "typed" },
    "assertion using restricted context evidence leaked")
  assert(!stdout.include?("context:journal.alpha.started"), "restricted evidence locator leaked")

  File.write(File.join(root, "projects/alpha/overview.md"), document(
    id: "project.alpha", type: "project", title: "Alpha", relations: [{
      "id" => "relation.person.mentor.participates_in.project.alpha",
      "predicate" => "supports", "target" => "project.missing", "evidence" => "artifact",
      "sources" => ["context:journal.missing"], "review" => "confirmed", "privacy" => "public"
    }]
  ))
  validator = File.expand_path("../scripts/validate.rb", __dir__)
  _stdout, stderr, status = Open3.capture3(RbConfig.ruby, validator, "--scaffold", root)
  assert(!status.success?, "validator accepted invalid complete-context references")
  assert(stderr.include?("duplicate relation id"), "validator missed a duplicate relation ID")
  assert(stderr.include?("targets missing entity"), "validator missed a missing relation target")
end

puts "knowledge-relations: OK"

Dir.mktmpdir("mycontext-source-graph-test-") do |root|
  run_git = lambda do |*args|
    _out, error, result = Open3.capture3("git", "-C", root, *args)
    assert(result.success?, "source fixture Git failed: #{error}")
  end
  project = "projects/alpha/overview.md"
  journal = "journal/2026/2026-08-20-source-capture.md"
  files = {
    project => document(id: "project.alpha", type: "project", title: "Alpha", privacy: "private"),
    journal => document(id: "journal.source-capture", type: "journal", title: "Recorded source",
      date: "2026-08-20")
  }
  source_lines = %w[context:project.alpha context:project.alpha context:project.missing
    context:journal.source-capture session:codex:project.alpha].map { |source| "  - #{source.to_json}" }.join("\n")
  files[journal] = files[journal].sub('  - "user:2026-08-20"', source_lines)
  files.each do |relative, content|
    FileUtils.mkdir_p(File.dirname(File.join(root, relative)))
    File.write(File.join(root, relative), content)
  end
  run_git.call("init", "-b", "main")
  run_git.call("config", "user.email", "test@example.invalid")
  run_git.call("config", "user.name", "Test")
  run_git.call("add", ".")
  run_git.call("commit", "-m", "source references")
  project_snapshot = lambda do
    out, error, result = Open3.capture3(RbConfig.ruby, File.expand_path("../dashboard/projector.rb", __dir__), root)
    assert(result.success?, "source projection failed: #{error}")
    JSON.parse(out)
  end
  snapshot = project_snapshot.call
  edges = snapshot["graph"]["edges"]
  assert(edges.length == 1, "exact context references should resolve once without matching free text or self references")
  edge = edges.first
  assert(edge["from"] == "journal.source-capture" && edge["to"] == "project.alpha", "source reference direction changed")
  assert(edge["provenance"] == "frontmatter.sources" && edge["semanticStatus"] == "untyped", "source reference was upgraded to a semantic assertion")
  assert(edge["privacy"] == "private", "source edge did not inherit endpoint privacy")
  assert(snapshot["counts"]["excluded"]["unavailableSourceReference"] == 1, "missing source references should be counted")
  assert(snapshot["graph"]["adjacency"]["project.alpha"]["neighborIds"] == ["journal.source-capture"], "source references missing from adjacency")
  File.write(File.join(root, project), files[project].sub("privacy: private", "privacy: restricted"))
  assert(project_snapshot.call["graph"]["edges"] == edges, "uncommitted source changes affected committed graph")
  run_git.call("add", project)
  run_git.call("commit", "-m", "restrict source target")
  snapshot = project_snapshot.call
  assert(snapshot["graph"]["edges"].empty?, "restricted reference target leaked an edge")
  source_entity = snapshot["entities"].find { |entity| entity["id"] == "journal.source-capture" }
  assert(!source_entity["sources"].include?("context:project.alpha"), "restricted target leaked through projected source metadata")
  missing = "projects/missing/overview.md"
  FileUtils.mkdir_p(File.dirname(File.join(root, missing)))
  File.write(File.join(root, missing), document(id: "project.missing", type: "project", title: "Newly recorded target"))
  assert(project_snapshot.call["graph"]["edges"].empty?, "uncommitted new records entered graph")
  run_git.call("add", missing)
  run_git.call("commit", "-m", "add previously referenced target")
  snapshot = project_snapshot.call
  assert(snapshot["graph"]["edges"].map { |item| item["to"] } == ["project.missing"],
    "new committed target did not resolve an existing reference automatically")
  run_git.call("rm", missing)
  run_git.call("commit", "-m", "remove target")
  assert(project_snapshot.call["graph"]["edges"].empty?, "removed target retained dangling source edge")
end

puts "source-reference graph: OK"
