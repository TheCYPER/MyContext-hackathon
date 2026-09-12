#!/usr/bin/env ruby
# frozen_string_literal: true

require "find"

root = File.expand_path(ARGV[0] || File.join(__dir__, ".."))
findings = []

rules = {
  "private-key" => /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/,
  "github-token" => /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
  "openai-token" => /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/,
  "anthropic-token" => /\bsk-ant-[A-Za-z0-9_-]{20,}\b/,
  "aws-access-key" => /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/,
  "slack-token" => /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/,
  "jwt" => /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/,
  "bearer-credential" => /\bBearer\s+[A-Za-z0-9._~+\/-]{20,}\b/i,
  "credential-in-url" => %r{\b[a-z][a-z0-9+.-]*://[^\s/:]+:[^\s/@]{4,}@}i,
  "china-national-id" => /(?<!\d)[1-9]\d{5}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[0-9Xx](?!\d)/,
  "emirates-id" => /(?<!\d)784-?\d{4}-?\d{7}-?\d(?!\d)/
}.freeze

placeholder = /(?:example|placeholder|replace[-_ ]?me|redacted|dummy|sample|<[^>]+>|\*{4,})/i
assignment = /\b(password|passwd|api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret)\b\s*[:=]\s*["']?([^\s"'`,;]{12,})/i

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

  text.each_line.with_index(1) do |line, number|
    rules.each do |rule, pattern|
      findings << [rule, rel, number] if line.match?(pattern)
    end
    line.scan(assignment) do |_name, value|
      findings << ["generic-secret-assignment", rel, number] unless value.match?(placeholder)
    end
  end
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
