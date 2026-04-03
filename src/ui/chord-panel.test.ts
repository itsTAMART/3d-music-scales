/**
 * Tests for the chord panel module — verifies DOM updates
 * when a scale is selected.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { updateChordPanel, clearChordPanel } from "./chord-panel";
import type { AppData, GraphData, ScaleDict, ChordData } from "../types";

function createMockData(): AppData {
  const scaleGraph: GraphData = { nodes: [], links: [] };

  const scaleDict: ScaleDict = {
    "C Major Triad Chord": {
      code: "100010010000",
      notes: ["C", "E", "G"],
      tonic: "C",
    },
    "A Minor Triad Chord": {
      code: "100100010000",
      notes: ["A", "C", "E"],
      tonic: "A",
    },
  };

  const chordData: ChordData = {
    nodes: [
      { id: "C Major Triad Chord", group: 0 },
      { id: "A Minor Triad Chord", group: 0 },
    ],
    links: [
      { source: "C Major Scale", target: "C Major Triad Chord", value: 1.0 },
      { source: "C Major Scale", target: "A Minor Triad Chord", value: 2.0 },
    ],
  };

  return { scaleGraph, scaleDict, chordData };
}

describe("updateChordPanel", () => {
  let container: HTMLElement;
  let data: AppData;

  beforeEach(() => {
    container = document.createElement("div");
    data = createMockData();
  });

  it("renders chord items for the selected scale", () => {
    updateChordPanel("C Major Scale", data, container);
    const items = container.querySelectorAll(".chord-item");
    expect(items.length).toBe(2);
  });

  it("sorts chords by distance (closest first)", () => {
    updateChordPanel("C Major Scale", data, container);
    const names = container.querySelectorAll(".item-name");
    expect(names[0].textContent).toBe("C Major Triad Chord");
    expect(names[1].textContent).toBe("A Minor Triad Chord");
  });

  it("shows empty state for scale with no chords", () => {
    updateChordPanel("NonExistent Scale", data, container);
    const empty = container.querySelector(".empty-state");
    expect(empty).not.toBeNull();
  });

  it("displays chord notes when available in dict", () => {
    updateChordPanel("C Major Scale", data, container);
    const notes = container.querySelectorAll(".item-notes .note");
    expect(notes.length).toBeGreaterThan(0);
    expect(notes[0].textContent).toContain("C");
  });
});

describe("clearChordPanel", () => {
  it("clears the container", () => {
    const container = document.createElement("div");
    container.innerHTML = "<div>test</div>";
    clearChordPanel(container);
    expect(container.innerHTML).toBe("");
  });
});
