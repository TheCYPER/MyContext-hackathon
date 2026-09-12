import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "../app";
import { mockApi } from "./fixtures";

describe("dashboard views", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.location.hash = "";
  });

  it("overview preserves counts, current focus, and review access", async () => {
    mockApi();
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByText("2 Projects")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Current focus" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Needs your review/i }));
    expect(screen.getByRole("dialog", { name: "Needs your review" })).toBeInTheDocument();
    expect(screen.getByText(/Review only/i)).toBeInTheDocument();
  });

  it("separates research ideas from proposed projects", async () => {
    window.location.hash = "ideas";
    mockApi();
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Research ideas" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Project ideas" })).toBeInTheDocument();
    expect(screen.getByText("Predict Before You Track")).toBeInTheDocument();
    expect(screen.getByText("CloudScore")).toBeInTheDocument();
  });
});
