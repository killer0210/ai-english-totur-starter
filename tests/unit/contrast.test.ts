import { describe, expect, it } from "vitest";

import { checkContrast, contrastRatio } from "../../scripts/check-contrast.mjs";

describe("contrastRatio", () => {
  it("matches known WCAG values", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
  });
});

describe("design tokens", () => {
  it("meet WCAG AA (4.5:1 text, 3:1 input borders) in light and dark", () => {
    const failing = checkContrast().filter((row) => !row.pass);
    expect(failing).toEqual([]);
  });
});
