#!/usr/bin/env ruby
# frozen_string_literal: true
require "fileutils"
require "open3"
source, context = ARGV.map { |p| File.realpath(p) }
abort "install-skills: source is not a personal context" if source == context
%w[AGENTS.md INDEX.md profile/summary.md meta/write-policy.md].each do |rel|
  abort "install-skills: initialize a context first (missing #{rel})" unless File.file?(File.join(context, rel))
end
top, status = Open3.capture2("git", "-C", context, "rev-parse", "--show-toplevel")
abort "install-skills: context must be a standalone Git worktree" unless status.success? && File.realpath(top.strip) == context
skills = Dir.glob(File.join(source, "skills", "*", "SKILL.md")).sort.map { |p| File.dirname(p) }
abort "install-skills: no skills found" if skills.empty?
targets = skills.flat_map do |skill|
  %w[.agents .claude].map { |client| [skill, File.join(context, client, "skills", File.basename(skill))] }
end
# Validate every parent and target before changing anything.
targets.each do |skill, target|
  parent = File.dirname(target)
  until parent == context
    abort "install-skills: refusing symlinked parent #{parent}" if File.symlink?(parent)
    abort "install-skills: parent is not a directory #{parent}" if File.exist?(parent) && !File.directory?(parent)
    parent = File.dirname(parent)
  end
  if File.symlink?(target)
    resolved = File.realpath(target) rescue nil
    abort "install-skills: conflicting skill #{target}" unless resolved == File.realpath(skill)
  elsif File.exist?(target)
    abort "install-skills: refusing to overwrite #{target}"
  end
end
targets.each do |skill, target|
  next if File.symlink?(target)
  FileUtils.mkdir_p(File.dirname(target))
  File.symlink(skill, target)
end
puts "install-skills: OK (#{skills.length} skills, project-scoped in #{context}; global skills unchanged)"
