import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EntityInspector } from "../components/entity-inspector";
import type { Entity } from "../types";

const summary: Entity = {
  id: "project.revision-fixture", type: "project", title: "Revision fixture",
  privacy: "private", status: "active", sources: [], aliases: [], tags: [],
  links: [], updated: "2026-09-12", path: "projects/revision-fixture.md",
};
const firstRevision = "a".repeat(40);
const nextRevision = "b".repeat(40);
const props = {
  entityId: summary.id, summary, entities: [summary], graphNodeIds: [],
  onOpenEntity: () => {}, onFocusGraph: () => {}, onOpenChange: () => {},
};
const response = (revision: string, body: string) => new Response(JSON.stringify({
  ok: true, entity: { ...summary, body }, revision,
}));

describe("entity snapshot consistency", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("requests the snapshot revision and refetches detail when that revision changes", async () => {
    let finishNext: (value: Response) => void = () => {};
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(firstRevision, "First committed body"))
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { finishNext = resolve; }));
    vi.stubGlobal("fetch", fetchMock);
    const { rerender } = render(<EntityInspector {...props} revision={firstRevision} />);
    expect(await screen.findByText("First committed body")).toBeInTheDocument();
    expect(fetchMock.mock.calls[0][0]).toBe(`/api/v1/entities/${summary.id}?revision=${firstRevision}`);

    rerender(<EntityInspector {...props} revision={nextRevision} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1][0]).toBe(`/api/v1/entities/${summary.id}?revision=${nextRevision}`);
    expect(screen.queryByText("First committed body")).not.toBeInTheDocument();
    await act(async () => finishNext(response(nextRevision, "Next committed body")));
    expect(await screen.findByText("Next committed body")).toBeInTheDocument();
  });

  it("does not display detail from a mismatched revision", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(nextRevision, "Wrong revision body")));
    render(<EntityInspector {...props} revision={firstRevision} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Context changed; refresh the page");
    expect(screen.queryByText("Wrong revision body")).not.toBeInTheDocument();
  });

  it("shows the server's stale-snapshot error without exposing a record body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: false, error: { code: "revision_changed", message: "Context changed; refresh the page before opening this record" },
    }), { status: 409 })));
    render(<EntityInspector {...props} revision={firstRevision} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Context changed; refresh the page");
  });
});
