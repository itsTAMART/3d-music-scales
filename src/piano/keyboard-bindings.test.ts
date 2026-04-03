/**
 * Tests for the keyboard bindings module — verifies key-to-note mapping,
 * event dispatching, and key repeat suppression.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  initKeyboardBindings,
  removeKeyboardBindings,
  getKeyMap,
} from "./keyboard-bindings";

describe("getKeyMap", () => {
  it("maps KeyA to C3", () => {
    const map = getKeyMap();
    expect(map.get("KeyA")).toEqual({ note: "C", octave: 3 });
  });

  it("maps KeyW to C#3 (black key)", () => {
    const map = getKeyMap();
    expect(map.get("KeyW")).toEqual({ note: "C#", octave: 3 });
  });

  it("maps KeyK to C4 (upper octave)", () => {
    const map = getKeyMap();
    expect(map.get("KeyK")).toEqual({ note: "C", octave: 4 });
  });

  it("contains all 24 keys (2 octaves × 12 notes)", () => {
    const map = getKeyMap();
    expect(map.size).toBe(24);
  });
});

describe("keyboard events", () => {
  beforeEach(() => {
    initKeyboardBindings();
  });

  afterEach(() => {
    removeKeyboardBindings();
  });

  it("dispatches piano:noteon on keydown for mapped key", () => {
    const listener = vi.fn();
    document.addEventListener("piano:noteon", listener);

    document.dispatchEvent(
      new KeyboardEvent("keydown", { code: "KeyA", bubbles: true })
    );

    expect(listener).toHaveBeenCalledTimes(1);
    const detail = (listener.mock.calls[0][0] as CustomEvent).detail;
    expect(detail.note).toBe("C");

    document.removeEventListener("piano:noteon", listener);
  });

  it("dispatches piano:noteoff on keyup", () => {
    const listener = vi.fn();
    document.addEventListener("piano:noteoff", listener);

    // Press and release
    document.dispatchEvent(
      new KeyboardEvent("keydown", { code: "KeyA", bubbles: true })
    );
    document.dispatchEvent(
      new KeyboardEvent("keyup", { code: "KeyA", bubbles: true })
    );

    expect(listener).toHaveBeenCalledTimes(1);
    document.removeEventListener("piano:noteoff", listener);
  });

  it("suppresses key repeat (multiple keydowns without keyup)", () => {
    const listener = vi.fn();
    document.addEventListener("piano:noteon", listener);

    // Simulate key repeat
    document.dispatchEvent(
      new KeyboardEvent("keydown", { code: "KeyS", bubbles: true })
    );
    document.dispatchEvent(
      new KeyboardEvent("keydown", { code: "KeyS", bubbles: true })
    );
    document.dispatchEvent(
      new KeyboardEvent("keydown", { code: "KeyS", bubbles: true })
    );

    expect(listener).toHaveBeenCalledTimes(1);
    document.removeEventListener("piano:noteon", listener);
  });

  it("ignores unmapped keys", () => {
    const listener = vi.fn();
    document.addEventListener("piano:noteon", listener);

    document.dispatchEvent(
      new KeyboardEvent("keydown", { code: "Escape", bubbles: true })
    );

    expect(listener).not.toHaveBeenCalled();
    document.removeEventListener("piano:noteon", listener);
  });
});
