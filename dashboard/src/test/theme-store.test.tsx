import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { ThemeMenu } from "../components/layout/theme-menu";
import { resolveTheme, useThemeStore } from "../stores/theme-store";

describe("theme management", () => {
  afterEach(() => {
    useThemeStore.setState({ theme: "system" });
    document.documentElement.classList.remove("dark");
    localStorage.clear();
  });

  it("resolves a system preference from the operating-system setting", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
  });

  it("persists an explicit theme and applies it to the document", async () => {
    const user = userEvent.setup();
    render(<ThemeMenu />);

    await user.click(screen.getByRole("button", { name: "Change color theme" }));
    await user.click(screen.getByRole("menuitemradio", { name: "Dark" }));

    expect(useThemeStore.getState().theme).toBe("dark");
    expect(document.documentElement).toHaveClass("dark");
    expect(localStorage.getItem("mycontext-theme")).toContain("dark");
  });
});
