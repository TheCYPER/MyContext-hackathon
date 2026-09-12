import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "../app";
import { mockApi } from "./fixtures";

describe("navigation and search", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.location.hash = "";
  });

  it("hides Runs without an exact operations capability", async () => {
    mockApi();
    render(<App />);

    expect(await screen.findByRole("button", { name: "Overview" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Runs" })).not.toBeInTheDocument();
  });

  it("changes views and filters searchable records", async () => {
    mockApi();
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Projects" }));
    expect(await screen.findByRole("heading", { name: "Projects, with their evidence." })).toBeInTheDocument();
    expect(window.location.hash).toBe("#projects");

    await user.type(screen.getByRole("searchbox", { name: "Search context" }), "Eval");
    expect(screen.getAllByRole("button", { name: /Eval Notebook/i })).not.toHaveLength(0);
    expect(screen.queryByRole("button", { name: /Motion Atlas/i })).not.toBeInTheDocument();
  });
});
