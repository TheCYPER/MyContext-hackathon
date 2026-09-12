# frozen_string_literal: true

# The same bounded scanner is used for source-tree checks and capture candidates.
# Findings contain rule names and line numbers, never matched secret values.
module MyContextSecrets
  RULES = {
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
  PLACEHOLDER = /(?:example|placeholder|replace[-_ ]?me|redacted|dummy|sample|<[^>]+>|\*{4,})/i
  ASSIGNMENT = /\b(password|passwd|api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret)\b\s*[:=]\s*["']?([^\s"'`,;]{12,})/i

  def self.findings(text)
    results = []
    text.each_line.with_index(1) do |line, number|
      RULES.each { |rule, pattern| results << [rule, number] if line.match?(pattern) }
      line.scan(ASSIGNMENT) do |_name, value|
        results << ["generic-secret-assignment", number] unless value.match?(PLACEHOLDER)
      end
    end
    results.uniq.sort
  end
end
