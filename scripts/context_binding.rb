#!/usr/bin/env ruby
# frozen_string_literal: true

require "json"
require "open3"
require "optparse"
require "pathname"

module MyContextBinding
  class Error < StandardError; end

  VERSION = 1
  REQUIRED_FILES = %w[AGENTS.md INDEX.md profile/summary.md meta/schema.md meta/write-policy.md].freeze
  GIT_ENV = {
    "GIT_DIR" => nil, "GIT_WORK_TREE" => nil, "GIT_COMMON_DIR" => nil,
    "GIT_INDEX_FILE" => nil, "GIT_OBJECT_DIRECTORY" => nil,
    "GIT_ALTERNATE_OBJECT_DIRECTORIES" => nil, "GIT_CONFIG_COUNT" => nil,
    "GIT_CONFIG_NOSYSTEM" => "1", "GIT_CONFIG_GLOBAL" => File::NULL,
    "GIT_CONFIG_SYSTEM" => File::NULL, "GIT_OPTIONAL_LOCKS" => "0"
  }.freeze

  def self.app_root
    File.realpath(File.join(__dir__, ".."))
  end

  def self.nonempty(value)
    value unless value.nil? || value.empty?
  end

  def self.absolute_path(value, label)
    unless value.is_a?(String) && !value.empty? && !value.include?("\0") && Pathname.new(value).absolute?
      raise Error, "#{label} must be an absolute path"
    end
    File.expand_path(value)
  end

  def self.config_path(value = nil)
    selected = value || nonempty(ENV["MY_CONTEXT_CONFIG"])
    return absolute_path(selected, "config path") if selected
    base = nonempty(ENV["XDG_CONFIG_HOME"]) || File.join(Dir.home, ".config")
    File.join(absolute_path(base, "configuration directory"), "mycontext", "config.json")
  end

  def self.within?(path, root)
    path == root || path.start_with?(root + File::SEPARATOR)
  end

  # Resolve existing ancestors as well as the leaf, including when state has
  # not been created yet. This prevents a symlink from hiding containment.
  def self.canonical_location(value, label)
    expanded = absolute_path(value, label)
    suffix = []
    ancestor = expanded
    until File.exist?(ancestor) || File.symlink?(ancestor)
      suffix.unshift(File.basename(ancestor))
      ancestor = File.dirname(ancestor)
    end
    resolved = File.realpath(ancestor)
    raise Error, "#{label} has a non-directory parent" if !suffix.empty? && !File.directory?(resolved)
    File.join(resolved, *suffix)
  rescue SystemCallError => e
    raise Error, "#{label} is unavailable (#{e.class.name})"
  end

  def self.git(root, *args)
    output, _error, status = Open3.capture3(GIT_ENV, "git", "-C", root, *args)
    raise Error, "context Git identity is unavailable" unless status.success?
    output.strip
  rescue SystemCallError => e
    raise Error, "Git is unavailable (#{e.class.name})"
  end

  def self.validate_context(value)
    root = File.realpath(absolute_path(value, "context root"))
    raise Error, "context root must be a directory" unless File.directory?(root)
    raise Error, "application source cannot be the personal context" if root == app_root
    REQUIRED_FILES.each do |relative|
      path = File.join(root, relative)
      unless File.file?(path) && within?(File.realpath(path), root)
        raise Error, "context is missing a contained canonical file: #{relative}"
      end
    end
    top = File.realpath(git(root, "rev-parse", "--show-toplevel"))
    raise Error, "context must be its own Git worktree root" unless top == root
    git_dir = File.realpath(git(root, "rev-parse", "--absolute-git-dir"))
    context_common = File.realpath(File.expand_path(git(root, "rev-parse", "--git-common-dir"), root))
    if File.exist?(File.join(app_root, ".git"))
      source_common = File.realpath(File.expand_path(git(app_root, "rev-parse", "--git-common-dir"), app_root))
      raise Error, "context must not share application Git history" if context_common == source_common
    end
    { context_root: root, git_dir: git_dir }
  rescue SystemCallError => e
    raise Error, "context root is unavailable (#{e.class.name})"
  end

  def self.read_config(path)
    raise Error, "binding config must not be a symbolic link" if File.symlink?(path)
    raise Error, "no binding exists; choose an explicit context root or install a binding" unless File.file?(path)
    content = File.read(path, encoding: "UTF-8")
    raise Error, "binding config is not valid UTF-8 JSON" unless content.valid_encoding?
    data = JSON.parse(content)
    unless data.is_a?(Hash) && data["version"] == VERSION &&
        %w[app_root context_root git_dir state_dir].all? { |key| data[key].is_a?(String) && !data[key].empty? }
      raise Error, "binding config has an unsupported or invalid format"
    end
    data
  rescue JSON::ParserError, EncodingError
    raise Error, "binding config is not valid UTF-8 JSON"
  rescue SystemCallError => e
    raise Error, "binding config is unavailable (#{e.class.name})"
  end

  def self.validate_state(value, context_root)
    state = canonical_location(value, "state directory")
    raise Error, "state directory must be a directory" if File.exist?(state) && !File.directory?(state)
    if within?(state, context_root) || within?(state, app_root)
      raise Error, "state directory must be outside the context and application source"
    end
    state
  end

  def self.resolve(root: nil, config_path: nil, state_dir: nil)
    selected_config = self.config_path(config_path)
    selected_root = root || nonempty(ENV["MY_CONTEXT_ROOT"]) || nonempty(ENV["MYCONTEXT_ROOT"])
    binding = nil
    if selected_root.nil?
      binding = read_config(selected_config)
      unless binding["app_root"] == app_root
        raise Error, "binding belongs to a different or moved application source"
      end
      selected_root = binding["context_root"]
    end
    identity = validate_context(selected_root)
    if binding && (binding["context_root"] != identity[:context_root] || binding["git_dir"] != identity[:git_dir])
      raise Error, "bound context identity changed; select and bind it again explicitly"
    end
    selected_state = state_dir || (binding && binding["state_dir"]) || File.join(File.dirname(selected_config), "state")
    identity.merge(state_dir: validate_state(selected_state, identity[:context_root]))
  end

  def self.run(argv, output: $stdout, error: $stderr)
    options = {}
    parser = OptionParser.new do |opts|
      opts.banner = "Usage: context_binding.rb [--root ABS] [--config ABS] [--state-dir ABS]"
      opts.on("--root PATH") { |value| options[:root] = value }
      opts.on("--config PATH") { |value| options[:config_path] = value }
      opts.on("--state-dir PATH") { |value| options[:state_dir] = value }
      opts.on("-h", "--help") { output.puts(opts); return 0 }
    end
    parser.parse!(argv)
    raise Error, parser.banner unless argv.empty?
    output.puts(JSON.generate(resolve(**options)))
    0
  rescue OptionParser::ParseError, Error => e
    error.puts("context-binding: #{e.message}")
    2
  end
end

exit MyContextBinding.run(ARGV) if $PROGRAM_NAME == __FILE__
