/**
 * Highlight module — manages visual highlighting of graph nodes with
 * cumulative intensity and fade decay.
 *
 * Each note trigger adds a small increment of brightness to matching
 * scale nodes. Brightness decays exponentially over time. Scales that
 * are triggered repeatedly (e.g., during a song) accumulate brightness
 * and glow more intensely, naturally revealing the most-used scales.
 *
 * Brightness is capped at 1.0 and decays with a ~3s half-life.
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

/** How much brightness each trigger adds (0–1 scale). */
const TRIGGER_INCREMENT = 0.25;

/** Decay rate — brightness multiplied by this per second. ~3s to fade from 1→0.05 */
const DECAY_RATE = 0.35;

/** Brightness below this is considered "off". */
const BRIGHTNESS_THRESHOLD = 0.02;

/** Per-node highlight state. */
interface NodeHighlightState {
  /** Current brightness (0–1, cumulative). */
  brightness: number;
}

/** Highlight state for all nodes. */
const nodeStates = new Map<string, NodeHighlightState>();

/** The graph instance for the animation loop. */
let graphRef: GraphInstance | null = null;

/** Animation frame ID. */
let rafId: number | null = null;

/** Whether the animation loop is running. */
let loopRunning = false;

/** Last frame timestamp for delta-time calculation. */
let lastFrameTime = 0;

/**
 * Starts the highlight animation loop. Call once after graph initialization.
 */
export function startHighlightLoop(graph: GraphInstance): void {
  graphRef = graph;
  if (!loopRunning) {
    loopRunning = true;
    lastFrameTime = performance.now();
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
 * Triggers highlights on the given node IDs. Each trigger adds
 * TRIGGER_INCREMENT brightness (cumulative, capped at 1.0).
 * Repeated triggers on the same node build up intensity.
 */
export function triggerHighlights(nodeIds: Set<string>): void {
  for (const id of nodeIds) {
    const existing = nodeStates.get(id);
    const currentBrightness = existing ? existing.brightness : 0;
    nodeStates.set(id, {
      brightness: Math.min(1, currentBrightness + TRIGGER_INCREMENT),
    });
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
 * Returns whether any nodes are currently highlighted (brightness > threshold).
 */
export function hasHighlights(): boolean {
  for (const state of nodeStates.values()) {
    if (state.brightness > BRIGHTNESS_THRESHOLD) return true;
  }
  return false;
}

/**
 * Returns the current set of highlighted node IDs (brightness > threshold).
 */
export function getHighlightedNodes(): ReadonlySet<string> {
  const result = new Set<string>();
  for (const [id, state] of nodeStates) {
    if (state.brightness > BRIGHTNESS_THRESHOLD) result.add(id);
  }
  return result;
}

/**
 * Returns a map of node ID → brightness for all currently glowing nodes.
 * Used by the camera motion module to compute the weighted focus point.
 */
export function getNodeBrightness(): ReadonlyMap<string, number> {
  const result = new Map<string, number>();
  for (const [id, state] of nodeStates) {
    if (state.brightness > BRIGHTNESS_THRESHOLD) {
      result.set(id, state.brightness);
    }
  }
  return result;
}

/** Animation loop — decays brightness and applies visuals each frame. */
function animationTick(timestamp: number): void {
  if (!loopRunning || !graphRef) return;

  const dt = (timestamp - lastFrameTime) / 1000; // delta in seconds
  lastFrameTime = timestamp;

  // Exponential decay: brightness *= DECAY_RATE^dt
  const decayFactor = Math.pow(DECAY_RATE, dt);

  const toRemove: string[] = [];
  for (const [id, state] of nodeStates) {
    state.brightness *= decayFactor;
    if (state.brightness < BRIGHTNESS_THRESHOLD) {
      toRemove.push(id);
    }
  }

  for (const id of toRemove) {
    nodeStates.delete(id);
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

    const userData = (threeObj as { userData: Record<string, unknown> })
      .userData;
    const sprite = userData?.sprite as {
      material?: { opacity: number };
      color?: string;
    } | undefined;
    // Star core mesh (small bright sphere)
    const core = userData?.core as {
      material?: { opacity: number; color?: { setStyle: (c: string) => void } };
      scale?: { setScalar: (s: number) => void };
    } | undefined;
    // Glow sprite (additive halo)
    const glow = userData?.glow as {
      material?: { opacity: number; color?: { setStyle: (c: string) => void } };
      scale?: { set: (x: number, y: number, z: number) => void };
    } | undefined;

    const nodeId = String(node.id ?? "");
    const originalColor = (userData?.originalColor as string) ?? "#ffffff";
    const state = nodeStates.get(nodeId);

    if (state && state.brightness > BRIGHTNESS_THRESHOLD) {
      const b = state.brightness;
      // Highlighted: text brightens toward white
      if (sprite) {
        sprite.color = lerpColor(originalColor, "#ffffff", b);
        if (sprite.material) sprite.material.opacity = 0.4 + 0.6 * b;
      }
      // Core pulses brighter and slightly larger
      if (core) {
        if (core.material) core.material.opacity = 0.8 + 0.2 * b;
        if (core.scale) core.scale.setScalar(1 + b * 0.8);
        if (core.material?.color) core.material.color.setStyle(lerpColor(originalColor, "#ffffff", b * 0.7));
      }
      // Glow expands and brightens
      if (glow) {
        const glowSize = 14 + b * 16;
        if (glow.scale) glow.scale.set(glowSize, glowSize, 1);
        if (glow.material) glow.material.opacity = 0.35 + b * 0.5;
      }
    } else if (anyHighlighted) {
      // Dimmed: other nodes while some are highlighted
      if (sprite) {
        sprite.color = originalColor;
        if (sprite.material) sprite.material.opacity = 0.12;
      }
      if (core) {
        if (core.material) core.material.opacity = 0.25;
        if (core.scale) core.scale.setScalar(0.6);
      }
      if (glow) {
        if (glow.material) glow.material.opacity = 0.05;
        if (glow.scale) glow.scale.set(8, 8, 1);
      }
    } else {
      // Default: no highlights active
      if (sprite) {
        sprite.color = originalColor;
        if (sprite.material) sprite.material.opacity = 1;
      }
      if (core) {
        if (core.material) core.material.opacity = 0.9;
        if (core.scale) core.scale.setScalar(1);
        if (core.material?.color) core.material.color.setStyle(lerpColor(originalColor, "#ffffff", 0.5));
      }
      if (glow) {
        if (glow.material) glow.material.opacity = 0.35;
        if (glow.scale) glow.scale.set(14, 14, 1);
      }
    }
  }
}

/**
 * Linearly interpolates between two hex colors.
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
