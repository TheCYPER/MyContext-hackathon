#!/usr/bin/env ruby
# frozen_string_literal: true
require "date"
require "digest"
require "json"
require "open3"
require "psych"
require "time"
ALLOWED_ROOTS = %w[profile domains projects ideas experience people resources journal].freeze
ALLOWED_TYPES = %w[profile domain person resource project idea experience journal draft].freeze
ALLOWED_PRIVACY = %w[public private restricted].freeze
ALLOWED_STATUS = %w[active archived draft].freeze
ALLOWED_IDEA_KINDS = %w[research project].freeze
ALLOWED_RESOURCE_KINDS = %w[book course place tool music artwork].freeze
ALLOWED_DEMO_KINDS = %w[fictional public_reference].freeze
EMPTY_PROFILE = "<!-- mycontext:empty-profile -->\n# Your context\n\nNo personal facts have been added yet. Add your profile only after reviewing the proposed changes.\n".freeze
REQUIRED_ARRAYS = %w[sources aliases tags links].freeze
MAX_DOCUMENT_BYTES = 1_048_576
class ProjectionError < StandardError; end
def git_capture(root, *args)
  stdout, stderr, status = Open3.capture3("git", "-C", root, *args)
  return stdout if status.success?
  message = stderr.to_s.lines.first.to_s.strip
  raise ProjectionError, "git #{args.first} failed#{message.empty? ? '' : ": #{message}"}"
end
def duplicate_yaml_key?(node)
  return false unless node.respond_to?(:children) && node.children
  if node.is_a?(Psych::Nodes::Mapping)
    seen = {}
    node.children.each_slice(2) do |key, value|
      name = key.respond_to?(:value) ? key.value.to_s : key.to_s
      return true if seen[name]
      seen[name] = true
      return true if duplicate_yaml_key?(value)
    end
    false
  else
    node.children.any? { |child| duplicate_yaml_key?(child) }
  end
end
def parse_frontmatter(content)
  return nil unless content.start_with?("---\n")
  closing = content.index("\n---\n", 4)
  return nil unless closing
  yaml = content[4...closing]
  stream = Psych.parse_stream(yaml)
  return nil if duplicate_yaml_key?(stream)
  data = Psych.safe_load(yaml, permitted_classes: [Date, Time],
    permitted_symbols: [], aliases: false)
  return nil unless data.is_a?(Hash)
  [data, content[(closing + 5)..].to_s]
rescue Psych::Exception, ArgumentError
  nil
end
def canonical_path?(path)
  return false if path.include?("\0") || path.match?(/[\r\n\\]/)
  parts = path.split("/")
  return false unless ALLOWED_ROOTS.include?(parts.first)
  return false unless path.end_with?(".md")
  return false if parts.any? { |part| part.empty? || part == "." || part == ".." }
  parts.all? { |part| part.match?(/\A[A-Za-z0-9._-]+\z/) }
end
def expected_type(path)
  case path
  when %r{\Aprofile/} then "profile"
  when %r{\Adomains/} then "domain"
  when %r{\Aprojects/} then "project"
  when %r{\Aideas/} then "idea"
  when %r{\Aexperience/[^/]+/drafts/} then "draft"
  when %r{\Aexperience/} then "experience"
  when %r{\Apeople/[^/]+/drafts/} then "draft"
  when %r{\Apeople/} then "person"
  when %r{\Aresources/} then "resource"
  when %r{\Ajournal/} then "journal"
  end
end
def idea_kind_for_path(path)
  return "research" if path.match?(%r{\Aideas/research/[^/]+\.md\z})
  return "project" if path.match?(%r{\Aideas/projects/[^/]+\.md\z})
  nil
end
def normalized_timestamp(value)
  text = value.respond_to?(:iso8601) ? value.iso8601 : value.to_s
  return nil unless text.match?(/(?:Z|[+-]\d{2}:\d{2})\z/)
  Time.iso8601(text)
  text
rescue ArgumentError
  nil
end
def valid_string_array?(value)
  value.is_a?(Array) && value.all? { |item| item.is_a?(String) && !item.strip.empty? }
