#!/usr/bin/env ruby
# frozen_string_literal: true

require "date"
require "digest"
require "fileutils"
require "json"
require "open3"
require "optparse"
require "pathname"
require "securerandom"
require "time"
require_relative "context_binding"
require_relative "secret_patterns"
require_relative "search_context"

module MyContextCapture
  MAX_INPUT = 32 * 1024
  MAX_CANDIDATE = 64 * 1024
  EVIDENCE = %w[user_confirmed artifact inference].freeze
  POLICY_FIELDS = %w[version mode commit write_policy_sha256 agents_sha256].freeze
  NOFOLLOW = File.const_defined?(:NOFOLLOW) ? File::NOFOLLOW : 0
  GIT_ENV = MyContextBinding::GIT_ENV.merge(
    "GIT_CONFIG_PARAMETERS" => nil,
    "GIT_AUTHOR_NAME" => "MyContext Capture", "GIT_AUTHOR_EMAIL" => "capture@example.invalid",
    "GIT_COMMITTER_NAME" => "MyContext Capture", "GIT_COMMITTER_EMAIL" => "capture@example.invalid"
  ).freeze

  class Error < StandardError
    attr_reader :code
    def initialize(code, message = nil)
      @code = code.to_s
      super(message || @code.tr("_", " "))
    end
  end

  def self.parse_json(text)
    raise Error.new("invalid_json") unless text.is_a?(String) && text.bytesize <= MAX_INPUT
    parsed = JSON.parse(text, max_nesting: 100)
    audit_json_keys!(text)
    parsed
  rescue JSON::ParserError, EncodingError, ArgumentError
    raise Error.new("invalid_json")
  end

  # The built-in parser validates JSON grammar first. Some JSON versions discard
  # duplicate keys before object_class callbacks, so audit the original tokens.
  # Each object owns its key set; strings are decoded by JSON itself so escaped
  # and literal spellings of the same key cannot bypass duplicate detection.
  def self.audit_json_keys!(text)
    frames = []
    cursor = 0
    while cursor < text.bytesize
      case text.getbyte(cursor)
      when 123 # {
        frames << { kind: :object, expecting_key: true, keys: {} }
      when 91 # [
        frames << { kind: :array }
      when 125, 93 # } ]
        frames.pop
      when 44 # ,
        frame = frames.last
        frame[:expecting_key] = true if frame && frame[:kind] == :object
      when 34 # "
        start = cursor
        cursor += 1
        while cursor < text.bytesize
          byte = text.getbyte(cursor)
          break if byte == 34
          cursor += byte == 92 ? 2 : 1 # Skip the escaped byte after a backslash.
        end
        raise Error.new("invalid_json") if cursor >= text.bytesize
        frame = frames.last
        if frame && frame[:kind] == :object && frame[:expecting_key]
          key = JSON.parse(text.byteslice(start, cursor - start + 1))
          raise Error.new("duplicate_field") if frame[:keys].key?(key)
          frame[:keys][key] = true
          frame[:expecting_key] = false
        end
      end
      raise Error.new("invalid_json") if frames.length > 100
      cursor += 1
    end
  end

  def self.text!(value, limit)
    unless value.is_a?(String) && value.valid_encoding? && !value.strip.empty? &&
        value.length <= limit && !value.match?(/[\p{Cc}\p{Cf}]/u)
      raise Error.new("invalid_text")
    end
    value.strip
  end

  def self.read_regular(path, limit)
    raise Error.new("unsafe_file") if File.symlink?(path) || !File.file?(path)
    File.open(path, File::RDONLY | NOFOLLOW) do |file|
      text = file.read(limit + 1).to_s.force_encoding("UTF-8")
      raise Error.new("file_too_large") if text.bytesize > limit
      raise Error.new("invalid_utf8") unless text.valid_encoding?
      text
    end
  end

  def self.input(path)
    raise Error.new("input_path_required") unless path && Pathname.new(path).absolute?
    data = parse_json(read_regular(path, MAX_INPUT))
    unless data.is_a?(Hash) && (data.keys - %w[version event_id title date facts links]).empty? &&
        %w[version event_id title date facts].all? { |key| data.key?(key) } && data["version"].is_a?(Integer) && data["version"] == 1
      raise Error.new("invalid_input_fields")
    end
    event_id = text!(data["event_id"], 128)
    raise Error.new("invalid_event_id") unless event_id.match?(/\A[a-zA-Z0-9][a-zA-Z0-9._-]*\z/)
    title = text!(data["title"], 160)
    date = text!(data["date"], 10)
    raise Error.new("invalid_date") unless date.match?(/\A\d{4}-\d{2}-\d{2}\z/) && Date.iso8601(date).iso8601 == date
    facts = data["facts"]
    raise Error.new("invalid_facts") unless facts.is_a?(Array) && (1..50).cover?(facts.length)
    facts = facts.map do |fact|
      unless fact.is_a?(Hash) && fact.keys.sort == %w[evidence source text] && EVIDENCE.include?(fact["evidence"])
        raise Error.new("invalid_fact_fields")
      end
      { "text" => text!(fact["text"], 4000), "evidence" => fact["evidence"], "source" => text!(fact["source"], 1024) }
    end
    links = data.fetch("links", [])
    unless links.is_a?(Array) && links.length <= 30 && links.all? { |id| id.is_a?(String) && id.match?(/\A[a-z0-9][a-z0-9._-]{0,159}\z/) }
      raise Error.new("invalid_links")
    end
    payload = { "version" => 1, "event_id" => event_id, "title" => title, "date" => date, "facts" => facts, "links" => links.uniq.sort }
    # Inspect decoded strings, not JSON escapes. No queue directory exists yet.
    secret_text = ([title, event_id] + facts.flat_map { |fact| [fact["text"], fact["source"]] } + links).join("\n")
    raise Error.new("secret_detected", "candidate rejected by secret scan; values redacted") unless MyContextSecrets.findings(secret_text).empty?
    payload
  rescue ArgumentError
    raise Error.new("invalid_date")
  end

  class Store
    attr_reader :root, :git_dir, :bucket
    def initialize(binding)
      @root, @git_dir = binding.values_at(:context_root, :git_dir)
      @state = binding.fetch(:state_dir)
      @bucket = File.join(@state, Digest::SHA256.hexdigest([@root, @git_dir].join("\0")))
    end

    def git(*arguments, input: nil, index: nil, optional: false)
      env = GIT_ENV.merge("GIT_INDEX_FILE" => index)
      output, _error, status = Open3.capture3(env, "git", "-c", "core.hooksPath=#{File::NULL}",
        "-c", "commit.gpgsign=false", "-c", "core.fsmonitor=false", "-C", root, *arguments,
        stdin_data: input.to_s)
      return nil if optional && !status.success?
      raise Error.new("git_failed", "local Git operation failed") unless status.success?
      output
    end

    def head
      git("rev-parse", "--verify", "HEAD", optional: true)&.strip
    end

    def policy
      revision = head
      return { "mode" => "review", "reason" => "no_committed_policy" } unless revision
      bytes = git("show", "#{revision}:meta/capture-policy.json", optional: true)
      return { "mode" => "review", "reason" => "no_committed_policy" } unless bytes
      return { "mode" => "review", "reason" => "invalid_policy" } if bytes.bytesize > 8192
      data = MyContextCapture.parse_json(bytes)
      unless data.is_a?(Hash) && data["version"] == 1 && (data.keys - POLICY_FIELDS).empty?
        return { "mode" => "review", "reason" => "invalid_policy" }
      end
      return { "mode" => "review", "reason" => "automatic_capture_disabled" } unless data["mode"] == "append_journal" && data["commit"] == "local"
      { "agents_sha256" => "AGENTS.md", "write_policy_sha256" => "meta/write-policy.md" }.each do |key, path|
        document = git("show", "#{revision}:#{path}", optional: true)
        unless document && data[key].is_a?(String) && data[key] == Digest::SHA256.hexdigest(document)
          return { "mode" => "review", "reason" => "authorization_document_changed" }
        end
      end
      { "mode" => "append_journal", "reason" => "standing_authorization", "revision" => revision }
    rescue Error
      { "mode" => "review", "reason" => "invalid_policy" }
    end

    def safe_ancestors!(path)
      current = File.expand_path(path)
      loop do
        raise Error.new("symlink_path") if File.symlink?(current)
        raise Error.new("non_directory_parent") if File.exist?(current) && !File.directory?(current)
        break if current == File.dirname(current)
        current = File.dirname(current)
      end
    end

    def directory!(path)
      safe_ancestors!(path)
      unless File.directory?(path)
        directory!(File.dirname(path))
        begin
          Dir.mkdir(path, 0o700)
        rescue Errno::EEXIST
          raise Error.new("unsafe_directory") unless File.directory?(path) && !File.symlink?(path)
        end
      end
      raise Error.new("symlink_path") if File.symlink?(path)
    end

    def atomic_write(path, bytes)
      safe_ancestors!(File.dirname(path))
      raise Error.new("unsafe_file") if File.symlink?(path) || (File.exist?(path) && !File.file?(path))
      temporary = File.join(File.dirname(path), ".capture-#{SecureRandom.hex(12)}.tmp")
      File.open(temporary, File::WRONLY | File::CREAT | File::EXCL | NOFOLLOW, 0o600) do |file|
        file.write(bytes)
        file.flush
        file.fsync
      end
      raise Error.new("unsafe_file") if File.symlink?(path)
      File.rename(temporary, path)
    ensure
      File.unlink(temporary) if temporary && File.file?(temporary) && !File.symlink?(temporary)
    end

    def locked
      directory!(bucket)
      path = File.join(bucket, "capture.lock")
      raise Error.new("unsafe_lock") if File.symlink?(path)
      File.open(path, File::RDWR | File::CREAT | NOFOLLOW, 0o600) do |lock|
        deadline = Process.clock_gettime(Process::CLOCK_MONOTONIC) + 8
        until lock.flock(File::LOCK_EX | File::LOCK_NB)
          raise Error.new("capture_busy") if Process.clock_gettime(Process::CLOCK_MONOTONIC) >= deadline
          sleep 0.04
        end
        yield
      ensure
        lock.flock(File::LOCK_UN) if lock
      end
    end

    def receipt_path(event_dir)
      File.join(event_dir, "receipt.json")
    end

    def save_receipt(event_dir, receipt)
      atomic_write(receipt_path(event_dir), JSON.pretty_generate(receipt) + "\n")
    end

    def read_receipt(path)
      receipt = MyContextCapture.parse_json(MyContextCapture.read_regular(path, 8192))
      unless receipt.is_a?(Hash) && receipt["version"] == 1 &&
          %w[event_id title payload_sha256 candidate_sha256 captured_at path state reason].all? { |key| receipt[key].is_a?(String) } &&
          %w[queued pending committed needs_attention].include?(receipt["state"])
        raise Error.new("queue_corrupt")
      end
      receipt
    end

    def render(payload, event_hash, timestamp)
      date = payload.fetch("date")
      metadata = {
        "id" => "journal.capture.#{event_hash}", "type" => "journal", "title" => payload.fetch("title"),
        "privacy" => "private", "updated" => timestamp, "sources" => payload.fetch("facts").map { |fact| fact.fetch("source") }.uniq,
        "aliases" => [], "tags" => ["session-capture"], "links" => payload.fetch("links"), "status" => "active", "date" => date
      }
      yaml = metadata.map { |key, value| "#{key}: #{JSON.generate(value)}" }.join("\n")
      body = payload.fetch("facts").map do |fact|
        "- [#{fact.fetch('evidence')}] #{fact.fetch('text')}\n  Source: #{fact.fetch('source')}"
      end.join("\n\n")
      "---\n#{yaml}\n---\n\n# Captured context\n\n#{body}\n"
    end

    def dirty_entries
      git("status", "--porcelain=v1", "-z", "--untracked-files=all").split("\0")
    end

    def committed_blob(path)
      git("show", "HEAD:#{path}", optional: true)
    end

    def result(receipt, outcome = nil)
      { "ok" => receipt["state"] != "needs_attention", "outcome" => outcome || receipt.fetch("state"), "event_id" => receipt.fetch("event_id"),
        "title" => receipt.fetch("title"), "reason" => receipt["reason"], "path" => receipt.fetch("path"),
        "commit" => receipt["commit"], "pushed" => false }.compact
    end

    def prepare(payload)
      event_hash = Digest::SHA256.hexdigest(payload.fetch("event_id"))
      payload_bytes = JSON.generate(payload) + "\n"
      payload_hash = Digest::SHA256.hexdigest(payload_bytes)
      event_dir = File.join(bucket, event_hash)
      safe_ancestors!(event_dir)
      if File.directory?(event_dir)
        receipt = read_receipt(receipt_path(event_dir))
        raise Error.new("event_conflict", "event ID already exists with different content") unless receipt["payload_sha256"] == payload_hash
        stored_payload = MyContextCapture.read_regular(File.join(event_dir, "payload.json"), MAX_INPUT + 8192)
        candidate = MyContextCapture.read_regular(File.join(event_dir, "candidate.md"), MAX_CANDIDATE)
        unless Digest::SHA256.hexdigest(stored_payload) == payload_hash && Digest::SHA256.hexdigest(candidate) == receipt["candidate_sha256"]
          raise Error.new("queue_corrupt")
        end
        expected_path = "journal/#{payload['date'][0, 4]}/#{payload['date']}-capture-#{event_hash}.md"
        unless receipt["event_id"] == payload["event_id"] && receipt["path"] == expected_path &&
            candidate == render(payload, event_hash, receipt.fetch("captured_at"))
          raise Error.new("queue_corrupt")
        end
        return [event_dir, receipt, candidate]
      end
      staging_dir = File.join(bucket, ".prepare-#{event_hash}-#{SecureRandom.hex(8)}")
      directory!(staging_dir)
      timestamp = Time.now.utc.iso8601
      candidate = render(payload, event_hash, timestamp)
      raise Error.new("candidate_too_large") if candidate.bytesize > MAX_CANDIDATE
      receipt = {
        "version" => 1, "event_id" => payload.fetch("event_id"), "title" => payload.fetch("title"),
        "payload_sha256" => payload_hash, "candidate_sha256" => Digest::SHA256.hexdigest(candidate), "captured_at" => timestamp,
        "path" => "journal/#{payload['date'][0, 4]}/#{payload['date']}-capture-#{event_hash}.md",
        "state" => "queued", "reason" => "awaiting_policy"
      }
      atomic_write(File.join(staging_dir, "payload.json"), payload_bytes)
      atomic_write(File.join(staging_dir, "candidate.md"), candidate)
      save_receipt(staging_dir, receipt)
      raise Error.new("destination_exists") if File.exist?(event_dir) || File.symlink?(event_dir)
      File.rename(staging_dir, event_dir)
      [event_dir, receipt, candidate]
    end

    def tracked_candidate?(receipt, candidate)
      bytes = committed_blob(receipt.fetch("path"))
      return false unless bytes == candidate
      receipt["commit"] = git("log", "-1", "--format=%H", "--", receipt.fetch("path")).strip
      true
    end

    def own_index_lock?(receipt)
      path = File.join(git_dir, "index.lock")
      return false unless receipt["index_lock"] && File.file?(path) && !File.symlink?(path)
      stat = File.stat(path)
      receipt["index_lock"] == [stat.dev, stat.ino]
    end

    def recover_lock(receipt)
      # The per-context flock proves the earlier capture is no longer running.
      # Never remove an index lock whose recorded identity is not ours.
      File.unlink(File.join(git_dir, "index.lock")) if own_index_lock?(receipt)
      receipt.delete("index_lock")
    end

    def queued(event_dir, receipt, reason)
      receipt.merge!("state" => receipt["state"] == "pending" ? "pending" : "queued", "reason" => reason)
      save_receipt(event_dir, receipt)
      result(receipt)
    end

    def recover_committed_index(receipt, candidate)
      return true unless %w[pending needs_attention].include?(receipt["state"])
      path = File.join(root, receipt.fetch("path"))
      return false unless File.file?(path) && !File.symlink?(path) && MyContextCapture.read_regular(path, MAX_CANDIDATE) == candidate
      blob = git("rev-parse", "HEAD:#{receipt.fetch('path')}").strip
      current = git("ls-files", "--stage", "-z", "--", receipt.fetch("path"))
      desired = "100644 #{blob} 0\t#{receipt.fetch('path')}\0"
      return true if current == desired
      return false unless current.empty? # An intentionally staged edit belongs to the user.
      original_index_hash = receipt["original_index_sha256"]
      return false unless original_index_hash && Digest::SHA256.file(File.join(git_dir, "index")).hexdigest == original_index_hash
      git("update-index", "--add", "--cacheinfo", "100644", blob, receipt.fetch("path"))
      git("ls-files", "--stage", "-z", "--", receipt.fetch("path")) == desired
    rescue Error, SystemCallError
      false
    end

    def validate_links!(links)
      return if links.empty?
      namespace_roots = { "profile" => ["profile"], "domain" => ["domains"], "project" => ["projects"],
        "idea" => ["ideas"], "experience" => ["experience"], "person" => ["people"],
        "journal" => ["journal"], "draft" => ["people", "experience"] }
      roots = links.flat_map { |id| namespace_roots.fetch(id.split(".").first) { raise Error.new("unsupported_link_namespace") } }.uniq
      paths = git("ls-tree", "-r", "--name-only", "-z", "HEAD", "--", *roots).split("\0")
      remaining = links.dup
      header_bytes = 0
      inspected = 0
      paths.sort.each do |relative|
        next unless relative.end_with?(".md")
        raise Error.new("link_lookup_limit") if inspected >= 512 || header_bytes >= 524_288
        path = File.join(root, relative)
        safe_ancestors!(File.dirname(path))
        raise Error.new("symlink_path") if File.symlink?(path)
        next unless File.file?(path)
        File.open(path, File::RDONLY | NOFOLLOW) do |io|
          io.set_encoding("UTF-8")
          data = MyContextSearch.read_header(io)
          header_bytes += io.pos
          inspected += 1
          next unless data && data["privacy"] != "restricted"
          remaining.delete(data["id"])
        end
        break if remaining.empty?
      end
      raise Error.new("unknown_or_excluded_links") unless remaining.empty?
    end

    def publish(path, candidate)
      directory!(File.dirname(path))
      raise Error.new("destination_exists") if File.exist?(path) || File.symlink?(path)
      temporary = File.join(File.dirname(path), ".capture-#{SecureRandom.hex(12)}.tmp")
      File.open(temporary, File::WRONLY | File::CREAT | File::EXCL | NOFOLLOW, 0o600) do |file|
        file.write(candidate)
        file.flush
        file.fsync
      end
      safe_ancestors!(File.dirname(path))
      File.link(temporary, path) # Same filesystem; an existing destination cannot be replaced.
    ensure
      File.unlink(temporary) if temporary && File.file?(temporary) && !File.symlink?(temporary)
    end

    def capture(payload)
      locked do
        event_dir, receipt, candidate = prepare(payload)
        path = File.join(root, receipt.fetch("path"))
        safe_ancestors!(File.dirname(path))
        raise Error.new("symlink_path") if File.symlink?(path)
        if tracked_candidate?(receipt, candidate)
          recover_lock(receipt)
          recovered = recover_committed_index(receipt, candidate)
          receipt.merge!("state" => recovered ? "committed" : "needs_attention",
            "reason" => recovered ? "already_committed" : "committed_index_needs_attention")
          save_receipt(event_dir, receipt)
          next result(receipt, recovered ? "already_committed" : "needs_attention")
        end
        raise Error.new("committed_note_changed") if receipt["state"] == "committed" || receipt["commit"]
        current_policy = policy
        unless current_policy["mode"] == "append_journal"
          receipt["reason"] = current_policy["reason"]
          save_receipt(event_dir, receipt)
          next result(receipt)
        end
        recover_lock(receipt)
        entries = dirty_entries
        pending_own_file = receipt["state"] == "pending" && receipt["base_commit"] == head &&
          File.file?(path) && MyContextCapture.read_regular(path, MAX_CANDIDATE) == candidate &&
          entries == ["?? #{receipt.fetch('path')}"]
        unless entries.empty? || pending_own_file
          receipt["reason"] = "dirty_context"
          save_receipt(event_dir, receipt)
          next result(receipt)
        end
        if File.exist?(path) && !pending_own_file
          raise Error.new("destination_exists")
        end
        begin
          validate_links!(payload.fetch("links"))
        rescue Error => error
          receipt.merge!("state" => "queued", "reason" => error.code)
          save_receipt(event_dir, receipt)
          next result(receipt)
        end
        auto_append(event_dir, receipt, candidate, pending_own_file)
      end
    end

    def auto_append(event_dir, receipt, candidate, existing_owned_file)
      base = head
      return queued(event_dir, receipt, "unborn_context") unless base
      branch_ref = git("symbolic-ref", "-q", "HEAD", optional: true)&.strip
      return queued(event_dir, receipt, "detached_head") unless branch_ref
      if !git("rev-parse", "--shared-index-path").strip.empty? || git("config", "--bool", "core.sparseCheckout", optional: true)&.strip == "true"
        return queued(event_dir, receipt, "unsupported_index")
      end
      %w[MERGE_HEAD CHERRY_PICK_HEAD REVERT_HEAD rebase-merge rebase-apply].each do |name|
        return queued(event_dir, receipt, "git_operation_in_progress") if File.exist?(File.join(git_dir, name))
      end
      lock_path = File.join(git_dir, "index.lock")
      raise Error.new("symlink_path") if File.symlink?(lock_path)
      index_lock = nil
      temporary_index = File.join(event_dir, "index-#{SecureRandom.hex(12)}.tmp")
      path = File.join(root, receipt.fetch("path"))
      committed = false
      owned_file = existing_owned_file
      begin
        index_lock = File.open(lock_path, File::WRONLY | File::CREAT | File::EXCL | NOFOLLOW, 0o600)
        receipt.merge!("state" => "pending", "base_commit" => base, "reason" => "writing",
          "index_lock" => [index_lock.stat.dev, index_lock.stat.ino],
          "original_index_sha256" => Digest::SHA256.file(File.join(git_dir, "index")).hexdigest)
        save_receipt(event_dir, receipt)
        current_policy = policy
        raise Error.new("authorization_changed") unless current_policy["mode"] == "append_journal" && current_policy["revision"] == base
        entries = dirty_entries
        expected_dirty = existing_owned_file ? ["?? #{receipt.fetch('path')}"] : []
        raise Error.new("concurrent_changes") unless entries == expected_dirty && head == base
        File.open(temporary_index, File::WRONLY | File::CREAT | File::EXCL | NOFOLLOW, 0o600) { |file| file.write(File.binread(File.join(git_dir, "index"))) }
        raise Error.new("concurrent_changes") unless git("write-tree", index: temporary_index).strip == git("rev-parse", "#{base}^{tree}").strip
        blob = git("hash-object", "-w", "--stdin", input: candidate).strip
        git("update-index", "--add", "--cacheinfo", "100644", blob, receipt.fetch("path"), index: temporary_index)
        tree = git("write-tree", index: temporary_index).strip
        unless existing_owned_file
          publish(path, candidate)
          owned_file = true
        end
        raise Error.new("candidate_changed") unless MyContextCapture.read_regular(path, MAX_CANDIDATE) == candidate
        commit = git("commit-tree", tree, "-p", base, "-m", "Capture context #{Digest::SHA256.hexdigest(receipt.fetch('event_id'))[0, 12]}").strip
        raise Error.new("concurrent_changes") unless head == base && git("symbolic-ref", "-q", "HEAD", optional: true)&.strip == branch_ref
        git("update-ref", branch_ref, commit, base)
        receipt["commit"] = commit
        committed = true
        raise Error.new("concurrent_changes") unless git("symbolic-ref", "-q", "HEAD", optional: true)&.strip == branch_ref
        # index.lock prevents another Git writer from staging into the old index.
        index_lock.write(File.binread(temporary_index))
        index_lock.flush
        index_lock.fsync
        index_lock.close
        raise Error.new("index_lock_changed") unless own_index_lock?(receipt)
        File.rename(lock_path, File.join(git_dir, "index"))
        receipt.delete("index_lock")
        raise Error.new("commit_verification_failed") unless committed_blob(receipt.fetch("path")) == candidate
        receipt.merge!("state" => "committed", "commit" => commit, "reason" => dirty_entries.empty? ? "committed_locally" : "committed_with_concurrent_worktree_changes")
        save_receipt(event_dir, receipt)
        result(receipt)
      rescue Error, SystemCallError => error
        if committed || tracked_candidate?(receipt, candidate)
          receipt.merge!("state" => "needs_attention", "reason" => "committed_index_needs_attention")
          receipt["commit"] ||= head
        else
          # Only remove this capture's unchanged, untracked file. Never reset the
          # user's index or remove files that changed after publication.
          if owned_file && head == base && File.file?(path) && !File.symlink?(path) &&
              MyContextCapture.read_regular(path, MAX_CANDIDATE) == candidate && committed_blob(receipt.fetch("path")).nil?
            File.unlink(path)
          end
          receipt.merge!("state" => File.exist?(path) ? "pending" : "queued", "reason" => error.is_a?(Error) ? error.code : "git_busy_or_io_failure")
        end
        save_receipt(event_dir, receipt)
        result(receipt)
      ensure
        index_lock.close if index_lock && !index_lock.closed?
        File.unlink(lock_path) if own_index_lock?(receipt)
        receipt.delete("index_lock")
        File.unlink(temporary_index) if File.file?(temporary_index) && !File.symlink?(temporary_index)
      end
    end

    def list
      safe_ancestors!(bucket)
      return [] unless File.directory?(bucket)
      Dir.children(bucket).sort.map do |name|
        next unless name.match?(/\A[0-9a-f]{64}\z/)
        directory = File.join(bucket, name)
        safe_ancestors!(directory)
        receipt = read_receipt(receipt_path(directory))
        receipt.slice("event_id", "title", "state", "reason")
      end.compact
    end

    def status
      policy.merge("context_root" => root, "queue_directory" => bucket)
    end
  end

  def self.run(argv)
    command = argv.shift
    raise Error.new("invalid_command", "use capture, status, or list") unless %w[capture status list].include?(command)
    options = {}
    input_path = nil
    parser = OptionParser.new do |opts|
      opts.on("--root PATH") { |value| options[:root] = value }
      opts.on("--config PATH") { |value| options[:config_path] = value }
      opts.on("--state-dir PATH") { |value| options[:state_dir] = value }
      opts.on("--input PATH") { |value| input_path = value }
    end
    parser.parse!(argv)
    raise Error.new("unexpected_argument") unless argv.empty?
    raise Error.new("input_not_allowed") if command != "capture" && input_path
    payload = input(input_path) if command == "capture"
    store = Store.new(MyContextBinding.resolve(**options))
    response = case command
    when "capture" then store.capture(payload)
    when "status" then { "ok" => true }.merge(store.status)
    when "list" then { "ok" => true, "items" => store.list }
    end
    puts JSON.generate(response)
    0
  rescue Error => error
    puts JSON.generate("ok" => false, "error" => error.code, "message" => error.message)
    2
  rescue MyContextBinding::Error
    puts JSON.generate("ok" => false, "error" => "binding_invalid", "message" => "select a valid explicit or bound context")
    2
  rescue OptionParser::ParseError, SystemCallError, KeyError, TypeError, ArgumentError
    puts JSON.generate("ok" => false, "error" => "invalid_state_or_io", "message" => "capture could not complete; inspect the selected context and queue")
    2
  end
end

exit MyContextCapture.run(ARGV) if $PROGRAM_NAME == __FILE__
