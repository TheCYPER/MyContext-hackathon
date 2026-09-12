import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "../app";
import { mockApi } from "./fixtures";

describe("canonical entity inspector", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.location.hash = "";
  });

  it("loads and displays canonical detail as text", async () => {
    mockApi();
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: /Motion Atlas/i }));

    const dialog = await screen.findByRole("dialog", { name: "Motion Atlas" });
    expect(dialog).toHaveTextContent("Fixture body.");
    expect(dialog).toHaveTextContent("active");
    expect(dialog).toHaveTextContent("primary");
    expect(dialog).toHaveTextContent("demo:fictional");
    expect(dialog).toHaveTextContent("Rhea Sen");
    expect(screen.getByRole("button", { name: "Focus in graph" })).toBeInTheDocument();
    expect(dialog).toHaveTextContent("Read from tracked Git HEAD");
    expect(dialog.querySelector("script")).toBeNull();
  });
});
