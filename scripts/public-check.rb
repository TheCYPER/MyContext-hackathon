#!/usr/bin/env ruby
# frozen_string_literal: true
require "find"
require "psych"
require "date"
require "time"

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
      meta = Psych.safe_load(text.split("\n---\n", 2).first.delete_prefix("---\n"), permitted_classes: [Date, Time], aliases: false)
      sources = meta.is_a?(Hash) && meta["sources"]
      expected = rel.start_with?("examples/demo/") ? "demo:fictional" : "template:blank"
      errors << "non-synthetic source in distributed context: #{rel}" unless sources == [expected]
      if meta.is_a?(Hash) && meta.key?("relations")
        relations = meta["relations"]
        unless relations.is_a?(Array) && relations.all? { |relation| relation.is_a?(Hash) && relation["sources"] == [expected] }
          errors << "non-synthetic relation source in distributed context: #{rel}"
        end
      end
    rescue Psych::Exception
      errors << "invalid distributed frontmatter: #{rel}"
    end
  end
end
abort errors.join("\n") unless errors.empty?
puts "public-check: OK (allowlisted source paths and synthetic-only distributed context)"
