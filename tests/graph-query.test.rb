# frozen_string_literal: true

require "minitest/autorun"
require "tmpdir"
require "fileutils"
require "open3"
require "json"
require "psych"

class GraphQueryTest < Minitest::Test
  SOURCE = File.expand_path("..", __dir__)
  QUERY = File.join(SOURCE, "scripts", "query-graph.sh")

  def setup
    @tmp = Dir.mktmpdir("mycontext-graph-query-test-")
    @root = File.join(@tmp, "context with spaces")
    FileUtils.mkdir_p(@root)
    git("init", "-b", "main")
    git("config", "user.email", "graph-query@example.invalid")
    git("config", "user.name", "Graph Query Test")
  end

  def teardown
    FileUtils.remove_entry(@tmp)
  end

  def git(*args)
    Open3.capture3("git", "-C", @root, *args).tap do |_out, err, status|
      raise err unless status.success?
    end
  end

  def relation(id:, predicate:, target:, evidence: "artifact", review: "confirmed", privacy: "private", **extra)
    {
      "id" => id, "predicate" => predicate, "target" => target,
      "evidence" => evidence,
      "sources" => ["user:2026-01-01"], "review" => review, "privacy" => privacy
    }.merge(extra.transform_keys(&:to_s))
  end

  def document(path, id:, title: id, type: "project", privacy: "private",
    status: "active", links: [], relations: [], idea_kind: nil,
    body: "# Notes\n\nSynthetic fixture.\n")
    data = {
      "id" => id, "type" => type, "title" => title, "privacy" => privacy,
      "updated" => "2026-01-01T00:00:00Z", "sources" => ["user:2026-01-01"],
      "aliases" => [], "tags" => [], "links" => links, "status" => status,
      "relations" => relations
    }
    data["idea_kind"] = idea_kind if idea_kind
    target = File.join(@root, path)
    FileUtils.mkdir_p(File.dirname(target))
    File.write(target, Psych.dump(data) + "---\n" + body)
  end

  def commit_fixture
    git("add", ".")
    git("commit", "-m", "Synthetic graph fixture")
    git("rev-parse", "HEAD").first.strip
  end

  def query(*args, root: @root, env: {})
    command = ["bash", QUERY]
    command += ["--root", root] if root
    Open3.capture3({ "MY_CONTEXT_ROOT" => nil, "MYCONTEXT_ROOT" => nil }.merge(env),
      *command, *args)
  end

  def json(*args, **options)
    out, err, status = query("--json", *args, **options)
    assert status.success?, err
    JSON.parse(out)
  end

  def seed_graph
    document("projects/alpha/overview.md", id: "project.alpha", relations: [
      relation(id: "relation.alpha-beta", predicate: "supports", target: "project.beta"),
      relation(id: "relation.alpha-gamma", predicate: "supports", target: "project.gamma", review: "unreviewed"),
      relation(id: "relation.alpha-inferred", predicate: "supports", target: "project.inferred",
        evidence: "inference"),
      relation(id: "relation.alpha-rejected", predicate: "contradicts", target: "project.rejected",
        review: "rejected"),
      relation(id: "relation.alpha-restricted", predicate: "supports", target: "project.restricted",
        privacy: "restricted"),
      relation(id: "relation.alpha-archive", predicate: "part_of", target: "project.archive"),
      relation(id: "relation.alpha-draft", predicate: "motivated_by", target: "idea.draft")
    ], links: ["project.legacy"])
    document("projects/beta/overview.md", id: "project.beta", relations: [
      relation(id: "relation.beta-gamma", predicate: "supports", target: "project.gamma"),
      relation(id: "relation.beta-future", predicate: "supersedes", target: "project.future",
        valid_from: "2027-01-01"),
      relation(id: "relation.beta-expired", predicate: "supports", target: "project.expired",
        valid_to: "2026-01-01")
    ])
    document("projects/gamma/overview.md", id: "project.gamma")
    document("projects/delta/overview.md", id: "project.delta", relations: [
      relation(id: "relation.delta-alpha", predicate: "contradicts", target: "project.alpha")
    ])
    document("projects/future/overview.md", id: "project.future")
    document("projects/expired/overview.md", id: "project.expired")
    document("projects/inferred/overview.md", id: "project.inferred")
    document("projects/legacy/overview.md", id: "project.legacy")
    document("projects/rejected/overview.md", id: "project.rejected")
    document("projects/restricted/overview.md", id: "project.restricted")
    document("projects/archive/overview.md", id: "project.archive", status: "archived")
    document("ideas/projects/draft.md", id: "idea.draft", type: "idea", status: "draft",
      idea_kind: "project",
      body: "# Problem\n\nFixture.\n\n# Product direction\n\nFixture.\n\n# First validation\n\nFixture.\n\n# Current boundary\n\nFixture.\n")
    commit_fixture
  end

  def test_neighbors_default_to_confirmed_typed_current_assertions
    revision = seed_graph
    result = json("--as-of", "2026-09-12", "--direction", "outgoing",
      "neighbors", "project.alpha")
    assert_equal 5, result["schemaVersion"]
    assert_equal revision, result["revision"]
    assert_equal "git-head", result["canonicalSource"]
    assert_equal %w[project.alpha project.beta], result["nodes"].map { |node| node["id"] }
    assert_equal ["relation.alpha-beta"], result["edges"].map { |edge| edge["id"] }
    edge = result["edges"].first
    assert_equal "artifact", edge["evidence"]
    assert_equal ["user:2026-01-01"], edge["sources"]
    assert_equal "confirmed", edge["review"]
    assert_equal "frontmatter.relations", edge["provenance"]
    assert_equal "always-excluded", result.dig("filters", "restricted")
  end

  def test_direction_predicate_depth_and_opt_in_filters_are_independent
    seed_graph
    incoming = json("--as-of", "2026-09-12", "--direction", "incoming",
      "neighbors", "project.alpha")
    assert_equal %w[project.alpha project.delta], incoming["nodes"].map { |node| node["id"] }

    supports = json("--as-of", "2026-09-12", "--direction", "outgoing",
      "--predicate", "supports", "--depth", "2", "neighbors", "project.alpha")
    assert_equal %w[project.alpha project.beta project.gamma], supports["nodes"].map { |node| node["id"] }
    assert_equal %w[relation.alpha-beta relation.beta-gamma], supports["edges"].map { |edge| edge["id"] }

    expanded = json("--as-of", "2027-01-01", "--direction", "outgoing",
      "--include-unreviewed", "--include-legacy", "--include-drafts", "--include-archived",
      "neighbors", "project.alpha")
    assert_equal %w[idea.draft project.archive project.beta project.gamma project.legacy].sort,
      expanded["nodes"].drop(1).map { |node| node["id"] }.sort
    assert_equal %w[motivated_by part_of related_to supports supports].sort,
      expanded["edges"].map { |edge| edge["kind"] }.sort
    refute_includes expanded["nodes"].map { |node| node["id"] }, "project.restricted"

    inferred = json("--as-of", "2026-09-12", "--direction", "outgoing",
      "--include-inference", "neighbors", "project.alpha")
    assert_includes inferred["nodes"].map { |node| node["id"] }, "project.inferred"
    assert_includes inferred["edges"].map { |edge| edge["id"] }, "relation.alpha-inferred"

    rejected = json("--as-of", "2026-09-12", "--direction", "outgoing",
      "--include-rejected", "neighbors", "project.alpha")
    assert_includes rejected["nodes"].map { |node| node["id"] }, "project.rejected"
    assert_includes rejected["edges"].map { |edge| edge["id"] }, "relation.alpha-rejected"
  end

  def test_temporal_filter_uses_inclusive_as_of_date
    seed_graph
    before = json("--direction", "outgoing", "--depth", "1", "--as-of", "2026-12-31",
      "neighbors", "project.beta")
    assert_equal %w[project.beta project.gamma], before["nodes"].map { |node| node["id"] }
    on_date = json("--direction", "outgoing", "--depth", "1", "--as-of", "2027-01-01",
      "neighbors", "project.beta")
    assert_equal %w[project.beta project.future project.gamma], on_date["nodes"].map { |node| node["id"] }
    expiry_date = json("--direction", "outgoing", "--depth", "1", "--as-of", "2026-01-01",
      "neighbors", "project.beta")
    assert_equal %w[project.beta project.expired project.gamma],
      expiry_date["nodes"].map { |node| node["id"] }
  end

  def test_path_is_shortest_deterministic_and_returns_complete_edge_evidence
    revision = seed_graph
    result = json("--direction", "outgoing", "--predicate", "supports", "--max-hops", "3",
      "path", "project.alpha", "project.gamma")
    assert result["found"]
    assert_equal 2, result["hopCount"]
    assert_equal %w[project.alpha project.beta project.gamma], result["nodeIds"]
    assert_equal %w[relation.alpha-beta relation.beta-gamma], result["edgeIds"]
    assert_equal revision, result["revision"]
    assert_equal result["edgeIds"], result["steps"].map { |step| step.dig("edge", "id") }
    assert_match(/does not infer a transitive semantic claim/, result["interpretation"])

    missing = json("--direction", "outgoing", "--max-hops", "1",
      "path", "project.alpha", "project.gamma")
    refute missing["found"]
    assert_nil missing["hopCount"]
    assert_empty missing["steps"]
  end

  def test_reads_committed_head_and_never_dirty_worktree_content
    seed_graph
    document("projects/dirty/overview.md", id: "project.dirty", relations: [
      relation(id: "relation.dirty-alpha", predicate: "supports", target: "project.alpha")
    ])
    result = json("--direction", "incoming", "neighbors", "project.alpha")
    refute_includes result["nodes"].map { |node| node["id"] }, "project.dirty"
  end

  def test_requires_explicit_absolute_context_and_valid_limits
    seed_graph
    _, error, missing = query("neighbors", "project.alpha", root: nil)
    assert_equal 2, missing.exitstatus
    assert_match(/select a context/, error)

    from_env = json("neighbors", "project.alpha", root: nil, env: { "MY_CONTEXT_ROOT" => @root })
    assert_equal "project.alpha", from_env["startId"]

    [["--root", "relative", "neighbors", "project.alpha"],
      ["--depth", "0", "neighbors", "project.alpha"],
      ["--depth", "4", "neighbors", "project.alpha"],
      ["--max-hops", "7", "path", "project.alpha", "project.beta"],
      ["--as-of", "2026-02-30", "neighbors", "project.alpha"],
      ["--predicate", "unknown", "neighbors", "project.alpha"],
      ["--predicate", "", "neighbors", "project.alpha"],
      ["--direction", "sideways", "neighbors", "project.alpha"]].each do |args|
      _, err, status = query(*args)
      assert_equal 2, status.exitstatus, args.join(" ")
      refute_empty err
    end
  end
end
