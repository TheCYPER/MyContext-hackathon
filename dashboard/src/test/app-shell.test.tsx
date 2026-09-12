import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { App } from "../app";
import { mockApi } from "./fixtures";

describe("application shell", () => {
  it("renders the MyContext application landmark", () => {
    render(<App />);

    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByText("MyContext")).toBeInTheDocument();
  });

  it("gives the review trigger a complete accessible name", async () => {
    mockApi();
    render(<App />);
    expect(await screen.findByRole("button", { name: "Needs your review, 1 item" })).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});
