/**
 * Tests for the camera motion module.
 *
 * Note: Full camera animation requires WebGL and a real graph instance.
 * These tests verify exports and that functions don't throw without context.
 */

import { describe, it, expect } from "vitest";
import { notifyNodeClick, stopCameraMotion } from "./camera-motion";

describe("camera-motion module", () => {
  it("exports notifyNodeClick function", () => {
    expect(typeof notifyNodeClick).toBe("function");
  });

  it("exports stopCameraMotion function", () => {
    expect(typeof stopCameraMotion).toBe("function");
  });

  it("notifyNodeClick does not throw when not initialized", () => {
    expect(() => notifyNodeClick()).not.toThrow();
  });

  it("stopCameraMotion does not throw when not initialized", () => {
    expect(() => stopCameraMotion()).not.toThrow();
  });
});
