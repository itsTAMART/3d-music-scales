/**
 * Tests for the scale panel module — verifies DOM updates
 * when a scale is selected.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { updateScalePanel, clearScalePanel } from "./scale-panel";
import type { AppData, GraphData, ScaleDict, ChordData } from "../types";

function createMockElements() {
  return {
    scaleNameEl: document.createElement("div"),
    scaleNotesEl: document.createElement("div"),
    relatedScalesEl: document.createElement("div"),
  };
}

function createMockData(): AppData {
  const scaleGraph: GraphData = {
    nodes: [
      { id: "C Major Scale", group: 0 },
      { id: "G Major Scale", group: 0 },
      { id: "F Major Scale", group: 0 },
    ],
    links: [
      { source: "C Major Scale", target: "G Major Scale", value: 2.0 },
      { source: "C Major Scale", target: "F Major Scale", value: 2.0 },
    ],
  };

  const scaleDict: ScaleDict = {
    "C Major Scale": {
      code: "101011010101",
      notes: ["C", "D", "E", "F", "G", "A", "B"],
      tonic: "C",
    },
    "G Major Scale": {
      code: "101011010110",
      notes: ["G", "A", "B", "C", "D", "E", "F#"],
      tonic: "G",
    },
    "F Major Scale": {
      code: "101011010101",
      notes: ["F", "G", "A", "Bb", "C", "D", "E"],
      tonic: "F",
    },
  };

  const chordData: ChordData = { nodes: [], links: [] };

  return { scaleGraph, scaleDict, chordData };
}

describe("updateScalePanel", () => {
  let elements: ReturnType<typeof createMockElements>;
  let data: AppData;

  beforeEach(() => {
    elements = createMockElements();
    data = createMockData();
  });

  it("displays the scale name", () => {
    updateScalePanel("C Major Scale", data, elements);
    expect(elements.scaleNameEl.textContent).toBe("C Major Scale");
  });

  it("displays the scale notes", () => {
    updateScalePanel("C Major Scale", data, elements);
    expect(elements.scaleNotesEl.textContent).toContain("C");
    expect(elements.scaleNotesEl.textContent).toContain("B");
  });

  it("shows related scales", () => {
    updateScalePanel("C Major Scale", data, elements);
    const items = elements.relatedScalesEl.querySelectorAll(".related-item");
    expect(items.length).toBe(2); // G Major and F Major
  });

  it("shows related scale names correctly", () => {
    updateScalePanel("C Major Scale", data, elements);
    const names = elements.relatedScalesEl.querySelectorAll(".item-name");
    const nameTexts = Array.from(names).map((n) => n.textContent);
    expect(nameTexts).toContain("G Major Scale");
    expect(nameTexts).toContain("F Major Scale");
  });
});

describe("clearScalePanel", () => {
  it("clears all panel content", () => {
    const elements = createMockElements();
    elements.scaleNameEl.textContent = "test";
    elements.scaleNotesEl.textContent = "test";
    elements.relatedScalesEl.innerHTML = "<div>test</div>";

    clearScalePanel(elements);

    expect(elements.scaleNameEl.textContent).toBe("");
    expect(elements.scaleNotesEl.textContent).toBe("");
    expect(elements.relatedScalesEl.innerHTML).toBe("");
  });
});
