#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
for REQUIRED_TOOL in ruby git node; do
  if ! command -v "$REQUIRED_TOOL" >/dev/null 2>&1; then
    printf 'setup: %s is required. Install Git 2.28+, Ruby 2.6+, and Node.js 20+, then rerun this command.\n' "$REQUIRED_TOOL" >&2
    exit 1
  fi
done
ruby -e '
  requirements = [["Ruby", RUBY_VERSION, [2, 6]], ["Git", ARGV[0], [2, 28]], ["Node.js", ARGV[1], [20, 0]]]
  requirements.each do |name, reported, minimum|
    match = reported.match(/(\d+)\.(\d+)/)
    actual = match && match.captures.map(&:to_i)
    unless actual && (actual <=> minimum) >= 0
      warn "setup: #{name} #{minimum.join(".")}+ is required (found #{reported.strip}); update it before creating context data."
      exit 1
    end
  end
' "$(git --version)" "$(node --version)"
exec ruby "$SCRIPT_DIR/setup.rb" "$@"
