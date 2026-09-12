import { render, screen, within } from "@testing-library/react";
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

  it("keeps scope limited to search, dismisses results after selection, and focuses changed views", async () => {
    mockApi();
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Projects" }));
    expect(document.getElementById("main-content")).toHaveFocus();

    await user.click(screen.getByRole("combobox", { name: "Filter search scope" }));
    await user.click(await screen.findByRole("option", { name: "People" }));
    expect(screen.getByRole("button", { name: /Motion Atlas/i })).toBeInTheDocument();

    await user.type(screen.getByRole("searchbox", { name: "Search context" }), "Rhea");
    await user.click(within(screen.getByRole("region", { name: "Search results" })).getByRole("button", { name: /Rhea Sen/i }));
    expect(await screen.findByRole("dialog", { name: "Rhea Sen" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Search results" })).not.toBeInTheDocument();
  });
});
