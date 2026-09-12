import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("dashboard design tokens", () => {
  it("uses a muted eucalyptus green for the primary palette", () => {
    const css = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");

    expect(css).toContain("--color-palette-green: #52796f");
    expect(css).toContain("--primary: #52796f");
    expect(css).not.toContain("#39896e");
  });
});
