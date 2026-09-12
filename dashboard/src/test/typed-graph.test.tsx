import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EntityInspector } from "../components/entity-inspector";
import { RelationTrail } from "../components/relation-trail";
import type { DashboardSnapshot, Entity, GraphEdge } from "../types";
import { GraphView } from "../views/graph-view";
import { snapshot } from "./fixtures";

const records: Entity[] = ["Alpha", "Beta", "Rejected", "Expired"].map((title) => ({
  id: `project.typed-${title.toLowerCase()}`, type: "project", title,
  privacy: "private", status: "active", sources: ["demo:fictional"],
  aliases: [], tags: [], links: [], updated: "2026-09-12",
  path: `projects/typed-${title.toLowerCase()}/overview.md`,
}));
const [alpha, beta, rejected, expired] = records;
const edge = (id: string, to: Entity, overrides: Partial<GraphEdge> = {}): GraphEdge => ({
  id, from: alpha.id, to: to.id, kind: "supports", semanticStatus: "typed",
  provenance: "frontmatter.relations", declaredBy: alpha.id, sourcePath: alpha.path,
  evidence: "user_confirmed", sources: ["https://example.com/fixture-evidence"],
  review: "confirmed", privacy: "private", ...overrides,
});
const edges = [
  edge("relation.typed-support", beta),
  edge("relation.typed-contradiction", beta, { kind: "contradicts", evidence: null, review: "unreviewed" }),
  edge("relation.typed-rejected", rejected, { review: "rejected" }),
  edge("relation.typed-expired", expired, { validTo: "2000-01-01" }),
];
const typedSnapshot = {
  ...snapshot, schemaVersion: 5, entities: records, workstreams: [],
  graph: {
    nodes: records.map((record) => ({ ...record, incomingCount: 0, outgoingCount: 0, neighborCount: 0 })),
    edges,
  },
} as DashboardSnapshot;

describe("typed relationship compatibility", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("preserves parallel typed assertions and their evidence while honoring graph filters", async () => {
    const user = userEvent.setup();
    render(<GraphView snapshot={typedSnapshot} initialFocusId={alpha.id} />);
    const graph = screen.getByRole("group", { name: "Focused context relationships" });
    const relations = () => within(graph).queryAllByRole("button", { name: /^Relationship / });
    expect(relations()).toHaveLength(2);
    const markers = relations().map((control) => control.querySelector("circle")!.getAttribute("cx") + "," + control.querySelector("circle")!.getAttribute("cy"));
    expect(new Set(markers).size).toBe(2);
    await user.click(within(graph).getByRole("button", { name: "Relationship Alpha → Beta: supports (confirmed)" }));
    expect(screen.getByRole("heading", { name: "Alpha → Beta" })).toBeInTheDocument();
    expect(screen.getByText("user confirmed")).toBeInTheDocument();
    expect(screen.getByText("https://example.com/fixture-evidence")).toBeInTheDocument();
    expect(screen.getByText(alpha.path)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Relationship predicate"), "supports");
    expect(relations()).toHaveLength(1);
    await user.selectOptions(screen.getByLabelText("Relationship evidence"), "missing");
    expect(relations()).toHaveLength(0);
    await user.selectOptions(screen.getByLabelText("Relationship evidence"), "");
    await user.click(screen.getByLabelText("Include rejected"));
    expect(relations()).toHaveLength(2);
    await user.click(screen.getByLabelText("Include outside validity"));
    expect(relations()).toHaveLength(3);
    await user.selectOptions(screen.getByLabelText("Relationship review"), "rejected");
    expect(relations()).toHaveLength(1);
    expect(relations()[0]).toHaveAccessibleName("Relationship Alpha → Rejected: supports (rejected)");
  });

  it("traces typed direction and clears stale paths after a mode change", async () => {
    const user = userEvent.setup();
    render(<GraphView snapshot={typedSnapshot} initialFocusId={beta.id} />);
    await user.selectOptions(screen.getByLabelText("Connection target"), alpha.id);
    await user.click(screen.getByRole("button", { name: "Trace" }));
    expect(screen.getByRole("heading", { name: "Connection path" })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Trace mode"), "directed");
    expect(screen.queryByRole("heading", { name: "Connection path" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Trace" }));
    expect(screen.getByRole("heading", { name: "No recorded connection path" })).toBeInTheDocument();
  });

  it("aligns global headings with the compact populated lanes", async () => {
    const user = userEvent.setup();
    render(<GraphView snapshot={typedSnapshot} initialFocusId={alpha.id} />);
    await user.click(screen.getByText("Global overview"));
    const graph = screen.getByLabelText("Global context graph");
    expect(within(graph).queryByText("Domains")).not.toBeInTheDocument();
    const heading = within(graph).getByText("Projects");
    const record = within(graph).getByRole("button", { name: "Focus on Alpha" });
    expect(heading.getAttribute("x")).toBe(record.querySelector("rect")!.getAttribute("x"));
  });

  it("shows typed-only related records in cards and the entity inspector", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      ok: true, entity: { ...alpha, body: "Typed fixture body." }, revision: typedSnapshot.revision,
    }))));
    const trail = render(<RelationTrail record={alpha} entities={records} edges={edges} onOpenEntity={vi.fn()} onOpenGraph={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Beta · supports" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Beta · contradicts" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Rejected ·/ })).not.toBeInTheDocument();
    trail.unmount();

    render(<EntityInspector entityId={alpha.id} summary={alpha} revision={typedSnapshot.revision}
      entities={records} graphNodeIds={records.map((record) => record.id)} graphEdges={edges}
      onOpenEntity={vi.fn()} onFocusGraph={vi.fn()} onOpenChange={vi.fn()} />);
    await screen.findByText("Typed fixture body.");
    expect(screen.getByRole("button", { name: "Open Beta supports · confirmed" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Beta contradicts · unreviewed" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Rejected supports · rejected" })).toBeInTheDocument();
  });
});
