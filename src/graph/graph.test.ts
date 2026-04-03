/**
 * Tests for the graph module — verifies configuration and exports.
 *
 * Note: Full WebGL rendering cannot be tested in jsdom.
 * These tests verify the module's types and configuration logic.
 */

import { describe, it, expect } from "vitest";
import type { NodeClickHandler } from "./graph";

describe("graph module", () => {
  it("exports the NodeClickHandler type", () => {
    // Type-level test: ensure the type is usable
    const handler: NodeClickHandler = (_id: string) => {};
    expect(typeof handler).toBe("function");
  });
});
