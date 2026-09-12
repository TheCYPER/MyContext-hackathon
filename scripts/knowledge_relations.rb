# frozen_string_literal: true

require "date"

# Shared parsing and validation for semantic relationship assertions stored in
# knowledge-file frontmatter. Target existence and endpoint-type checks require
# a complete context and are deliberately exposed as separate helpers.
module KnowledgeRelations
  EVIDENCE = %w[
    artifact first_party user_confirmed external_primary external_secondary inference
  ].freeze
  REVIEWS = %w[unreviewed confirmed rejected].freeze
  PRIVACY = %w[public private restricted].freeze
  ENTITY_TYPES = %w[profile domain experience person project idea journal draft].freeze
  REQUIRED_FIELDS = %w[id predicate target evidence sources review privacy].freeze
  OPTIONAL_FIELDS = %w[valid_from valid_to note].freeze
  ALLOWED_FIELDS = (REQUIRED_FIELDS + OPTIONAL_FIELDS).freeze
  ID_PATTERN = /\Arelation\.[a-z0-9][a-z0-9._-]*\z/
  ENTITY_ID_PATTERN = /\A[a-z0-9][a-z0-9._-]*\z/
  DATE_PATTERN = /\A\d{4}-\d{2}-\d{2}\z/

  PREDICATES = {
    "participates_in" => {
      "label" => "participates in",
      "from" => %w[person profile],
      "to" => %w[project experience domain idea]
    },
    "part_of" => {
      "label" => "part of",
      "from" => %w[project experience idea],
      "to" => %w[project experience domain]
    },
    "about" => {
      "label" => "about",
      "from" => %w[journal draft idea],
      "to" => ENTITY_TYPES
    },
    "motivated_by" => {
      "label" => "motivated by",
      "from" => %w[project idea],
      "to" => %w[project idea experience person journal domain]
    },
    "supports" => {
      "label" => "supports",
      "from" => ENTITY_TYPES,
      "to" => ENTITY_TYPES
    },
    "contradicts" => {
      "label" => "contradicts",
      "from" => ENTITY_TYPES,
      "to" => ENTITY_TYPES
    },
    "supersedes" => {
      "label" => "supersedes",
      "from" => ENTITY_TYPES - %w[profile],
      "to" => ENTITY_TYPES - %w[profile],
      "same_type" => true
    }
  }.freeze

  class ValidationError < StandardError
    attr_reader :errors

    def initialize(errors)
      @errors = errors.freeze
      super(errors.join("; "))
    end
  end

  module_function

  def normalize_relations(data, declared_by: nil, source_path: nil)
    return [] unless data.is_a?(Hash) && (data.key?("relations") || data.key?(:relations))

    raw_relations = data.key?("relations") ? data["relations"] : data[:relations]
    prefix = source_path ? "#{source_path}: " : ""
    unless raw_relations.is_a?(Array)
      raise ValidationError, ["#{prefix}relations must be an array"]
    end

    errors = []
    normalized = raw_relations.each_with_index.map do |raw, index|
      label = "#{prefix}relations[#{index}]"
      unless raw.is_a?(Hash)
        errors << "#{label} must be a mapping"
        next
      end

      relation = raw.to_h { |key, value| [key.to_s, value] }
      unknown = relation.keys - ALLOWED_FIELDS
      errors << "#{label} has unknown fields #{unknown.sort.join(', ')}" unless unknown.empty?
      missing = REQUIRED_FIELDS.reject { |field| relation.key?(field) }
      errors << "#{label} is missing fields #{missing.join(', ')}" unless missing.empty?

      id = relation["id"]
      errors << "#{label}.id must be a stable relation.* ID" unless id.is_a?(String) && id.match?(ID_PATTERN)
      predicate = relation["predicate"]
      errors << "#{label}.predicate is invalid" unless PREDICATES.key?(predicate)
      target = relation["target"]
      unless target.is_a?(String) && target.match?(ENTITY_ID_PATTERN)
        errors << "#{label}.target must be a stable entity ID"
      end
      errors << "#{label}.target must differ from the declaring entity" if declared_by && target == declared_by
      errors << "#{label}.evidence is invalid" unless EVIDENCE.include?(relation["evidence"])
      errors << "#{label}.review is invalid" unless REVIEWS.include?(relation["review"])
      errors << "#{label}.privacy is invalid" unless PRIVACY.include?(relation["privacy"])

      sources = relation["sources"]
      unless sources.is_a?(Array) && !sources.empty? &&
          sources.all? { |source| source.is_a?(String) && !source.strip.empty? }
        errors << "#{label}.sources must be a non-empty array of locator strings"
      end

      note = relation["note"]
      if relation.key?("note") && (!note.is_a?(String) || note.strip.empty?)
        errors << "#{label}.note must be a non-empty string"
      end

      valid_from = normalize_date(relation["valid_from"])
      valid_to = normalize_date(relation["valid_to"])
      if relation.key?("valid_from") && !valid_from
        errors << "#{label}.valid_from must be an ISO date"
      end
      if relation.key?("valid_to") && !valid_to
        errors << "#{label}.valid_to must be an ISO date"
      end
      if valid_from && valid_to && valid_from > valid_to
        errors << "#{label}.valid_from must not be after valid_to"
      end

      normalized_relation = REQUIRED_FIELDS.to_h { |field| [field, relation[field]] }
      normalized_relation["valid_from"] = valid_from if valid_from
      normalized_relation["valid_to"] = valid_to if valid_to
      normalized_relation["note"] = note.strip if note.is_a?(String) && !note.strip.empty?
      normalized_relation
    end.compact

    raise ValidationError, errors unless errors.empty?

    normalized
  end

  def normalize_date(value)
    text = value.is_a?(Date) ? value.iso8601 : value.to_s
    return nil unless text.match?(DATE_PATTERN)

    date = Date.iso8601(text)
    date.iso8601 == text ? text : nil
  rescue ArgumentError
    nil
  end

  def endpoint_error(predicate, from_type:, to_type:, from_id: nil, to_id: nil)
    definition = PREDICATES[predicate]
    return "unknown predicate #{predicate.inspect}" unless definition
    return "#{predicate} cannot start at type #{from_type.inspect}" unless definition["from"].include?(from_type)
    return "#{predicate} cannot target type #{to_type.inspect}" unless definition["to"].include?(to_type)
    if from_id && to_id && from_id == to_id
      return "#{predicate} cannot point to the declaring entity"
    end
    if definition["same_type"] && from_type != to_type
      return "#{predicate} requires matching endpoint types"
    end

    nil
  end

  def endpoint_allowed?(predicate, from_type:, to_type:, from_id: nil, to_id: nil)
    endpoint_error(predicate, from_type: from_type, to_type: to_type,
      from_id: from_id, to_id: to_id).nil?
  end

  def effective_privacy(*values)
    values.compact.max_by { |value| PRIVACY.index(value) || PRIVACY.length } || "public"
  end

  def predicate_registry
    PREDICATES.to_h do |predicate, definition|
      [predicate, {
        "label" => definition["label"],
        "fromTypes" => definition["from"].dup,
        "toTypes" => definition["to"].dup,
        "sameType" => !!definition["same_type"]
      }]
    end
  end
end
