#!/usr/bin/env ruby
# frozen_string_literal: true

require "fileutils"
require "digest"
require "json"
require "open3"
require "pathname"

class SetupError < StandardError; end

SOURCE_ROOT = File.realpath(File.join(__dir__, ".."))
FORMAT_VERSION = 1
CANONICAL_DIRS = %w[profile domains projects ideas/research ideas/projects experience people resources journal sources].freeze
GIT_ENV = {
  "GIT_DIR" => nil, "GIT_WORK_TREE" => nil, "GIT_INDEX_FILE" => nil,
  "GIT_COMMON_DIR" => nil, "GIT_OBJECT_DIRECTORY" => nil,
  "GIT_ALTERNATE_OBJECT_DIRECTORIES" => nil,
  "GIT_CONFIG_GLOBAL" => File::NULL, "GIT_CONFIG_NOSYSTEM" => "1",
  "GIT_AUTHOR_NAME" => "MyContext Setup", "GIT_AUTHOR_EMAIL" => "setup@example.invalid",
  "GIT_COMMITTER_NAME" => "MyContext Setup", "GIT_COMMITTER_EMAIL" => "setup@example.invalid"
}.freeze

def git(root, *args)
  output, error, status = Open3.capture3(GIT_ENV, "git", "-c", "core.hooksPath=#{File::NULL}",
    "-c", "commit.gpgsign=false", "-C", root, *args)
  raise SetupError, "git #{args.first} failed: #{error.lines.first.to_s.strip}" unless status.success?
  output.strip
end

def within?(path, parent)
  path == parent || path.start_with?(parent + File::SEPARATOR)
end

def resolved_new_path(path)
  raise SetupError, "use an absolute destination path" unless Pathname.new(path).absolute?
  raise SetupError, "destination contains a control character" if path.match?(/[\x00-\x1f\x7f]/)
  expanded = File.expand_path(path)
  cursor = expanded
  suffix = []
  until File.exist?(cursor) || File.symlink?(cursor)
    suffix.unshift(File.basename(cursor))
    cursor = File.dirname(cursor)
  end
  File.join(File.realpath(cursor), *suffix)
rescue Errno::ENOENT
  raise SetupError, "destination passes through a broken symbolic link"
end

def validate_destination(destination, mode)
  local_root = File.join(SOURCE_ROOT, ".local")
  raise SetupError, "choose a context folder inside .local, not the .local container itself" if destination == local_root
  if %w[demo empty].include?(mode) && destination != File.join(local_root, mode)
    raise SetupError, "the #{mode} location must stay inside the source project's .local folder; remove its symbolic link first"
  end
  if within?(destination, SOURCE_ROOT) && !within?(destination, local_root)
    raise SetupError, "context data cannot be created in the source tree outside .local"
  end
  return if within?(destination, local_root) && destination != local_root

  cursor = File.dirname(destination)
  loop do
    if File.exist?(File.join(cursor, ".git")) || File.symlink?(File.join(cursor, ".git"))
      raise SetupError, "destination is nested inside an existing Git repository; choose a separate folder"
    end
    break if cursor == File.dirname(cursor)
    cursor = File.dirname(cursor)
  end
end

def seed_digest(mode)
  files = {}
  roots = [File.join(SOURCE_ROOT, "templates", "context")]
  roots << File.join(SOURCE_ROOT, "examples", "demo") if mode == "demo"
  roots.each do |root|
    raise SetupError, "required seed folder is missing: #{root}" unless File.directory?(root)
    Dir.glob(File.join(root, "**", "*"), File::FNM_DOTMATCH).sort.each do |path|
      next unless File.file?(path) || File.symlink?(path)
      relative = path.delete_prefix(root + File::SEPARATOR)
      files[relative] = File.symlink?(path) ? "symlink:#{File.readlink(path)}" : Digest::SHA256.file(path).hexdigest
    end
  end
  %w[schema.md write-policy.md].each do |name|
    files["meta/#{name}"] = Digest::SHA256.file(File.join(SOURCE_ROOT, "meta", name)).hexdigest
  end
  Digest::SHA256.hexdigest(JSON.generate([FORMAT_VERSION, mode, CANONICAL_DIRS, files.sort]))
end

