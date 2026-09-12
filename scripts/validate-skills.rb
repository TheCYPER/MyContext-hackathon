#!/usr/bin/env ruby
# frozen_string_literal: true
require "psych"
root = ARGV.fetch(0)
files = Dir.glob(File.join(root, "skills", "*", "SKILL.md")).sort
abort "skills: none found" if files.empty?
files.each do |file|
  text = File.read(file)
  abort "skills: missing frontmatter #{file}" unless text.start_with?("---\n") && text.include?("\n---\n")
  data = Psych.safe_load(text.split("\n---\n", 2).first.delete_prefix("---\n"), aliases: false)
  name = File.basename(File.dirname(file))
  abort "skills: invalid name #{file}" unless data["name"] == name && name.match?(/\A[a-z0-9-]{1,64}\z/)
  abort "skills: missing description #{file}" unless data["description"].is_a?(String) && !data["description"].strip.empty?
  abort "skills: unfinished scaffold #{file}" if text.include?("[TODO")
  ui = File.join(File.dirname(file), "agents", "openai.yaml")
  Psych.safe_load(File.read(ui), aliases: false) if File.file?(ui)
end
puts "skills: OK (#{files.length} entrypoints)"
