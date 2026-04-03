/**
 * Highlight module — manages visual highlighting of graph nodes with fade decay.
 *
 * When notes are played, matching scale nodes light up brightly then
 * gradually fade back to their original state over ~2 seconds, like
 * the decay of a musical note. Uses requestAnimationFrame for smooth
 * per-frame interpolation.
 *
 * @module graph/highlight
 *
 * @example
 * ```ts
 * import { triggerHighlights, startHighlightLoop } from "@/graph/highlight";
 * startHighlightLoop(graph);
 * triggerHighlights(new Set(["C Major Scale"]));
 * ```
 */

import type { GraphInstance } from "./graph";
import type { NodeObject } from "three-forcegraph";

/** How long a highlight takes to fully fade out (ms). */
const FADE_DURATION_MS = 2000;

/** Per-node highlight state tracking fade progress. */
interface NodeHighlightState {
  /** Current brightness (1 = fully lit, 0 = default). */
  brightness: number;
  /** Timestamp when the node was last triggered. */
  triggeredAt: number;
}

/** Highlight state for all nodes. */
const nodeStates = new Map<string, NodeHighlightState>();

/** The graph instance for the animation loop. */
let graphRef: GraphInstance | null = null;

/** Animation frame ID. */
let rafId: number | null = null;

/** Whether the animation loop is running. */
let loopRunning = false;

/**
 * Starts the highlight animation loop. Call once after graph initialization.
 * The loop runs continuously and updates node opacities each frame.
 */
export function startHighlightLoop(graph: GraphInstance): void {
  graphRef = graph;
  if (!loopRunning) {
    loopRunning = true;
    rafId = requestAnimationFrame(animationTick);
  }
}

/**
 * Stops the highlight animation loop.
 */
export function stopHighlightLoop(): void {
  loopRunning = false;
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

/**
 * Triggers highlights on the given node IDs. Each triggered node
 * jumps to full brightness and then fades out over FADE_DURATION_MS.
 * Calling this again on the same node resets its fade timer.
 */
export function triggerHighlights(nodeIds: Set<string>): void {
  const now = performance.now();
  for (const id of nodeIds) {
    nodeStates.set(id, { brightness: 1, triggeredAt: now });
  }
}

/**
 * Clears all highlights immediately, restoring all nodes to default.
 */
export function clearHighlights(graph: GraphInstance): void {
  nodeStates.clear();
  applyVisuals(graph);
}

/**
 * Returns whether any nodes are currently highlighted (brightness > 0).
 */
export function hasHighlights(): boolean {
  for (const state of nodeStates.values()) {
    if (state.brightness > 0.01) return true;
  }
  return false;
}

/**
 * Returns the current set of highlighted node IDs (brightness > threshold).
 */
export function getHighlightedNodes(): ReadonlySet<string> {
  const result = new Set<string>();
  for (const [id, state] of nodeStates) {
    if (state.brightness > 0.01) result.add(id);
  }
  return result;
}

/** Animation loop — updates fade state and applies visuals each frame. */
function animationTick(timestamp: number): void {
  if (!loopRunning || !graphRef) return;

  // Update brightness based on elapsed time
  let anyActive = false;
  for (const [id, state] of nodeStates) {
    const elapsed = timestamp - state.triggeredAt;
    if (elapsed >= FADE_DURATION_MS) {
      state.brightness = 0;
    } else {
      // Exponential decay for a natural sound-like fade
      state.brightness = Math.exp(-3 * (elapsed / FADE_DURATION_MS));
      anyActive = true;
    }
  }

  // Clean up fully faded nodes
  if (!anyActive) {
    nodeStates.clear();
  }

  applyVisuals(graphRef);
  rafId = requestAnimationFrame(animationTick);
}

/** Applies current brightness values to the Three.js node objects. */
function applyVisuals(graph: GraphInstance): void {
  const graphData = graph.graphData();
  const anyHighlighted = hasHighlights();

  for (const node of graphData.nodes as NodeObject[]) {
    const threeObj = (node as Record<string, unknown>).__threeObj;
    if (!threeObj) continue;

    const userData = (threeObj as { userData: Record<string, unknown> }).userData;
    const sprite = userData?.sprite as {
      material?: { opacity: number };
      color?: string;
    } | undefined;
    if (!sprite) continue;

    const nodeId = String(node.id ?? "");
    const originalColor = (userData.originalColor as string) ?? "#ffffff";
    const state = nodeStates.get(nodeId);

    if (state && state.brightness > 0.01) {
      // Highlighted: interpolate between original color and white based on brightness
      sprite.color = lerpColor(originalColor, "#ffffff", state.brightness);
      if (sprite.material) {
        sprite.material.opacity = 0.3 + 0.7 * state.brightness;
      }
    } else if (anyHighlighted) {
      // Dimmed: other nodes while some are highlighted
      sprite.color = originalColor;
      if (sprite.material) sprite.material.opacity = 0.15;
    } else {
      // Default: no highlights active
      sprite.color = originalColor;
      if (sprite.material) sprite.material.opacity = 1;
    }
  }
}

/**
 * Linearly interpolates between two hex colors.
 * @param from - Start color (hex string like "#ff0000")
 * @param to - End color
 * @param t - Interpolation factor (0 = from, 1 = to)
 */
function lerpColor(from: string, to: string, t: number): string {
  const f = parseHex(from);
  const toC = parseHex(to);
  const r = Math.round(f.r + (toC.r - f.r) * t);
  const g = Math.round(f.g + (toC.g - f.g) * t);
  const b = Math.round(f.b + (toC.b - f.b) * t);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function parseHex(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  return {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16),
  };
}
