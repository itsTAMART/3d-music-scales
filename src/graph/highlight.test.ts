/**
 * Tests for the highlight module — verifies state management
 * for node highlighting.
 *
 * Note: Visual effects require WebGL and are tested manually.
 * These tests cover the state tracking logic.
 */

import { describe, it, expect } from "vitest";
import { hasHighlights, getHighlightedNodes } from "./highlight";

describe("highlight state", () => {
  it("starts with no highlights", () => {
    expect(hasHighlights()).toBe(false);
    expect(getHighlightedNodes().size).toBe(0);
  });
});
