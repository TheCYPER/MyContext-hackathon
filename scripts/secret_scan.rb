#!/usr/bin/env ruby
# frozen_string_literal: true

require "find"

root = File.expand_path(ARGV[0] || File.join(__dir__, ".."))
findings = []

require_relative "secret_patterns"

Find.find(root) do |path|
  rel = path.sub(%r{\A#{Regexp.escape(root)}/?}, "")
  if File.directory?(path)
    Find.prune if rel == ".git" || rel.start_with?(".git/") || rel == ".gstack" || rel.start_with?(".gstack/")
    next
  end
  next unless File.file?(path)

  bytes = File.binread(path)
  next if bytes.include?("\x00")

  text = bytes.force_encoding("UTF-8")
  next unless text.valid_encoding?

  MyContextSecrets.findings(text).each { |rule, number| findings << [rule, rel, number] }
end

if findings.empty?
  puts "secret-scan: OK"
  exit 0
end

findings.uniq.sort.each do |rule, rel, number|
  warn "secret-scan: #{rule} #{rel}:#{number}"
end
warn "secret-scan: FAILED (#{findings.uniq.length} findings; values redacted)"
exit 1
