#!/usr/bin/env ruby
# frozen_string_literal: true

require "date"
require "find"
require "json"
require "optparse"
require "pathname"
require "psych"
require "time"

module MyContextSearch
  CANONICAL_ROOTS = %w[profile experience projects ideas people domains journal].freeze
  TYPES = %w[profile domain experience person project idea journal draft session_export].freeze
  MAX_HEADER_BYTES = 65_536
  FIELD_WEIGHTS = { "id" => 120, "title" => 90, "aliases" => 80, "tags" => 45, "body" => 10 }.freeze

  class InvalidInput < StandardError; end

  def self.duplicate_keys?(node)
    if node.is_a?(Psych::Nodes::Mapping)
      names = node.children.each_slice(2).map do |key, value|
        return true unless key.is_a?(Psych::Nodes::Scalar)
        return true if duplicate_keys?(value)
        key.value
      end
      return names.uniq.length != names.length
    end
    node.respond_to?(:children) && node.children && node.children.any? { |child| duplicate_keys?(child) }
  end

  # Read only the envelope until access filters have accepted this document.
  def self.read_header(io)
    return nil unless io.gets == "---\n"
    yaml = +""
    closed = false
    while (line = io.gets)
      if line == "---\n" || line == "---"
        closed = true
        break
      end
      yaml << line
      return nil if yaml.bytesize > MAX_HEADER_BYTES || !yaml.valid_encoding?
    end
    return nil unless closed
    stream = Psych.parse_stream(yaml)
    return nil if duplicate_keys?(stream)
    data = Psych.safe_load(yaml, permitted_classes: [Date, Time], permitted_symbols: [], aliases: false)
    return nil unless data.is_a?(Hash)
    return nil unless %w[id title type privacy status].all? { |key| data[key].is_a?(String) && !data[key].strip.empty? }
    return nil unless %w[public private restricted].include?(data["privacy"])
    return nil unless %w[active draft archived].include?(data["status"]) && TYPES.include?(data["type"])
    return nil unless data["id"].match?(/\A[a-z0-9][a-z0-9._-]*\z/)
    return nil unless %w[sources aliases tags links].all? do |key|
      data[key].is_a?(Array) && data[key].all? { |value| value.is_a?(String) && !value.strip.empty? }
    end
    return nil if data["sources"].empty?
    updated = data["updated"].respond_to?(:iso8601) ? data["updated"].iso8601 : data["updated"].to_s
    return nil unless updated.match?(/(?:Z|[+-]\d{2}:\d{2})\z/)
    data["updated"] = Time.iso8601(updated).iso8601
    data
  rescue Psych::Exception, ArgumentError
    nil
  end

  def self.safe_path!(root, scope)
    parts = scope.split("/", -1)
    allowed = CANONICAL_ROOTS + ["sources"]
    unless allowed.include?(parts.first) && parts.all? { |part| !part.empty? && !%w[. ..].include?(part) } && !scope.match?(/[\r\n\x00]/)
      raise InvalidInput, "scope must be a relative path inside a canonical root"
    end
    current = root
    parts.each do |part|
      current = File.join(current, part)
      raise InvalidInput, "scope may not traverse a symbolic link" if File.symlink?(current)
    end
    raise InvalidInput, "scope does not exist" unless File.exist?(current)
    actual = File.realpath(current)
    raise InvalidInput, "scope escaped the context root" unless actual.start_with?(root + File::SEPARATOR)
    actual
  end

  def self.candidates(root, scope, options)
    if scope
      path = safe_path!(root, scope)
      if scope.split("/").first == "sources" && !options[:include_sources]
        raise InvalidInput, "--include-sources is required for source scope"
      end
      paths = [path]
    else
      roots = CANONICAL_ROOTS + (options[:include_sources] ? ["sources"] : [])
      paths = roots.map do |name|
        path = File.join(root, name)
        path if File.directory?(path) && !File.symlink?(path)
      end.compact
    end
    paths.flat_map do |start|
      matches = []
      Find.find(start) do |path|
        stat = File.lstat(path)
        if stat.symlink?
          next
        elsif stat.directory?
          Find.prune if File.basename(path).start_with?(".")
        elsif stat.file? && File.extname(path) == ".md"
          relative = Pathname.new(path).relative_path_from(Pathname.new(root)).to_s
          next if relative.match?(/[\r\n]/)
          matches << [path, relative]
        end
      end
      matches
    end.sort_by(&:last)
  end

  def self.rank(data, body, query, terms, path)
    original_fields = {
      "id" => [data["id"]], "title" => [data["title"]],
      "aliases" => data["aliases"], "tags" => data["tags"], "body" => [body]
    }
    fields = original_fields.transform_values { |values| values.map(&:downcase) }
    term_matches = terms.to_h do |term|
      [term, fields.select { |_field, values| values.any? { |value| value.include?(term) } }.keys]
    end
    return nil if term_matches.values.any?(&:empty?)
    exact = fields.select { |_field, values| values.include?(query) }.keys
    phrase = fields.select { |_field, values| values.any? { |value| value.include?(query) } }.keys
    tier, reason = if exact.include?("id")
      [0, "exact id"]
    elsif exact.include?("title") || exact.include?("aliases")
      [1, "exact title or alias"]
    elsif (phrase & %w[id title aliases]).any?
      [2, "id, title, or alias phrase"]
    elsif terms.all? { |term| (term_matches[term] & %w[id title aliases]).any? }
      [3, "all terms in id, title, or aliases"]
    elsif terms.all? { |term| (term_matches[term] & %w[id title aliases tags]).any? }
      [4, "all terms in metadata"]
    elsif phrase.include?("body")
      [5, "body phrase"]
    else
      [6, "all terms across metadata and body"]
    end
    score = term_matches.values.sum { |matched| matched.map { |field| FIELD_WEIGHTS.fetch(field) }.max }
    matched_fields = FIELD_WEIGHTS.keys.select { |field| term_matches.values.any? { |matched| matched.include?(field) } }
    lines = body.lines.map(&:strip).reject(&:empty?)
    prose = lines.reject { |line| line.match?(/\A(?:\#{1,6}\s|```|~~~)/) }
    body_line = prose.find { |line| terms.any? { |term| line.downcase.include?(term) } }
    snippet = (body_line || prose.first || lines.first || data["title"]).gsub(/\s+/, " ")
    snippet = snippet[0, 220] + "…" if snippet.length > 220
    result = data.slice("id", "title", "type", "privacy", "status", "updated", "sources").merge(
      "path" => path, "score" => score, "match_reason" => reason,
      "matched_fields" => matched_fields, "term_matches" => term_matches, "snippet" => snippet
    )
    current_state = data["type"] == "journal" ? 1 : 0
    archived = data["status"] == "archived" ? 1 : 0
    [[tier, -score, archived, current_state, -Time.iso8601(data["updated"]).to_i, path], result]
  end

  def self.run(argv)
    options = { limit: 5, json: false }
    parser = OptionParser.new do |opts|
      opts.banner = "Usage: search-context.sh [options] <query> [scope]"
      opts.on("--root PATH", "Absolute path to a context directory") { |value| options[:root] = value }
      opts.on("--limit N", Integer, "Maximum results (default: 5)") { |value| options[:limit] = value }
      opts.on("--json", "Explain ranked results as JSON") { options[:json] = true }
      %i[restricted sources drafts archived].each do |kind|
        opts.on("--include-#{kind}", "Explicitly allow #{kind} documents") { options["include_#{kind}".to_sym] = true }
      end
      opts.on("-h", "--help", "Show this help") { puts opts; return 0 }
    end
    parser.parse!(argv)
    raise InvalidInput, parser.banner unless (1..2).cover?(argv.length)
    query = argv[0].strip.downcase
    raise InvalidInput, "query must contain non-whitespace text" if query.empty?
    raise InvalidInput, "--limit must be between 1 and 100" unless (1..100).cover?(options[:limit])
    if options[:root] && !Pathname.new(options[:root]).absolute?
      raise InvalidInput, "--root must be an absolute path"
    end
    source_root = File.expand_path("..", File.dirname(File.realpath(__FILE__)))
    configured = options[:root] || [ENV["MY_CONTEXT_ROOT"], ENV["MYCONTEXT_ROOT"]].find { |value| value && !value.empty? } || File.join(source_root, ".local", "demo")
    root = File.realpath(configured)
    raise InvalidInput, "context root must be a directory" unless File.directory?(root)
    terms = query.split(/\s+/).uniq
    ranked = []
    excluded_invalid = 0
    candidates(root, argv[1], options).each do |path, relative|
      next if relative.split("/").include?("drafts") && !options[:include_drafts]
      File.open(path, "r:UTF-8") do |io|
        data = read_header(io)
        unless data
          excluded_invalid += 1
          next
        end
        next if data["privacy"] == "restricted" && !options[:include_restricted]
        next if data["type"] == "session_export" && !options[:include_sources]
        next if (data["type"] == "draft" || data["status"] == "draft") && !options[:include_drafts]
        next if data["status"] == "archived" && !options[:include_archived]
        body = io.read
        unless body.valid_encoding?
          excluded_invalid += 1
          next
        end
        match = rank(data, body, query, terms, relative)
        ranked << match if match
      end
    end
    results = ranked.sort_by(&:first).first(options[:limit]).map(&:last)
    if options[:json]
      puts JSON.pretty_generate("query" => argv[0], "terms" => terms, "scope" => argv[1],
        "limit" => options[:limit], "total_matches" => ranked.length,
        "excluded_invalid" => excluded_invalid, "results" => results)
    else
      results.each { |result| puts result["path"] }
    end
    0
  rescue OptionParser::ParseError, InvalidInput, SystemCallError, IOError => e
    warn "search-context: #{e.message}"
    2
  end
end

exit MyContextSearch.run(ARGV) if $PROGRAM_NAME == __FILE__
