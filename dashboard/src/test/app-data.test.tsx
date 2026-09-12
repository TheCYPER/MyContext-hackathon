import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "../app";
import { mockApi } from "./fixtures";

describe("dashboard bootstrap", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.location.hash = "";
  });

  it("keeps snapshot content usable when repository status fails", async () => {
    mockApi({ repoFails: true });
    render(<App />);

    expect(await screen.findByText("Motion Atlas")).toBeInTheDocument();
    expect(
      screen.getByText(/Context loaded; repository status unavailable/i),
    ).toBeInTheDocument();
  });

  it("presents synthetic records as an informational dataset note", async () => {
    mockApi();
    render(<App />);

    const note = await screen.findByRole("note", { name: "Demo dataset" });
    expect(note).toHaveTextContent("Fictional records");
    expect(note).toHaveTextContent("No real people or institutions");
  });

  it("keeps keyboard focus visible on every overview color tile", async () => {
    mockApi();
    render(<App />);

    const navigation = await screen.findByRole("navigation", {
      name: "Academic and professional records",
    });
    const [projects, experiences, research, projectIdeas] =
      within(navigation).getAllByRole("button");

    expect(projects).toHaveClass("focus-visible:ring-palette-black");
    expect(experiences).toHaveClass("focus-visible:ring-palette-black");
    expect(research).toHaveClass("focus-visible:ring-palette-black");
    expect(projectIdeas).toHaveClass("focus-visible:ring-palette-cream");
  });

  it("shows a blocking retry state when canonical projection fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              ok: false,
              error: { message: "Projection failed" },
            }),
            { status: 500 },
          ),
      ),
    );
    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Projection failed",
    );
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
  });
});
