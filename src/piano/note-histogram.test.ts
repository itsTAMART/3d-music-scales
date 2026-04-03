/**
 * Tests for the note histogram module — verifies UI creation,
 * note triggering, and intensity tracking.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  createNoteHistogram,
  triggerNote,
  getNoteIntensity,
  clearHistogram,
  stopHistogram,
} from "./note-histogram";

describe("createNoteHistogram", () => {
  let container: HTMLElement;

  beforeEach(() => {
    stopHistogram();
    container = document.createElement("div");
  });

  it("creates a histogram element", () => {
    createNoteHistogram(container);
    const histogram = container.querySelector(".note-histogram");
    expect(histogram).not.toBeNull();
  });

  it("creates 12 columns (one per chromatic note)", () => {
    createNoteHistogram(container);
    const columns = container.querySelectorAll(".histogram-column");
    expect(columns.length).toBe(12);
  });

  it("has bars for each column", () => {
    createNoteHistogram(container);
    const bars = container.querySelectorAll(".histogram-bar");
    expect(bars.length).toBe(12);
  });

  it("has labels for each note", () => {
    createNoteHistogram(container);
    const labels = container.querySelectorAll(".histogram-label");
    expect(labels[0].textContent).toBe("C");
    expect(labels[1].textContent).toBe("C#");
    expect(labels.length).toBe(12);
  });
});

describe("triggerNote", () => {
  beforeEach(() => {
    stopHistogram();
    clearHistogram();
  });

  it("increases note intensity", () => {
    triggerNote("C");
    expect(getNoteIntensity("C")).toBeGreaterThan(0);
  });

  it("accumulates with multiple triggers", () => {
    triggerNote("A");
    const first = getNoteIntensity("A");
    triggerNote("A");
    expect(getNoteIntensity("A")).toBeGreaterThan(first);
  });

  it("caps intensity at 1.0", () => {
    for (let i = 0; i < 20; i++) triggerNote("E");
    expect(getNoteIntensity("E")).toBeLessThanOrEqual(1);
  });
});

describe("clearHistogram", () => {
  it("resets all intensities to zero", () => {
    triggerNote("C");
    triggerNote("G");
    clearHistogram();
    expect(getNoteIntensity("C")).toBe(0);
    expect(getNoteIntensity("G")).toBe(0);
  });
});
