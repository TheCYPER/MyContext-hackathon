#!/usr/bin/env ruby
# frozen_string_literal: true

require "digest"
require "json"
require "optparse"
require "tempfile"
require_relative "context_binding"

module MyContextGlobalSkill
  class Error < StandardError; end

  def self.check_parents(path)
    current = File.dirname(path)
    loop do
      raise Error, "refusing symbolic-link install parent: #{current}" if File.symlink?(current)
      if File.exist?(current) && !File.directory?(current)
        raise Error, "install parent is not a directory: #{current}"
      end
      break if File.dirname(current) == current
      current = File.dirname(current)
    end
  end

  def self.remember(created, path, type, expected = nil)
    stat = File.lstat(path)
    created << { path: path, type: type, device: stat.dev, inode: stat.ino, expected: expected }
  end

  def self.make_parents(path, created)
    missing = []
    current = File.dirname(path)
    until File.exist?(current) || File.symlink?(current)
      missing.unshift(current)
      current = File.dirname(current)
    end
    check_parents(path)
    missing.each do |directory|
      Dir.mkdir(directory, 0o700)
      remember(created, directory, :directory)
    end
  end

  def self.rollback(created)
    created.reverse_each do |item|
      path = item[:path]
      next unless File.exist?(path) || File.symlink?(path)
      stat = File.lstat(path)
      next unless stat.dev == item[:device] && stat.ino == item[:inode]
      case item[:type]
      when :link
        File.unlink(path) if File.symlink?(path) && File.readlink(path) == item[:expected]
      when :config
        File.unlink(path) if File.file?(path) && !File.symlink?(path) &&
          Digest::SHA256.file(path).hexdigest == item[:expected]
      when :directory
        Dir.rmdir(path) if File.directory?(path) && !File.symlink?(path) && Dir.empty?(path)
      end
    rescue SystemCallError
      # Never replace or recursively remove user-owned data during rollback.
      next
    end
  end

  def self.install(context:, config_path:, skills_dirs:)
    config = MyContextBinding.config_path(config_path)
    identity = MyContextBinding.resolve(root: context, config_path: config)
    source = MyContextBinding.app_root
    skill = File.join(source, "skills", "my-context")
    unless File.file?(File.join(skill, "SKILL.md")) && File.realpath(skill) == skill
      raise Error, "application my-context skill is unavailable or redirected"
    end
    binding = { "version" => MyContextBinding::VERSION, "app_root" => source,
      "context_root" => identity[:context_root], "git_dir" => identity[:git_dir], "state_dir" => identity[:state_dir] }
    targets = skills_dirs.map { |dir| File.join(MyContextBinding.absolute_path(dir, "skills directory"), "my-context") }.uniq
    destinations = [config, *targets]
    if destinations.combination(2).any? { |a, b| MyContextBinding.within?(a, b) || MyContextBinding.within?(b, a) }
      raise Error, "binding and skill destinations must not overlap"
    end
    destinations.each { |path| check_parents(path) }
    config_present = File.exist?(config) || File.symlink?(config)
    if config_present
      unless !File.symlink?(config) && File.file?(config) && MyContextBinding.read_config(config) == binding
        raise Error, "conflicting binding config; preserve or explicitly remove it before installing"
      end
    end
    targets.each do |target|
      if File.symlink?(target)
        resolved = File.realpath(target) rescue nil
        raise Error, "conflicting global skill: #{target}" unless resolved == skill
      elsif File.exist?(target)
        raise Error, "refusing to overwrite global skill: #{target}"
      end
    end
    created = []
    begin
      targets.each do |target|
        if File.symlink?(target)
          resolved = File.realpath(target) rescue nil
          raise Error, "global skill changed during installation: #{target}" unless resolved == skill
          next
        end
        make_parents(target, created)
        check_parents(target)
        File.symlink(skill, target)
        remember(created, target, :link, skill)
      end
      unless config_present
        make_parents(config, created)
        check_parents(config)
        content = JSON.pretty_generate(binding) + "\n"
        Tempfile.create([".mycontext-binding-", ".json"], File.dirname(config)) do |temporary|
          temporary.chmod(0o600)
          temporary.write(content)
          temporary.flush
          temporary.fsync
          # Linking a completed temporary file publishes atomically and refuses
          # a concurrent destination, unlike a replacing rename.
          File.link(temporary.path, config)
          remember(created, config, :config, Digest::SHA256.hexdigest(content))
        end
      end
      unless MyContextBinding.read_config(config) == binding
        raise Error, "binding changed during installation"
      end
      { binding: binding, config_path: config, installed: targets }
    rescue StandardError
      rollback(created)
      raise
    end
  end

  def self.run(argv, output: $stdout, error: $stderr)
    options = { skills_dirs: [] }
    parser = OptionParser.new do |opts|
      opts.banner = "Usage: install-global-skill.sh --context ABS [--config ABS] [--skills-dir ABS ...]"
      opts.on("--context PATH") { |value| options[:context] = value }
      opts.on("--config PATH") { |value| options[:config_path] = value }
      opts.on("--skills-dir PATH") { |value| options[:skills_dirs] << value }
      opts.on("-h", "--help") { output.puts(opts); return 0 }
    end
    parser.parse!(argv)
    raise Error, parser.banner unless options[:context] && argv.empty?
    if options[:skills_dirs].empty?
      options[:skills_dirs] = %w[.agents .claude].map { |client| File.join(Dir.home, client, "skills") }
    end
    result = install(context: options[:context], config_path: options[:config_path], skills_dirs: options[:skills_dirs])
    output.puts("install-global-skill: OK (my-context only; bound to #{result[:binding]['context_root']})")
    output.puts("Binding: #{result[:config_path]}")
    result[:installed].each { |path| output.puts("Skill: #{path}") }
    0
  rescue Error, MyContextBinding::Error, OptionParser::ParseError, SystemCallError => e
    error.puts("install-global-skill: #{e.message}")
    2
  end
end

exit MyContextGlobalSkill.run(ARGV) if $PROGRAM_NAME == __FILE__
