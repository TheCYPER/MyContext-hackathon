import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "../app";

describe("application shell", () => {
  it("renders the MyContext application landmark", () => {
    render(<App />);

    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByText("MyContext")).toBeInTheDocument();
  });
});
