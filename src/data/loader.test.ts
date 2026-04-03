/**
 * Tests for the data loader module — verifies JSON data is loaded
 * with correct structure and types.
 */

import { describe, it, expect } from "vitest";
import { loadAppData } from "./loader";

describe("loadAppData", () => {
  const data = loadAppData();

  it("loads scale graph with nodes and links", () => {
    expect(data.scaleGraph.nodes).toBeDefined();
    expect(data.scaleGraph.links).toBeDefined();
    expect(data.scaleGraph.nodes.length).toBeGreaterThan(0);
    expect(data.scaleGraph.links.length).toBeGreaterThan(0);
  });

  it("scale nodes have id and group fields", () => {
    const node = data.scaleGraph.nodes[0];
    expect(node.id).toBeDefined();
    expect(typeof node.id).toBe("string");
    expect(typeof node.group).toBe("number");
  });

  it("scale links have source, target, and value", () => {
    const link = data.scaleGraph.links[0];
    expect(link.source).toBeDefined();
    expect(link.target).toBeDefined();
    expect(typeof link.value).toBe("number");
  });

  it("loads scale dictionary with notes and codes", () => {
    const entry = data.scaleDict["C Major Scale"];
    expect(entry).toBeDefined();
    expect(entry.notes).toContain("C");
    expect(entry.code).toHaveLength(12);
    expect(entry.tonic).toBe("C");
  });

  it("loads chord data with nodes and links", () => {
    expect(data.chordData.nodes.length).toBeGreaterThan(0);
    expect(data.chordData.links.length).toBeGreaterThan(0);
  });

  it("has all 6 scale groups represented", () => {
    const groups = new Set(data.scaleGraph.nodes.map((n) => n.group));
    expect(groups.size).toBe(6);
  });
});
