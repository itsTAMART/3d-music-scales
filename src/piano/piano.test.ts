/**
 * Tests for the piano keyboard module — verifies SVG rendering,
 * key generation, and event dispatching.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPiano, highlightPianoKey, clearPianoHighlights } from "./piano";

describe("createPiano", () => {
  let container: HTMLElement;
  let svg: SVGSVGElement;

  beforeEach(() => {
    container = document.createElement("div");
    svg = createPiano(container);
  });

  it("creates an SVG element inside the container", () => {
    expect(svg).toBeInstanceOf(SVGSVGElement);
    expect(container.querySelector("svg")).toBe(svg);
  });

  it("renders white and black keys", () => {
    const whites = svg.querySelectorAll(".piano-key--white");
    const blacks = svg.querySelectorAll(".piano-key--black");
    // 2 octaves: 14 white keys, 10 black keys
    expect(whites.length).toBe(14);
    expect(blacks.length).toBe(10);
  });

  it("keys have data-note attributes", () => {
    const firstKey = svg.querySelector(".piano-key--white");
    expect(firstKey?.getAttribute("data-note")).toBe("C");
  });

  it("keys have data-octave attributes", () => {
    const firstKey = svg.querySelector(".piano-key--white");
    expect(firstKey?.getAttribute("data-octave")).toBe("3");
  });

  it("keys have accessible aria-label", () => {
    const firstKey = svg.querySelector(".piano-key--white");
    expect(firstKey?.getAttribute("aria-label")).toBe("C3");
  });

  it("dispatches piano:noteon on mousedown", () => {
    const listener = vi.fn();
    document.addEventListener("piano:noteon", listener);

    const key = svg.querySelector(".piano-key--white");
    key?.dispatchEvent(new MouseEvent("mousedown"));

    expect(listener).toHaveBeenCalledTimes(1);
    const detail = (listener.mock.calls[0][0] as CustomEvent).detail;
    expect(detail.note).toBe("C");

    document.removeEventListener("piano:noteon", listener);
  });

  it("dispatches piano:noteoff on mouseup", () => {
    const listener = vi.fn();
    document.addEventListener("piano:noteoff", listener);

    const key = svg.querySelector(".piano-key--white");
    key?.dispatchEvent(new MouseEvent("mouseup"));

    expect(listener).toHaveBeenCalledTimes(1);

    document.removeEventListener("piano:noteoff", listener);
  });
});

describe("highlightPianoKey", () => {
  let container: HTMLElement;
  let svg: SVGSVGElement;

  beforeEach(() => {
    container = document.createElement("div");
    svg = createPiano(container);
  });

  it("adds active class when highlighting", () => {
    highlightPianoKey(svg, "C", true);
    const cKeys = svg.querySelectorAll('[data-note="C"]');
    cKeys.forEach((key) => {
      expect(key.classList.contains("piano-key--active")).toBe(true);
    });
  });

  it("removes active class when unhighlighting", () => {
    highlightPianoKey(svg, "C", true);
    highlightPianoKey(svg, "C", false);
    const cKeys = svg.querySelectorAll('[data-note="C"]');
    cKeys.forEach((key) => {
      expect(key.classList.contains("piano-key--active")).toBe(false);
    });
  });
});

describe("clearPianoHighlights", () => {
  it("clears all active keys", () => {
    const container = document.createElement("div");
    const svg = createPiano(container);

    highlightPianoKey(svg, "C", true);
    highlightPianoKey(svg, "E", true);
    clearPianoHighlights(svg);

    const activeKeys = svg.querySelectorAll(".piano-key--active");
    expect(activeKeys.length).toBe(0);
  });
});
