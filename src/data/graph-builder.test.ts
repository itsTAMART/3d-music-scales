/**
 * Tests for the graph builder — verifies unified graph construction.
 */

import { describe, it, expect } from "vitest";
import { buildUnifiedGraph, defaultLayers } from "./graph-builder";
import { loadAppData } from "./loader";

describe("buildUnifiedGraph", () => {
  const data = loadAppData();

  it("builds scales-only graph by default", () => {
    const result = buildUnifiedGraph(data, defaultLayers());
    expect(result.nodes.length).toBe(data.scaleGraph.nodes.length);
    expect(result.nodes.every((n) => n.nodeType === "scale")).toBe(true);
  });

  it("adds chord nodes when chords layer is on", () => {
    const layers = { scales: true, chords: true, notes: false };
    const result = buildUnifiedGraph(data, layers);
    const chords = result.nodes.filter((n) => n.nodeType === "chord");
    expect(chords.length).toBeGreaterThan(0);
    expect(chords[0].group).toBe(10);
  });

  it("adds 12 note nodes when notes layer is on", () => {
    const layers = { scales: true, chords: false, notes: true };
    const result = buildUnifiedGraph(data, layers);
    const notes = result.nodes.filter((n) => n.nodeType === "note");
    expect(notes.length).toBe(12);
    expect(notes[0].group).toBe(20);
  });

  it("note nodes have ♪ prefix", () => {
    const layers = { scales: true, chords: false, notes: true };
    const result = buildUnifiedGraph(data, layers);
    const notes = result.nodes.filter((n) => n.nodeType === "note");
    expect(notes[0].id).toMatch(/^♪ /);
  });

  it("creates note-scale links", () => {
    const layers = { scales: true, chords: false, notes: true };
    const result = buildUnifiedGraph(data, layers);
    const noteLinks = result.links.filter((l) => {
      const src = typeof l.source === "string" ? l.source : l.source.id;
      return src.startsWith("♪");
    });
    expect(noteLinks.length).toBeGreaterThan(0);
  });

  it("does not add chords/notes without scales", () => {
    const layers = { scales: false, chords: true, notes: true };
    const result = buildUnifiedGraph(data, layers);
    expect(result.nodes.length).toBe(0);
  });
});
