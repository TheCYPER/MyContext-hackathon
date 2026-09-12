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
    expect(projectIdeas).toHaveClass("focus-visible:ring-palette-black");
  });

  it("uses large overview priorities without dark inset blocks", async () => {
    mockApi();
    render(<App />);

    const navigation = await screen.findByRole("navigation", {
      name: "Academic and professional records",
    });
    const main = screen.getByRole("main");
    const tiles = within(navigation).getAllByRole("button");

    expect(main).toHaveClass("border", "bg-background");
    expect(main.closest(".min-h-screen")).toHaveClass(
      "bg-palette-green",
      "dark:bg-palette-black",
    );

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Keep the context behind your work.",
      }),
    ).toHaveClass("text-4xl", "sm:text-5xl", "font-black");
    expect(
      screen.getByRole("heading", { level: 2, name: "Current focus" }),
    ).toHaveClass("text-2xl", "sm:text-3xl", "font-black");

    for (const tile of tiles) {
      expect(tile.querySelector("strong")).toHaveClass("text-5xl");
      expect(tile.querySelector('[class*="bg-palette-black"]')).toBeNull();
    }
    expect(tiles[3]).not.toHaveClass("bg-palette-black");
  });

  it("groups records by lifecycle state with archived items in a compact final section", async () => {
    window.location.hash = "projects";
    mockApi();
    render(<App />);

    const active = await screen.findByRole("region", {
      name: "Active records",
    });
    const archived = screen.getByRole("region", {
      name: "Archived records",
    });

    expect(
      within(active).getByRole("button", { name: /Motion Atlas/i }),
    ).toBeInTheDocument();
    expect(
      within(archived).getByRole("button", { name: /Archived Prototype/i }),
    ).toBeInTheDocument();
    expect(archived).toHaveAttribute("data-layout", "compact");
    expect(
      active.compareDocumentPosition(archived) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("groups both idea collections into visible in-progress sections", async () => {
    window.location.hash = "ideas";
    mockApi();
    render(<App />);

    expect(
      await screen.findByRole("region", {
        name: "Research ideas — In progress",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", {
        name: "Project ideas — In progress",
      }),
    ).toBeInTheDocument();
  });

  it("wraps long idea titles inside their card column", async () => {
    window.location.hash = "ideas";
    mockApi();
    render(<App />);

    const title = await screen.findByRole("button", {
      name: "Predict Before You Track",
    });
    expect(title).toHaveClass(
      "min-w-0",
      "max-w-full",
      "whitespace-normal",
      "break-words",
    );
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
