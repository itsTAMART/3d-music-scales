/**
 * Highlight module — manages visual highlighting of graph nodes.
 *
 * When notes are played (via piano, MIDI, or audio), matching scale nodes
 * are highlighted with a glow effect while non-matching nodes dim.
 * This module is used starting from Commit 2 (piano feature).
 *
 * @module graph/highlight
 */

import type { GraphInstance } from "./graph";

/** Set of currently highlighted node IDs. */
let highlightedNodes: Set<string> = new Set();

/**
 * Updates which nodes are highlighted on the graph.
 * Highlighted nodes become bright; others dim to 20% opacity.
 * Pass an empty set to clear all highlights (restore defaults).
 */
export function updateHighlights(
  graph: GraphInstance,
  nodeIds: Set<string>
): void {
  highlightedNodes = nodeIds;

  // Trigger a visual refresh by updating node objects
  graph.nodeThreeObject(graph.nodeThreeObject());
}

/**
 * Returns whether any nodes are currently highlighted.
 */
export function hasHighlights(): boolean {
  return highlightedNodes.size > 0;
}

/**
 * Returns the current set of highlighted node IDs.
 */
export function getHighlightedNodes(): ReadonlySet<string> {
  return highlightedNodes;
}

/**
 * Clears all highlights, restoring nodes to default appearance.
 */
export function clearHighlights(graph: GraphInstance): void {
  updateHighlights(graph, new Set());
}
