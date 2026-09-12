import { render, screen } from "@testing-library/react";
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
    expect(screen.getByText(/Context loaded; repository status unavailable/i)).toBeInTheDocument();
  });

  it("shows a blocking retry state when canonical projection fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: false, error: { message: "Projection failed" } }), { status: 500 })));
    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Projection failed");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
