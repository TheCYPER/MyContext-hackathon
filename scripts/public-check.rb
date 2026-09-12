#!/usr/bin/env ruby
# frozen_string_literal: true
require "find"
require "psych"
require "date"
require "time"
require "uri"

def public_web_source?(source)
  return false unless source.is_a?(String) && source.start_with?("web:https://")
  url = URI.parse(source.delete_prefix("web:"))
  url.is_a?(URI::HTTPS) && url.host && !url.host.empty? && url.userinfo.nil?
rescue URI::InvalidURIError
  false
end

def duplicate_yaml_keys?(node)
  return false unless node.respond_to?(:children) && node.children
  if node.is_a?(Psych::Nodes::Mapping)
    names = node.children.each_slice(2).map { |key, _value| key.respond_to?(:value) ? key.value : key.to_s }
    return true if names.uniq.length != names.length
  end
  node.children.any? { |child| duplicate_yaml_keys?(child) }
end

root = File.expand_path(ARGV.fetch(0))
allowed_dirs = %w[dashboard scripts skills templates examples meta docs tests .github .githooks]
allowed_files = %w[README.md AGENTS.md CLAUDE.md CONTRIBUTING.md SECURITY.md LICENSE .gitignore package.json package-lock.json]
errors = []
Find.find(root) do |path|
  rel = path.delete_prefix(root + "/")
  next if path == root
  Find.prune if rel == ".git" && File.directory?(path)
  first = rel.split("/").first
  unless allowed_dirs.include?(first) || allowed_files.include?(rel)
    errors << "unexpected public path: #{rel}"
    File.directory?(path) ? Find.prune : next
  end
  if File.symlink?(path)
    unless ["CLAUDE.md", "templates/context/CLAUDE.md", "examples/demo/CLAUDE.md"].include?(rel) && File.readlink(path) == "AGENTS.md"
      errors << "unexpected symlink: #{rel}"
    end
    next
  end
  next if File.directory?(path)
  if rel.match?(%r{(?:\A|/)(?:\.env(?:\..*)?|auth\.json|id_rsa|id_ed25519|\.DS_Store)$}) || rel.match?(/\.(?:jsonl|sqlite3?|db|pem|key|p12|pfx)$/i)
    errors << "forbidden public file: #{rel}"
    next
  end
  data = File.binread(path)
  if data.include?("\0") || !data.dup.force_encoding("UTF-8").valid_encoding?
    errors << "binary or non-UTF-8 public file needs explicit review: #{rel}"
    next
  end
  text = data.force_encoding("UTF-8")
  errors << "machine-specific home path: #{rel}" if text.match?(%r{/(?:Users|home)/[A-Za-z0-9_.-]+/})
  if rel.start_with?("examples/demo/", "templates/context/") && text.start_with?("---\n")
    begin
      yaml = text.split("\n---\n", 2).first.delete_prefix("---\n")
      errors << "duplicate distributed frontmatter key: #{rel}" if duplicate_yaml_keys?(Psych.parse_stream(yaml))
      meta = Psych.safe_load(yaml, permitted_classes: [Date, Time], aliases: false)
      sources = meta.is_a?(Hash) && meta["sources"]
      if rel.start_with?("templates/context/")
        errors << "non-blank source in distributed template: #{rel}" unless sources == ["template:blank"]
      elsif meta.is_a?(Hash) && meta["demo_kind"] == "fictional"
        errors << "non-fictional source in fictional demo record: #{rel}" unless sources == ["demo:fictional"]
      elsif meta.is_a?(Hash) && meta["demo_kind"] == "public_reference"
        unless %w[person resource].include?(meta["type"]) && meta["privacy"] == "public" && meta["status"] == "active"
          errors << "public reference requires a public, active person or resource: #{rel}"
        end
        web_sources = sources.is_a?(Array) ? sources.reject { |source| source == "demo:public-reference" } : []
        unless sources.is_a?(Array) && sources.count("demo:public-reference") == 1 && !web_sources.empty? && web_sources.all? { |source| public_web_source?(source) }
          errors << "public reference requires demo:public-reference and HTTPS web sources only: #{rel}"
        end
      else
        errors << "demo record must declare demo_kind: fictional or public_reference: #{rel}"
      end
    rescue Psych::Exception
      errors << "invalid distributed frontmatter: #{rel}"
    end
  end
end
abort errors.join("\n") unless errors.empty?
puts "public-check: OK (allowlisted source paths, fictional demo facts, and attributed public references)"
