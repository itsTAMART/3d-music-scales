/**
 * Tests for the piano synthesizer module.
 *
 * Note: Full audio output requires a real AudioContext which is not
 * available in jsdom. These tests verify the module's exports and
 * that functions don't throw when called without audio context.
 */

import { describe, it, expect } from "vitest";
import { noteOn, noteOff, allNotesOff } from "./synth";

describe("synth module", () => {
  it("exports noteOn function", () => {
    expect(typeof noteOn).toBe("function");
  });

  it("exports noteOff function", () => {
    expect(typeof noteOff).toBe("function");
  });

  it("exports allNotesOff function", () => {
    expect(typeof allNotesOff).toBe("function");
  });

  it("noteOff does not throw for notes that are not playing", () => {
    expect(() => noteOff("C")).not.toThrow();
  });

  it("allNotesOff does not throw when nothing is playing", () => {
    expect(() => allNotesOff()).not.toThrow();
  });
});