def existing_managed_context!(destination, mode)
  marker_path = File.join(destination, ".mycontext-setup.json")
  begin
    marker = JSON.parse(File.read(marker_path))
  rescue Errno::ENOENT, JSON::ParserError, Errno::ENOTDIR
    raise SetupError, "#{mode} destination already exists without a matching setup marker; nothing was changed"
  end
  unless marker.is_a?(Hash) && marker["format"] == FORMAT_VERSION && marker["mode"] == mode &&
      File.directory?(File.join(destination, ".git")) &&
      !File.symlink?(File.join(destination, ".git")) &&
      git(destination, "rev-parse", "--show-toplevel") == destination
    raise SetupError, "existing #{mode} is not an independent setup repository; nothing was changed"
  end
  unless git(destination, "status", "--porcelain=v1", "--untracked-files=normal").empty?
    raise SetupError, "#{mode} has local changes; setup will not overwrite them. Commit or preserve your changes before rerunning"
  end
  git(destination, "rev-parse", "--verify", "HEAD")
  unless marker["seed_sha256"] == seed_digest(mode)
    raise SetupError, "#{mode} seed is out of date or has no version fingerprint. Preserve this folder by moving it to a backup path, then rerun setup to create the current version. Nothing was changed"
  end
  puts "#{mode.capitalize} already exists with the current seed; existing context was preserved: #{destination}"
end

def copy_tree(source, destination)
  raise SetupError, "required scaffold is missing: #{source}" unless File.directory?(source)
  Dir.children(source).sort.each do |entry|
    FileUtils.cp_r(File.join(source, entry), destination, preserve: false)
  end
end

def create_context(destination, mode)
  template = File.join(SOURCE_ROOT, "templates", "context")
  demo = File.join(SOURCE_ROOT, "examples", "demo")
  policies = %w[schema.md write-policy.md].map { |name| File.join(SOURCE_ROOT, "meta", name) }
  raise SetupError, "context template is missing" unless File.directory?(template)
  raise SetupError, "fictional demo is missing" if mode == "demo" && !File.directory?(demo)
  policies.each { |path| raise SetupError, "required policy is missing: #{path}" unless File.file?(path) }

  # Claim only a new directory; never merge setup files into an existing context.
  FileUtils.mkdir_p(File.dirname(destination))
  Dir.mkdir(destination, 0o700)
  begin
    copy_tree(template, destination)
    copy_tree(demo, destination) if mode == "demo"
    CANONICAL_DIRS.each do |relative|
      folder = File.join(destination, relative)
      FileUtils.mkdir_p(folder)
      File.write(File.join(folder, ".gitkeep"), "") if Dir.empty?(folder)
    end
    FileUtils.mkdir_p(File.join(destination, "meta"))
    policies.each { |path| FileUtils.cp(path, File.join(destination, "meta", File.basename(path))) }
    File.symlink("AGENTS.md", File.join(destination, "CLAUDE.md"))
    File.write(File.join(destination, ".mycontext-setup.json"), JSON.pretty_generate({ "format" => FORMAT_VERSION, "mode" => mode, "seed_sha256" => seed_digest(mode) }) + "\n")
    git(destination, "-c", "init.templateDir=", "init", "--initial-branch=main")
    git(destination, "add", "--all")
    git(destination, "commit", "--no-gpg-sign", "-m", mode == "demo" ? "Initialize fictional MyContext demo" : "Initialize blank private context")
    raise SetupError, "setup unexpectedly created a remote" unless git(destination, "remote").empty?
  rescue StandardError
    warn "setup: incomplete new scaffold remains at #{destination}; inspect it before removing or retrying"
    raise
  end
  puts "Created #{mode == 'demo' ? 'fictional personal-assistant demo' : 'empty personal context (zero records)'}: #{destination}"
  puts "Independent Git history; initial commit saved locally; no remote configured."
  puts "No packages or skills were installed."
end

begin
  if ARGV.empty? || %w[-h --help help].include?(ARGV.first)
    puts "Usage: scripts/setup.sh demo"
    puts "       scripts/setup.sh empty"
    puts "       scripts/setup.sh personal /absolute/new/path"
    puts "Creates independent local Git data. No downloads, remote, or personal-data import."
    exit 0
  end
  mode = ARGV.shift
  unless %w[demo empty personal].include?(mode)
    raise SetupError, "unknown mode; use demo, empty, or personal /absolute/new/path"
  end
  raw_destination = %w[demo empty].include?(mode) ? File.join(SOURCE_ROOT, ".local", mode) : ARGV.shift
  raise SetupError, "personal mode requires an absolute new destination path" unless raw_destination
  raise SetupError, "unexpected extra arguments" unless ARGV.empty?
  destination = resolved_new_path(raw_destination)
  validate_destination(destination, mode)
  if File.exist?(destination) || File.symlink?(destination)
    raise SetupError, "destination already exists; choose a new folder (nothing was changed)" if mode == "personal"
    existing_managed_context!(destination, mode)
  else
    create_context(destination, mode)
  end
rescue SetupError, Errno::EACCES, Errno::EEXIST, Errno::ENOTDIR => e
  warn "setup: #{e.message}"
  exit 1
end
