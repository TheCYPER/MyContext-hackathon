#!/usr/bin/env ruby
# frozen_string_literal: true

require "date"
require "find"
require "psych"
require "time"

SCAFFOLD = !!ARGV.delete("--scaffold")
ROOT = File.expand_path(ARGV[0] || File.join(__dir__, ".."))
ERRORS = []

TYPES = %w[profile domain experience person project idea journal draft session_export].freeze
PRIVACY = %w[public private restricted].freeze
STATUSES = %w[active archived draft].freeze
IDEA_KINDS = %w[research project].freeze
REQUIRED = %w[id type title privacy updated sources aliases tags links status].freeze
ARRAY_FIELDS = %w[sources aliases tags links].freeze
TEXT_EXTENSIONS = %w[.md .sh .rb .yml .yaml .toml].freeze

def error(message)
  ERRORS << message
end

def relative(path)
  path.sub(%r{\A#{Regexp.escape(ROOT)}/?}, "")
end

def forbidden_path?(rel)
  parts = rel.split("/")
  base = parts.last.to_s.downcase
  ext = File.extname(base)

  return true if rel.match?(%r{\A(?:\.gstack|\.codex|\.claude)(?:/|\z)}i)
  return true if %w[.jsonl .db .pem .key .p12 .pfx].include?(ext)
  return true if base.match?(/\.sqlite(?:3)?\z/i)
  return true if base == ".env" || base.start_with?(".env.")
  return true if %w[auth.json id_rsa id_ed25519].include?(base)
  return true if base.start_with?("rollout-")
  return true if rel.match?(%r{(?:session-store|archived_sessions|/sessions/|state_\d*\.sqlite)}i)

  false
end

def check_duplicate_yaml_keys(node, rel)
  if node.is_a?(Psych::Nodes::Mapping)
    seen = {}
    node.children.each_slice(2) do |key, value|
      key_name = key.respond_to?(:value) ? key.value.to_s : key.to_s
      error("#{rel}: duplicate YAML key #{key_name.inspect}") if seen[key_name]
      seen[key_name] = true
      check_duplicate_yaml_keys(value, rel)
    end
  elsif node.respond_to?(:children) && node.children
    node.children.each { |child| check_duplicate_yaml_keys(child, rel) }
  end
end

def parse_frontmatter(content, rel)
  unless content.start_with?("---\n")
    error("#{rel}: missing opening YAML frontmatter delimiter")
    return nil
  end

  closing = content.index("\n---\n", 4)
  unless closing
    error("#{rel}: missing closing YAML frontmatter delimiter")
    return nil
  end

  yaml = content[4...closing]
  begin
    stream = Psych.parse_stream(yaml, filename: rel)
    check_duplicate_yaml_keys(stream, rel)
    data = Psych.safe_load(
      yaml,
      permitted_classes: [Date, Time],
      permitted_symbols: [],
      aliases: false,
      filename: rel
    )
  rescue StandardError => e
    error("#{rel}: invalid YAML frontmatter (#{e.class})")
    return nil
  end

  unless data.is_a?(Hash)
    error("#{rel}: frontmatter must be a mapping")
    return nil
  end
  data
end

def expected_type(rel)
  case rel
  when %r{\Aprofile/} then "profile"
  when %r{\Adomains/} then "domain"
  when %r{\Aexperience/[^/]+/drafts/} then "draft"
  when %r{\Aexperience/} then "experience"
  when %r{\Aprojects/} then "project"
  when %r{\Aideas/} then "idea"
  when %r{\Apeople/[^/]+/drafts/} then "draft"
  when %r{\Apeople/} then "person"
  when %r{\Ajournal/} then "journal"
  when %r{\Asources/session-exports/} then "session_export"
  end
end

def knowledge_file?(rel)
  !expected_type(rel).nil? && rel.end_with?(".md")
end

def valid_timestamp?(value)
  text = value.respond_to?(:iso8601) ? value.iso8601 : value.to_s
  return false unless text.match?(/(?:Z|[+-]\d{2}:\d{2})\z/)

  Time.iso8601(text)
  true
rescue ArgumentError
  false
end

def validate_knowledge(rel, content, ids)
  data = parse_frontmatter(content, rel)
  return unless data

  missing = REQUIRED.reject { |field| data.key?(field) }
  error("#{rel}: missing fields #{missing.join(', ')}") unless missing.empty?

  id = data["id"]
  if !id.is_a?(String) || !id.match?(/\A[a-z0-9][a-z0-9._-]*\z/)
    error("#{rel}: id must use lowercase letters, digits, dots, underscores, or hyphens")
  elsif ids.key?(id)
    error("#{rel}: duplicate id #{id.inspect}; first seen in #{ids[id]}")
  else
    ids[id] = rel
  end

  error("#{rel}: invalid type #{data['type'].inspect}") unless TYPES.include?(data["type"])
  error("#{rel}: invalid privacy #{data['privacy'].inspect}") unless PRIVACY.include?(data["privacy"])
  error("#{rel}: invalid status #{data['status'].inspect}") unless STATUSES.include?(data["status"])
  error("#{rel}: title must be a non-empty string") unless data["title"].is_a?(String) && !data["title"].strip.empty?
  error("#{rel}: updated must be RFC3339 with a timezone") unless valid_timestamp?(data["updated"])

  ARRAY_FIELDS.each do |field|
    value = data[field]
    error("#{rel}: #{field} must be an array") unless value.is_a?(Array)
    if value.is_a?(Array) && value.any? { |item| !item.is_a?(String) || item.strip.empty? }
      error("#{rel}: #{field} entries must be non-empty strings")
    end
  end
  error("#{rel}: sources must not be empty") if data["sources"].is_a?(Array) && data["sources"].empty?

  expected = expected_type(rel)
  error("#{rel}: path requires type #{expected.inspect}, found #{data['type'].inspect}") if expected && data["type"] != expected

  if data["type"] == "draft"
    error("#{rel}: drafts must have status: draft") unless data["status"] == "draft"
  end

  if data["type"] == "session_export"
    error("#{rel}: session exports must be restricted") unless data["privacy"] == "restricted"
    error("#{rel}: session exports must be archived") unless data["status"] == "archived"
  end

  if data["type"] == "idea"
    expected_kind = if rel.match?(%r{\Aideas/research/[^/]+\.md\z})
      "research"
    elsif rel.match?(%r{\Aideas/projects/[^/]+\.md\z})
      "project"
    end
    error("#{rel}: idea path must be ideas/research/<slug>.md or ideas/projects/<slug>.md") unless expected_kind
    error("#{rel}: invalid idea_kind #{data['idea_kind'].inspect}") unless IDEA_KINDS.include?(data["idea_kind"])
    if expected_kind && data["idea_kind"] != expected_kind
      error("#{rel}: path requires idea_kind #{expected_kind.inspect}, found #{data['idea_kind'].inspect}")
    end
    error("#{rel}: ideas must have status: draft or archived") unless %w[draft archived].include?(data["status"])
    headings = content.lines.map(&:chomp)
    required_headings = if data["idea_kind"] == "research"
      ["# Project Title", "# Project Description", "# What kind of help do you need from an advisor?"]
    else
      ["# Problem", "# Product direction", "# First validation", "# Current boundary"]
    end
    required_headings.each do |heading|
      error("#{rel}: missing required heading #{heading}") unless headings.include?(heading)
    end
  end

  return unless data["type"] == "journal"

  match = rel.match(%r{\Ajournal/(\d{4})/(\d{4}-\d{2}-\d{2})-})
  unless match
    error("#{rel}: journal path must be journal/YYYY/YYYY-MM-DD-<slug>.md")
    return
  end
  error("#{rel}: journal date must match filename") unless data["date"].to_s == match[2]
  error("#{rel}: journal year must match date") unless match[1] == match[2][0, 4]
end

def validate_skill(skill_dir)
  name = File.basename(skill_dir)
  skill_file = File.join(skill_dir, "SKILL.md")
  unless File.file?(skill_file)
    error("skills/#{name}: missing SKILL.md")
    return
  end
  rel = relative(skill_file)
  content = File.binread(skill_file).force_encoding("UTF-8")
  data = parse_frontmatter(content, rel)
  return unless data

  error("#{rel}: skill name must match directory") unless data["name"] == name
  description = data["description"]
  error("#{rel}: description must be a non-empty string") unless description.is_a?(String) && !description.strip.empty?
  error("#{rel}: unfinished scaffold marker") if content.include?("[TODO")

  openai_file = File.join(skill_dir, "agents", "openai.yaml")
  return unless File.file?(openai_file)

  begin
    config = Psych.safe_load(File.read(openai_file), permitted_classes: [], aliases: false)
    policy = config.is_a?(Hash) ? config["policy"] : nil
    if policy && ![true, false].include?(policy["allow_implicit_invocation"])
      error("#{relative(openai_file)}: allow_implicit_invocation must be boolean")
    end
    if name == "session-import" && (!policy || policy["allow_implicit_invocation"] != true)
      error("#{relative(openai_file)}: session-import must load for explicit natural-language import/export requests")
    end
  rescue StandardError => e
    error("#{relative(openai_file)}: invalid YAML (#{e.class})")
  end
end

unless File.directory?(ROOT)
  warn "validation root does not exist: #{ROOT}"
  exit 2
end

ids = {}
case_paths = {}
symlinks = []

Find.find(ROOT) do |path|
  rel = relative(path)
  next if rel.empty?

  stat = File.lstat(path)
  if stat.directory?
    if rel == ".git" || rel.start_with?(".git/")
      Find.prune
    elsif forbidden_path?(rel)
      error("#{rel}: forbidden path")
      Find.prune
    end
    next
  end

  error("#{rel.inspect}: path contains a newline or carriage return") if rel.match?(/[\r\n]/)
  folded = rel.downcase
  error("#{rel}: case-insensitive path collision with #{case_paths[folded]}") if case_paths.key?(folded)
  case_paths[folded] = rel

  if stat.symlink?
    symlinks << rel
    target = File.readlink(path)
    error("#{rel}: only CLAUDE.md -> AGENTS.md is allowed") unless rel == "CLAUDE.md" && target == "AGENTS.md"
    next
  end

  error("#{rel}: forbidden tracked path") if forbidden_path?(rel)
  next unless stat.file?

  bytes = File.binread(path)
  error("#{rel}: NUL byte/binary content is not allowed") if bytes.include?("\x00")
  if TEXT_EXTENSIONS.include?(File.extname(rel)) && !bytes.empty? && !bytes.end_with?("\n")
    error("#{rel}: text file must end with a newline")
  end
  has_bom = bytes.byteslice(0, 3) == [0xEF, 0xBB, 0xBF].pack("C*")
  has_controls = bytes.each_byte.any? { |byte| (1..8).include?(byte) || [11, 12].include?(byte) || (14..31).include?(byte) }
  if has_bom || has_controls
    error("#{rel}: BOM or control characters are not allowed")
  end

  content = bytes.force_encoding("UTF-8")
  unless content.valid_encoding?
    error("#{rel}: invalid UTF-8")
    next
  end
  validate_knowledge(rel, content, ids) if knowledge_file?(rel)
end

error("CLAUDE.md: required symlink is missing") unless SCAFFOLD || symlinks.include?("CLAUDE.md")

index_file = File.join(ROOT, "INDEX.md")
summary_file = File.join(ROOT, "profile", "summary.md")
error("INDEX.md: missing") unless File.file?(index_file)
error("profile/summary.md: missing") unless File.file?(summary_file)
error("INDEX.md: exceeds 4096 bytes") if File.file?(index_file) && File.size(index_file) > 4096
error("profile/summary.md: exceeds 6144 bytes") if File.file?(summary_file) && File.size(summary_file) > 6144

Dir.glob(File.join(ROOT, "skills", "*"), File::FNM_DOTMATCH).sort.each do |skill_dir|
  next unless File.directory?(skill_dir)
  next if %w[. ..].include?(File.basename(skill_dir))

  validate_skill(skill_dir)
end

if ERRORS.empty?
  puts "validate: OK (#{ids.length} knowledge files)"
  exit 0
end

ERRORS.sort.each { |message| warn "validate: #{message}" }
warn "validate: FAILED (#{ERRORS.length} errors)"
exit 1
