import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "../app";
import { mockApi } from "./fixtures";

describe("relationship graph", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.location.hash = "";
  });

  it("expands its focus and traces reachability without inventing semantics", async () => {
    window.location.hash = "atlas";
    mockApi();
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Expand to 2" }));
    expect(screen.getByText(/at most two hops/i)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Connection target"), "person.rhea-sen");
    await user.click(screen.getByRole("button", { name: "Trace" }));

    expect(screen.getByText(/reachability only/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear path" })).toBeInTheDocument();
  });

  it("excludes non-graph records, preserves declaration direction, and reports unreachable paths", async () => {
    window.location.hash = "atlas";
    mockApi();
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Explore the connections." })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Focus on Draft · grouped-split advisor brief/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Focus on Motion Atlas" }));
    await user.click(screen.getByRole("button", { name: "Relationship Rhea Sen and Motion Atlas" }));
    expect(screen.getByRole("heading", { name: "Motion Atlas → Rhea Sen" })).toBeInTheDocument();
    expect(screen.getByText("frontmatter.links")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Connection target"), "idea.project-cloudscore");
    await user.click(screen.getByRole("button", { name: "Trace" }));
    expect(screen.getByText(/no recorded connection path/i)).toBeInTheDocument();
  });
});