end
def normalized_date(value)
  text = value.to_s
  return nil unless text.match?(/\A\d{4}-\d{2}-\d{2}\z/)
  Date.iso8601(text)
  text
rescue ArgumentError
  nil
end
def extract_summary(body)
  paragraphs = body.split(/\n{2,}/).map do |paragraph|
    paragraph.lines.map(&:strip).reject { |line| line.empty? || line.start_with?("#", "```") }
      .map { |line| line.sub(/\A[-*]\s+/, "") }.join(" ")
  end
  paragraphs.find { |paragraph| !paragraph.empty? }.to_s[0, 320]
end
def extract_sections(body)
  sections = []
  current = nil
  body.each_line do |line|
    match = line.match(/\A(\#{1,6})\s+(.+?)\s*\z/)
    if match
      sections << current if current
      current = { "title" => match[2], "level" => match[1].length, "lines" => [] }
    elsif current
      current["lines"] << line
    end
  end
  sections << current if current
  sections.map { |section| section.slice("title", "level").merge("body" => section["lines"].join.strip) }
end
def derive_role_and_parent(path, data)
  case path
  when %r{\Apeople/([^/]+)/profile\.md\z} then ["primary", nil]
  when %r{\Apeople/([^/]+)/research\.md\z} then ["research", "person.#{$1}"]
  when %r{\Apeople/([^/]+)/drafts/}
    parent = data["links"].find { |item| item.start_with?("person.") }
    ["draft", parent || "person.#{$1}"]
  when %r{\Aexperience/([^/]+)/drafts/}
    parent = data["links"].find { |item| item.start_with?("experience.") }
    ["draft", parent || "experience.#{$1}"]
  when %r{\Ajournal/} then ["event", nil]
  when %r{/overview\.md\z} then ["overview", nil]
  else ["primary", nil]
  end
end
def first_action(sections)
  section = sections.find { |item| item["title"].match?(/\A(?:next|current action|unresolved)/i) }
  return nil unless section
  line = section["body"].lines.map(&:strip).find { |item| !item.empty? }
  line&.sub(/\A[-*]\s+/, "")&.slice(0, 240)
end
def section_body(sections, title)
  sections.find { |section| section["title"] == title }&.fetch("body", "").to_s
end
def entity_from_blob(path, content)
  return [:placeholder, nil] if path == "profile/summary.md" && content == EMPTY_PROFILE
  return [:invalid, nil] if content.bytesize > MAX_DOCUMENT_BYTES
  parsed = parse_frontmatter(content)
  return [:invalid, nil] unless parsed
  data, body = parsed
  privacy = data["privacy"]
  return [:invalid, nil] unless ALLOWED_PRIVACY.include?(privacy)
  return [:restricted, nil] if privacy == "restricted"
  expected = expected_type(path)
  type = data["type"]
  id = data["id"]
  title = data["title"]
  status = data["status"]
  updated = normalized_timestamp(data["updated"])
  return [:invalid, nil] unless expected && type == expected && ALLOWED_TYPES.include?(type)
  return [:invalid, nil] unless id.is_a?(String) && id.match?(/\A[a-z0-9][a-z0-9._-]*\z/)
  return [:invalid, nil] unless title.is_a?(String) && !title.strip.empty?
  return [:invalid, nil] unless ALLOWED_STATUS.include?(status) && updated
  return [:invalid, nil] unless REQUIRED_ARRAYS.all? { |field| valid_string_array?(data[field]) }
  return [:invalid, nil] if data["sources"].empty?
  return [:invalid, nil] if type == "draft" && status != "draft"
  return [:invalid, nil] if data.key?("resource_kind") && (type != "resource" || !ALLOWED_RESOURCE_KINDS.include?(data["resource_kind"]))
  return [:invalid, nil] if data.key?("demo_kind") && !ALLOWED_DEMO_KINDS.include?(data["demo_kind"])
  return [:invalid, nil] if data.key?("accessed") && !normalized_date(data["accessed"])
  sections = extract_sections(body)
  role, parent_id = derive_role_and_parent(path, data)
  entity = data.slice("id", "type", "title", "privacy", "status", *REQUIRED_ARRAYS).merge(
    "role" => role, "updated" => updated, "path" => path,
    "summary" => extract_summary(body),
    "sectionTitles" => sections.map { |section| section["title"] },
    "sections" => sections,
    "body" => body.strip)
  entity["resourceKind"] = data["resource_kind"] if data.key?("resource_kind")
  entity["demoKind"] = data["demo_kind"] if data.key?("demo_kind")
  entity["accessed"] = normalized_date(data["accessed"]) if data.key?("accessed")
  if type == "idea"
    idea_kind = data["idea_kind"]
    return [:invalid, nil] unless ALLOWED_IDEA_KINDS.include?(idea_kind)
    return [:invalid, nil] unless idea_kind_for_path(path) == idea_kind
    return [:invalid, nil] unless %w[draft archived].include?(status)
    entity["ideaKind"] = idea_kind
    if idea_kind == "research"
      submission = {
        "projectTitle" => section_body(sections, "Project Title"),
        "projectDescription" => section_body(sections, "Project Description"),
        "advisorHelp" => section_body(sections, "What kind of help do you need from an advisor?")
      }
      return [:invalid, nil] if submission.values.any?(&:empty?)
      entity["submission"] = submission
    end
  end
  entity["parentId"] = parent_id if parent_id
  [:ok, entity]
end
def graph_for(entities)
  nodes = entities.select do |entity|
    %w[profile domain idea project experience person resource].include?(entity["type"]) &&
      !%w[research draft event].include?(entity["role"])
  end.map do |entity|
    entity.slice("id", "type", "title", "privacy", "status", "tags", "ideaKind", "resourceKind", "demoKind", "accessed")
  end
  nodes_by_id = nodes.to_h { |node| [node["id"], node] }
  edges_by_key = {}
  entities.each do |entity|
    next unless nodes_by_id.key?(entity["id"])
    entity["links"].uniq.each do |target_id|
      next if target_id == entity["id"]
      target = nodes_by_id[target_id]
      next unless target
      from = entity["id"]
      to = target_id
      key = [from, to, "related_to"].join("\0")
      privacy = [nodes_by_id[from]["privacy"], nodes_by_id[to]["privacy"]]
        .include?("private") ? "private" : "public"
      edges_by_key[key] ||= {
        "id" => "edge.#{Digest::SHA256.hexdigest(key)[0, 16]}",
        "from" => from,
        "to" => to,
        "kind" => "related_to",
        "provenance" => "frontmatter.links",
        "declaredBy" => from,
        "sourcePath" => entity["path"],
        "semanticStatus" => "untyped",
        "evidence" => "reason_not_structured",
        "review" => "not_represented",
        "privacy" => privacy
      }
    end
  end
  edges = edges_by_key.values.sort_by { |edge| edge["id"] }
  adjacency = nodes_by_id.keys.sort.to_h do |id|
    [id, { "incomingEdgeIds" => [], "outgoingEdgeIds" => [], "neighborIds" => [] }]
  end
  edges.each do |edge|
    adjacency[edge["from"]]["outgoingEdgeIds"] << edge["id"]
    adjacency[edge["to"]]["incomingEdgeIds"] << edge["id"]
    adjacency[edge["from"]]["neighborIds"] << edge["to"]
    adjacency[edge["to"]]["neighborIds"] << edge["from"]
  end
  adjacency.each_value do |entry|
    entry.each_value do |values|
      values.uniq!
      values.sort!
    end
  end
  nodes = nodes.map do |node|
    entry = adjacency.fetch(node["id"])
    node.merge(
      "incomingCount" => entry["incomingEdgeIds"].length,
      "outgoingCount" => entry["outgoingEdgeIds"].length,
      "neighborCount" => entry["neighborIds"].length
    )
  end
  {
    "nodes" => nodes.sort_by { |node| node["id"] },
    "edges" => edges,
    "adjacency" => adjacency
  }
end
def build_projection(root)
  repository = File.realpath(root)
  worktree = File.realpath(git_capture(repository, "rev-parse", "--show-toplevel").strip)
  raise ProjectionError, "configured root is not the Git worktree root" unless repository == worktree
  revision = git_capture(repository, "rev-parse", "--verify", "HEAD").strip
  raise ProjectionError, "invalid HEAD revision" unless revision.match?(/\A[0-9a-f]{40}\z/)
  branch = git_capture(repository, "branch", "--show-current").strip
  dirty = !git_capture(repository, "status", "--porcelain=v1", "--untracked-files=normal").empty?
  raw_paths = git_capture(
    repository,
    "ls-tree", "-r", "-z", "--name-only", revision, "--", *ALLOWED_ROOTS
  )
  candidates = []
  excluded = { "restricted" => 0, "invalid" => 0, "duplicateId" => 0 }
  raw_paths.split("\0").sort.each do |path|
    next if path.empty? || !path.end_with?(".md")
    unless canonical_path?(path)
      excluded["invalid"] += 1
      next
    end
    content = git_capture(repository, "show", "#{revision}:#{path}")
    result, entity = entity_from_blob(path, content)
    if result == :ok
      candidates << entity
    elsif result != :placeholder
      excluded[result.to_s] += 1
    end
  end
  duplicate_ids = candidates.group_by { |entity| entity["id"] }
    .select { |_id, group| group.length > 1 }.keys
  excluded["duplicateId"] = candidates.count { |entity| duplicate_ids.include?(entity["id"]) }
  entities = candidates.reject { |entity| duplicate_ids.include?(entity["id"]) }
    .sort_by { |entity| [entity["type"], entity["id"]] }
  by_id = entities.to_h { |entity| [entity["id"], entity] }
  review_items = entities.select { |entity| entity["type"] == "draft" }.map do |entity|
    entity.slice("title", "parentId", "privacy", "updated", "path").merge(
      "id" => "review.#{entity['id']}", "kind" => "draft",
      "state" => "needs_review", "entityId" => entity["id"]).compact
  end
  workstreams = entities.select { |entity| entity["type"] == "project" }.map do |entity|
    linked = entity["links"].select { |id| by_id.key?(id) }
    linked_people = linked.select { |id| by_id[id]["type"] == "person" && by_id[id]["role"] != "research" }
    attention = entity["sectionTitles"].grep(/unknown|unresolved|open|risk|boundary|next/i)
    entity.slice("id", "title", "status", "privacy", "updated", "tags", "summary").merge(
      "linkedEntities" => linked,
      "linkedPeople" => linked_people,
      "attention" => attention,
      "nextAction" => first_action(entity["sections"]))
  end.sort_by { |workstream| workstream["title"].downcase }
  counts_by_type = entities.group_by { |entity| entity["type"] }.transform_values(&:length)
  counts_by_idea_kind = entities.select { |entity| entity["type"] == "idea" }
    .group_by { |entity| entity["ideaKind"] }.transform_values(&:length)
  counts_by_status = entities.group_by { |entity| entity["status"] }.transform_values(&:length)
  {
    "schemaVersion" => 4,
    "revision" => revision,
    "generatedAt" => Time.now.utc.iso8601,
    "repo" => { "root" => repository, "revision" => revision,
      "branch" => branch.empty? ? nil : branch, "dirty" => dirty,
      "canonicalSource" => "git-head" },
    "counts" => { "total" => entities.length, "byType" => counts_by_type,
      "byIdeaKind" => counts_by_idea_kind,
      "byStatus" => counts_by_status, "reviewItems" => review_items.length,
      "workstreams" => workstreams.length, "excluded" => excluded },
    "entities" => entities,
    "reviewItems" => review_items,
    "workstreams" => workstreams,
    "operations" => [],
    "graph" => graph_for(entities),
    "boundaries" => { "canonicalSource" => "git-head", "readOnly" => true,
      "operations" => "not-instrumented", "restricted" => "excluded",
      "sources" => "excluded", "outreach" => "draft-only" },
    "capabilities" => { "readOnly" => true, "writes" => false,
      "emailSend" => false, "operations" => false,
      "restricted" => false, "sources" => false }
  }
end
begin
  root = ARGV[0] || File.expand_path("..", __dir__)
  puts JSON.generate(build_projection(root))
rescue Errno::ENOENT, Errno::EACCES, ProjectionError => e
  warn "projector: #{e.message}"
  exit 1
rescue StandardError => e
  warn "projector: projection failed (#{e.class})"
  exit 1
end
