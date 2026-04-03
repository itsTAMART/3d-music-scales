/**
 * Highlight module — manages visual highlighting of graph nodes.
 *
 * When notes are played (via piano, MIDI, or audio), matching scale nodes
 * are highlighted with a bright glow while non-matching nodes dim.
 * Uses Three.js material properties on the SpriteText children stored
 * in each node's Object3D userData.
 *
 * @module graph/highlight
 *
 * @example
 * ```ts
 * import { updateHighlights, clearHighlights } from "@/graph/highlight";
 * updateHighlights(graph, new Set(["C Major Scale", "A Minor Scale"]));
 * ```
 */

import type { GraphInstance } from "./graph";
import type { NodeObject } from "three-forcegraph";

/** Set of currently highlighted node IDs. */
let highlightedNodes: Set<string> = new Set();

/**
 * Updates which nodes are highlighted on the graph.
 * Highlighted nodes become bright white; others dim to low opacity.
 * Pass an empty set to clear all highlights (restore defaults).
 */
export function updateHighlights(
  graph: GraphInstance,
  nodeIds: Set<string>
): void {
  const hadHighlights = highlightedNodes.size > 0;
  highlightedNodes = new Set(nodeIds);
  const hasNew = highlightedNodes.size > 0;

  // Access the scene's node objects and update their sprites
  const graphData = graph.graphData();
  for (const node of graphData.nodes as NodeObject[]) {
    const obj = graph.nodeThreeObjectExtend()
      ? undefined
      : (node as Record<string, unknown>).__threeObj;

    // The nodeThreeObject is stored on the node by the library
    const threeObj = obj || (node as Record<string, unknown>).__threeObj;
    if (!threeObj) continue;

    const userData = (threeObj as { userData: Record<string, unknown> }).userData;
    const sprite = userData?.sprite as { material?: { opacity: number }; color?: string } | undefined;
    if (!sprite) continue;

    const nodeId = String(node.id ?? "");
    const originalColor = (userData.originalColor as string) ?? "#ffffff";

    if (hasNew) {
      if (highlightedNodes.has(nodeId)) {
        // Highlighted: bright white with full opacity
        sprite.color = "#ffffff";
        if (sprite.material) sprite.material.opacity = 1;
      } else {
        // Dimmed: low opacity, original color
        sprite.color = originalColor;
        if (sprite.material) sprite.material.opacity = 0.15;
      }
    } else {
      // No highlights: restore defaults
      sprite.color = originalColor;
      if (sprite.material) sprite.material.opacity = 1;
    }
  }
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
