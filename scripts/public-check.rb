#!/usr/bin/env ruby
# frozen_string_literal: true
require "find"
require "psych"
require "date"
require "time"
require "zlib"
require "cgi"

# Binary approval is tied to specific, reviewed demo screenshots, not a directory.
def reviewed_png?(data)
  return false unless data.start_with?("\x89PNG\r\n\x1a\n".b) && data.bytesize >= 33
  return false unless data.byteslice(8, 8) == [13].pack("N") + "IHDR"
  width, height = data.byteslice(16, 8).unpack("NN")
  return false unless [width, height].all? { |dimension| dimension.between?(1, 4096) }

  offset = 8
  image_data = false
  while offset + 12 <= data.bytesize
    length = data.byteslice(offset, 4).unpack1("N")
    return false if offset + length + 12 > data.bytesize
    type = data.byteslice(offset + 4, 4)
    return false unless type.match?(/\A[A-Za-z]{4}\z/)
    return false if type == "IHDR" && offset != 8
    content = data.byteslice(offset + 4, length + 4)
    checksum = data.byteslice(offset + length + 8, 4).unpack1("N")
    return false unless Zlib.crc32(content) == checksum
    image_data = true if type == "IDAT" && length.positive?
    offset += length + 12
    return image_data && length.zero? && offset == data.bytesize if type == "IEND"
  end
  false
end

# A narrow authoring check for our static diagrams, not a general SVG sanitizer.
def active_svg?(text)
  decoded = CGI.unescapeHTML(text)
  return true if decoded.match?(/<!\s*(?:DOCTYPE|ENTITY)\b/i)
  return true if decoded.match?(/<(?:[\w.-]+:)?(?:script|foreignObject|iframe|object|embed)\b/i)
  return true if decoded.match?(/\s(?:[\w.-]+:)?on[a-z]+\s*=/i)
  return true if decoded.match?(/@import\b/i)
  references = decoded.scan(/\b(?:href|src)\s*=\s*["']([^"']*)["']/i).flatten
  references += decoded.scan(/url\(\s*["']?([^\s"')]+)["']?\s*\)/i).flatten
  references.any? { |reference| !reference.strip.start_with?("#") }
end

root = File.expand_path(ARGV.fetch(0))
allowed_dirs = %w[dashboard scripts skills templates examples meta docs tests .github .githooks]
allowed_files = %w[README.md AGENTS.md CLAUDE.md CONTRIBUTING.md SECURITY.md LICENSE .gitignore package.json package-lock.json]
reviewed_screenshots = %w[overview graph project].map { |name| "docs/assets/screenshots/#{name}.png" }
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
  if reviewed_screenshots.include?(rel)
    unless File.size(path) <= 5 * 1024 * 1024 && reviewed_png?(File.binread(path))
      errors << "invalid reviewed PNG (max 5 MiB, dimensions 1–4096): #{rel}"
    end
    next
  end
  data = File.binread(path)
  if data.include?("\0") || !data.dup.force_encoding("UTF-8").valid_encoding?
    errors << "binary or non-UTF-8 public file needs explicit review: #{rel}"
    next
  end
  text = data.force_encoding("UTF-8")
  errors << "machine-specific home path: #{rel}" if text.match?(%r{/(?:Users|home)/[A-Za-z0-9_.-]+/})
  if rel.start_with?("docs/assets/") && rel.end_with?(".svg") && active_svg?(text)
    errors << "active content or external reference in static SVG: #{rel}"
  end
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
