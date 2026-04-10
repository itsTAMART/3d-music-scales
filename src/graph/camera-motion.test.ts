/**
 * Tests for the camera motion module.
 */

import { describe, it, expect } from "vitest";
import { stopCameraMotion, setCameraMode, getCameraMode } from "./camera-motion";

describe("camera-motion module", () => {
  it("exports stopCameraMotion function", () => {
    expect(typeof stopCameraMotion).toBe("function");
  });

  it("stopCameraMotion does not throw when not initialized", () => {
    expect(() => stopCameraMotion()).not.toThrow();
  });

  it("defaults to orbit mode", () => {
    expect(getCameraMode()).toBe("orbit");
  });

  it("setCameraMode changes the mode", () => {
    setCameraMode("free");
    expect(getCameraMode()).toBe("free");
    setCameraMode("orbit"); // reset
  });
});
