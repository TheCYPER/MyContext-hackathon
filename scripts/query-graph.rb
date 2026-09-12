#!/usr/bin/env ruby
# frozen_string_literal: true

require "date"
require "json"
require "open3"
require "optparse"
require "pathname"
require "rbconfig"

module MyContextGraphQuery
  class InvalidInput < StandardError; end

  PROJECTOR = File.expand_path("../dashboard/projector.rb", __dir__)
  DIRECTIONS = %w[outgoing incoming both].freeze
  DEFAULT_MAX_HOPS = 3
  MAX_PATH_HOPS = 6

  def self.parse_date(value)
    return Date.today unless value
    raise InvalidInput, "--as-of must use YYYY-MM-DD" unless value.match?(/\A\d{4}-\d{2}-\d{2}\z/)
    date = Date.iso8601(value)
    raise InvalidInput, "--as-of must use YYYY-MM-DD" unless date.iso8601 == value
    date
  rescue Date::Error
    raise InvalidInput, "--as-of must use YYYY-MM-DD"
  end

  def self.resolve_root(explicit)
    configured = explicit || [ENV["MY_CONTEXT_ROOT"], ENV["MYCONTEXT_ROOT"]]
      .find { |value| value && !value.empty? }
    raise InvalidInput, "select a context with --root or MY_CONTEXT_ROOT" unless configured
    raise InvalidInput, "context root must be an absolute path" unless Pathname.new(configured).absolute?
    root = File.realpath(configured)
    raise InvalidInput, "context root must be a directory" unless File.directory?(root)
    root
  rescue Errno::ENOENT, Errno::EACCES
    raise InvalidInput, "context root must be an accessible directory"
  end

  def self.projection(root)
    stdout, stderr, status = Open3.capture3(RbConfig.ruby, PROJECTOR, root)
    unless status.success?
      detail = stderr.to_s.lines.first.to_s.strip.sub(/\Aprojector:\s*/, "")
      raise InvalidInput, "projection failed#{detail.empty? ? '' : ": #{detail}"}"
    end
    document = JSON.parse(stdout)
    raise InvalidInput, "projector returned an unsupported schema" unless document["schemaVersion"] == 5
    document
  rescue JSON::ParserError
    raise InvalidInput, "projector returned invalid JSON"
  end

  def self.visible_node?(node, options)
    return false if node["privacy"] == "restricted"
    return false if node["status"] == "archived" && !options[:include_archived]
    draft = node["type"] == "draft" || node["status"] == "draft"
    return false if draft && !options[:include_drafts]
    true
  end

  def self.active_edge?(edge, as_of)
    valid_from = edge["validFrom"]
    valid_to = edge["validTo"]
    return false if valid_from && Date.iso8601(valid_from) > as_of
    return false if valid_to && Date.iso8601(valid_to) < as_of
    true
  rescue Date::Error
    false
  end

  def self.visible_edge?(edge, options, as_of, nodes_by_id)
    return false if edge["privacy"] == "restricted"
    return false unless nodes_by_id.key?(edge["from"]) && nodes_by_id.key?(edge["to"])
    return false unless active_edge?(edge, as_of)
    return false if options[:predicate] && edge["kind"] != options[:predicate]
    return false if edge["evidence"] == "inference" && !options[:include_inference]

    case edge["semanticStatus"]
    when "typed"
      review = edge["review"]
      return false if review == "rejected" && !options[:include_rejected]
      return false if review == "unreviewed" && !options[:include_unreviewed]
      review == "confirmed" || review == "unreviewed" || review == "rejected"
    when "untyped"
      options[:include_legacy]
    else
      false
    end
  end

  def self.traversals(edges, direction)
    steps = []
    edges.each do |edge|
      if direction == "outgoing" || direction == "both"
        steps << { "from" => edge["from"], "to" => edge["to"],
          "direction" => "outgoing", "edgeId" => edge["id"] }
      end
      if direction == "incoming" || direction == "both"
        steps << { "from" => edge["to"], "to" => edge["from"],
          "direction" => "incoming", "edgeId" => edge["id"] }
      end
    end
    steps.sort_by { |step| [step["from"], step["to"], step["edgeId"], step["direction"]] }
  end

  def self.common_output(projection, as_of, options)
    {
      "schemaVersion" => projection["schemaVersion"],
      "revision" => projection["revision"],
      "canonicalSource" => projection.dig("repo", "canonicalSource"),
      "predicateRegistry" => projection.dig("graph", "predicateRegistry"),
      "asOf" => as_of.iso8601,
      "filters" => {
        "direction" => options[:direction], "predicate" => options[:predicate],
        "includeUnreviewed" => !!options[:include_unreviewed],
        "includeInference" => !!options[:include_inference],
        "includeRejected" => !!options[:include_rejected],
        "includeLegacy" => !!options[:include_legacy],
        "includeDrafts" => !!options[:include_drafts],
        "includeArchived" => !!options[:include_archived],
        "restricted" => "always-excluded"
      },
      "interpretation" => "A path reports recorded assertions; it does not infer a transitive semantic claim."
    }
  end

  def self.prepare(projection, options, as_of)
    nodes = projection.fetch("graph").fetch("nodes").select { |node| visible_node?(node, options) }
      .sort_by { |node| node["id"] }
    nodes_by_id = nodes.to_h { |node| [node["id"], node] }
    edges = projection.fetch("graph").fetch("edges")
      .select { |edge| visible_edge?(edge, options, as_of, nodes_by_id) }
      .sort_by { |edge| [edge["from"], edge["to"], edge["kind"], edge["id"]] }
    [nodes_by_id, edges]
  rescue KeyError, NoMethodError
    raise InvalidInput, "projector returned an invalid graph"
  end

  def self.neighbors(projection, id, options, as_of)
    nodes_by_id, edges = prepare(projection, options, as_of)
    raise InvalidInput, "unknown or filtered node: #{id}" unless nodes_by_id.key?(id)
    steps = traversals(edges, options[:direction])
    steps_by_from = steps.group_by { |step| step["from"] }
    distances = { id => 0 }
    frontier = [id]
    options[:depth].times do
      next_frontier = []
      frontier.sort.each do |current|
        (steps_by_from[current] || []).each do |step|
          next if distances.key?(step["to"])
          distances[step["to"]] = distances[current] + 1
          next_frontier << step["to"]
        end
      end
      frontier = next_frontier.uniq.sort
      break if frontier.empty?
    end
    included = distances.keys.to_h { |node_id| [node_id, true] }
    evidence_edge_ids = {}
    steps.each do |step|
      if included[step["from"]] && included[step["to"]] &&
          distances[step["from"]] < options[:depth]
        evidence_edge_ids[step["edgeId"]] = true
      end
    end
    evidence_edges = edges.select { |edge| evidence_edge_ids[edge["id"]] }
    result_nodes = distances.keys.sort_by { |node_id| [distances[node_id], node_id] }.map do |node_id|
      nodes_by_id.fetch(node_id).merge("distance" => distances.fetch(node_id))
    end
    common_output(projection, as_of, options).merge(
      "command" => "neighbors", "startId" => id, "depth" => options[:depth],
      "nodes" => result_nodes, "edges" => evidence_edges,
      "counts" => { "nodes" => result_nodes.length, "edges" => evidence_edges.length }
    )
  end

  def self.path(projection, start_id, target_id, options, as_of)
    nodes_by_id, edges = prepare(projection, options, as_of)
    [start_id, target_id].each do |id|
      raise InvalidInput, "unknown or filtered node: #{id}" unless nodes_by_id.key?(id)
    end
    edge_by_id = edges.to_h { |edge| [edge["id"], edge] }
    steps_by_from = traversals(edges, options[:direction]).group_by { |step| step["from"] }
    previous = {}
    distance = { start_id => 0 }
    frontier = [start_id]
    until frontier.empty? || distance.key?(target_id)
      next_frontier = []
      frontier.sort.each do |current|
        next if distance[current] >= options[:max_hops]
        (steps_by_from[current] || []).each do |step|
          next if distance.key?(step["to"])
          distance[step["to"]] = distance[current] + 1
          previous[step["to"]] = step
          next_frontier << step["to"]
        end
      end
      frontier = next_frontier.uniq.sort
    end

    found = distance.key?(target_id)
    path_steps = []
    if found
      cursor = target_id
      while cursor != start_id
        step = previous.fetch(cursor)
        path_steps << step
        cursor = step["from"]
      end
      path_steps.reverse!
    end
    node_ids = found ? [start_id] + path_steps.map { |step| step["to"] } : []
    detailed_steps = path_steps.map { |step| step.merge("edge" => edge_by_id.fetch(step["edgeId"])) }
    common_output(projection, as_of, options).merge(
      "command" => "path", "startId" => start_id, "targetId" => target_id,
      "maxHops" => options[:max_hops], "found" => found,
      "hopCount" => found ? path_steps.length : nil,
      "nodeIds" => node_ids, "nodes" => node_ids.map { |id| nodes_by_id.fetch(id) },
      "edgeIds" => path_steps.map { |step| step["edgeId"] }, "steps" => detailed_steps
    )
  end

  def self.human_output(result)
    if result["command"] == "neighbors"
      result["nodes"].each do |node|
        puts [node["distance"], node["id"], node["type"], node["path"]].join("\t")
      end
    elsif !result["found"]
      puts "no path within #{result['maxHops']} hops"
    else
      puts result["nodeIds"].join(" -> ")
      result["steps"].each do |step|
        edge = step["edge"]
        puts [edge["id"], edge["kind"], edge["review"], edge["evidence"], edge["sourcePath"]].join("\t")
      end
    end
  end

  def self.run(argv)
    options = { depth: 1, max_hops: DEFAULT_MAX_HOPS, direction: "both", json: false }
    parser = OptionParser.new do |opts|
      opts.banner = "Usage: query-graph.sh [options] neighbors ID\n       query-graph.sh [options] path START TARGET"
      opts.on("--root PATH", "Absolute path to a context Git repository") { |value| options[:root] = value }
      opts.on("--depth N", Integer, "Neighbor depth, 1 through 3 (default: 1)") { |value| options[:depth] = value }
      opts.on("--max-hops N", Integer, "Path limit, 1 through #{MAX_PATH_HOPS} (default: #{DEFAULT_MAX_HOPS})") { |value| options[:max_hops] = value }
      opts.on("--direction VALUE", DIRECTIONS, "outgoing, incoming, or both (default: both)") { |value| options[:direction] = value }
      opts.on("--predicate VALUE", "Only traverse this exact relation predicate") { |value| options[:predicate] = value }
      opts.on("--as-of YYYY-MM-DD", "Evaluate relation validity on this date") { |value| options[:as_of] = value }
      %i[unreviewed inference rejected legacy drafts archived].each do |kind|
        opts.on("--include-#{kind}", "Include #{kind.to_s.tr('_', ' ')} graph data") { options["include_#{kind}".to_sym] = true }
      end
      opts.on("--json", "Return structured evidence as JSON") { options[:json] = true }
      opts.on("-h", "--help", "Show this help") { puts opts; return 0 }
    end
    parser.parse!(argv)
    command = argv.shift
    case command
    when "neighbors"
      raise InvalidInput, parser.banner unless argv.length == 1
    when "path"
      raise InvalidInput, parser.banner unless argv.length == 2
    else
      raise InvalidInput, parser.banner
    end
    raise InvalidInput, "--depth must be between 1 and 3" unless (1..3).cover?(options[:depth])
    unless (1..MAX_PATH_HOPS).cover?(options[:max_hops])
      raise InvalidInput, "--max-hops must be between 1 and #{MAX_PATH_HOPS}"
    end
    as_of = parse_date(options[:as_of])
    root = resolve_root(options[:root])
    projection = projection(root)
    if options[:predicate]
      predicates = projection.dig("graph", "predicateRegistry")
      allowed = predicates.is_a?(Hash) ? predicates.keys + ["related_to"] : ["related_to"]
      raise InvalidInput, "unknown predicate: #{options[:predicate]}" unless allowed.include?(options[:predicate])
    end
    result = command == "neighbors" ? neighbors(projection, argv[0], options, as_of) :
      path(projection, argv[0], argv[1], options, as_of)
    options[:json] ? puts(JSON.pretty_generate(result)) : human_output(result)
    0
  rescue OptionParser::ParseError, InvalidInput, SystemCallError, IOError => e
    warn "query-graph: #{e.message}"
    2
  end
end

exit MyContextGraphQuery.run(ARGV) if $PROGRAM_NAME == __FILE__
