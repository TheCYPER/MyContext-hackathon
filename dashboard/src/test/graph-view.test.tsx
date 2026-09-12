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
});
