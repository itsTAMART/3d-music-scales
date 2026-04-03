/**
 * Tests for the highlight module — verifies state management
 * for node highlighting with fade decay.
 */

import { describe, it, expect } from "vitest";
import { hasHighlights, getHighlightedNodes, triggerHighlights } from "./highlight";

describe("highlight state", () => {
  it("starts with no highlights", () => {
    expect(hasHighlights()).toBe(false);
    expect(getHighlightedNodes().size).toBe(0);
  });

  it("has highlights after triggering", () => {
    triggerHighlights(new Set(["C Major Scale"]));
    expect(hasHighlights()).toBe(true);
    expect(getHighlightedNodes().has("C Major Scale")).toBe(true);
  });
});
