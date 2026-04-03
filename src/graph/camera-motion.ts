/**
 * Camera motion module — cinematic auto-camera for idle and music modes.
 *
 * **Idle mode**: When the user hasn't interacted, the camera slowly orbits
 * the graph center like a galaxy visualization — gentle, continuous rotation.
 *
 * **Music mode**: When notes are being played (highlights are active), the
 * camera drifts toward the brightness-weighted center-of-mass of the glowing
 * nodes. Movement is very slow (lerp ~0.008/frame) to avoid motion sickness.
 *
 * **User override**: Any mouse/touch/wheel interaction pauses auto-camera
 * for PAUSE_DURATION_MS, then it gently resumes. Node clicks also pause.
 *
 * @module graph/camera-motion
 *
 * @example
 * ```ts
 * import { initCameraMotion } from "@/graph/camera-motion";
 * initCameraMotion(graph, graphContainer);
 * ```
 */

import type { GraphInstance } from "./graph";
import { getNodeBrightness, hasHighlights } from "./highlight";
import type { NodeObject } from "three-forcegraph";

/** How long to pause auto-camera after user interaction (ms). */
const PAUSE_DURATION_MS = 8000;

/** Idle orbit: radians per second. One full rotation in ~90s. */
const ORBIT_SPEED = (2 * Math.PI) / 90;

/** Idle orbit radius — distance from center. */
const ORBIT_RADIUS = 350;

/** Idle orbit: slight vertical oscillation amplitude. */
const ORBIT_Y_AMPLITUDE = 50;

/** Idle orbit: vertical oscillation period in seconds. */
const ORBIT_Y_PERIOD = 30;

/** Music mode: how fast the camera lerps toward the target (per frame, 0–1). */
const MUSIC_LERP_SPEED = 0.008;

/** Music mode: distance from the focus point. */
const MUSIC_DISTANCE = 150;

/** Blend speed for transitioning between idle and music modes (per frame). */
const MODE_BLEND_SPEED = 0.02;

interface CameraState {
  graph: GraphInstance;
  container: HTMLElement;
  /** Timestamp of last user interaction. */
  lastInteraction: number;
  /** Current orbit angle (radians). */
  orbitAngle: number;
  /** Current camera position for smooth interpolation. */
  currentPos: { x: number; y: number; z: number };
  /** Current lookAt target for smooth interpolation. */
  currentLookAt: { x: number; y: number; z: number };
  /** Whether auto-camera is initialized (first positions set). */
  initialized: boolean;
  /** Blend factor: 0 = idle orbit, 1 = music tracking. */
  musicBlend: number;
  /** Animation frame ID. */
  rafId: number | null;
  /** Whether the loop is running. */
  running: boolean;
  /** Last frame timestamp. */
  lastTime: number;
}

let state: CameraState | null = null;

/**
 * Initializes the cinematic auto-camera system.
 * Call once after the graph is created.
 */
export function initCameraMotion(
  graph: GraphInstance,
  container: HTMLElement
): void {
  state = {
    graph,
    container,
    lastInteraction: 0, // Start in auto mode immediately
    orbitAngle: 0,
    currentPos: { x: 0, y: ORBIT_Y_AMPLITUDE, z: ORBIT_RADIUS },
    currentLookAt: { x: 0, y: 0, z: 0 },
    initialized: false,
    musicBlend: 0,
    rafId: null,
    running: false,
    lastTime: 0,
  };

  // Listen for user interactions to pause auto-camera
  const markInteraction = () => {
    if (state) state.lastInteraction = performance.now();
  };

  container.addEventListener("mousedown", markInteraction);
  container.addEventListener("wheel", markInteraction, { passive: true });
  container.addEventListener("touchstart", markInteraction, { passive: true });

  // Start the animation loop
  state.running = true;
  state.lastTime = performance.now();
  state.rafId = requestAnimationFrame(tick);
}

/**
 * Notifies the camera that the user clicked a node (pauses auto-camera).
 */
export function notifyNodeClick(): void {
  if (state) state.lastInteraction = performance.now();
}

/**
 * Stops the auto-camera system entirely.
 */
export function stopCameraMotion(): void {
  if (state) {
    state.running = false;
    if (state.rafId !== null) {
      cancelAnimationFrame(state.rafId);
      state.rafId = null;
    }
  }
}

/** Main animation tick. */
function tick(timestamp: number): void {
  if (!state || !state.running) return;

  const dt = (timestamp - state.lastTime) / 1000;
  state.lastTime = timestamp;

  // Clamp dt to avoid jumps after tab switches
  const clampedDt = Math.min(dt, 0.1);

  const timeSinceInteraction = timestamp - state.lastInteraction;
  const isUserActive = timeSinceInteraction < PAUSE_DURATION_MS;

  if (!isUserActive) {
    updateAutoCamera(clampedDt, timestamp);
  }

  state.rafId = requestAnimationFrame(tick);
}

/** Computes and applies auto-camera position. */
function updateAutoCamera(dt: number, timestamp: number): void {
  if (!state) return;

  const musicActive = hasHighlights();

  // Blend between idle and music modes
  const targetBlend = musicActive ? 1 : 0;
  state.musicBlend += (targetBlend - state.musicBlend) * MODE_BLEND_SPEED;

  // Compute idle orbit position
  state.orbitAngle += ORBIT_SPEED * dt;
  const idlePos = {
    x: Math.cos(state.orbitAngle) * ORBIT_RADIUS,
    y: Math.sin(timestamp / 1000 / ORBIT_Y_PERIOD * 2 * Math.PI) * ORBIT_Y_AMPLITUDE,
    z: Math.sin(state.orbitAngle) * ORBIT_RADIUS,
  };
  const idleLookAt = { x: 0, y: 0, z: 0 };

  // Compute music focus position
  const musicTarget = computeMusicTarget();
  const musicPos = musicTarget
    ? offsetFromTarget(musicTarget, MUSIC_DISTANCE, state.orbitAngle)
    : idlePos;
  const musicLookAt = musicTarget ?? idleLookAt;

  // Blend the two modes
  const blend = state.musicBlend;
  const targetPos = {
    x: lerp(idlePos.x, musicPos.x, blend),
    y: lerp(idlePos.y, musicPos.y, blend),
    z: lerp(idlePos.z, musicPos.z, blend),
  };
  const targetLookAt = {
    x: lerp(idleLookAt.x, musicLookAt.x, blend),
    y: lerp(idleLookAt.y, musicLookAt.y, blend),
    z: lerp(idleLookAt.z, musicLookAt.z, blend),
  };

  // Smooth interpolation toward target (very gentle)
  const lerpFactor = musicActive ? MUSIC_LERP_SPEED : 0.015;

  if (!state.initialized) {
    state.currentPos = { ...targetPos };
    state.currentLookAt = { ...targetLookAt };
    state.initialized = true;
  } else {
    state.currentPos.x = lerp(state.currentPos.x, targetPos.x, lerpFactor);
    state.currentPos.y = lerp(state.currentPos.y, targetPos.y, lerpFactor);
    state.currentPos.z = lerp(state.currentPos.z, targetPos.z, lerpFactor);
    state.currentLookAt.x = lerp(state.currentLookAt.x, targetLookAt.x, lerpFactor);
    state.currentLookAt.y = lerp(state.currentLookAt.y, targetLookAt.y, lerpFactor);
    state.currentLookAt.z = lerp(state.currentLookAt.z, targetLookAt.z, lerpFactor);
  }

  // Apply — use instant (0ms) transition since we're animating per-frame
  state.graph.cameraPosition(
    state.currentPos,
    state.currentLookAt,
    0
  );
}

/**
 * Finds the single brightest node and returns its position.
 * Avoids the center-of-mass problem where the target ends up in
 * empty space (e.g., the hole of a donut-shaped graph).
 */
function computeMusicTarget(): { x: number; y: number; z: number } | null {
  if (!state) return null;

  const brightness = getNodeBrightness();
  if (brightness.size === 0) return null;

  const nodes = state.graph.graphData().nodes as NodeObject[];

  let bestNode: NodeObject | null = null;
  let bestBrightness = 0;

  for (const node of nodes) {
    const id = String(node.id ?? "");
    const b = brightness.get(id);
    if (b != null && b > bestBrightness) {
      bestBrightness = b;
      bestNode = node;
    }
  }

  if (!bestNode || bestNode.x == null || bestNode.y == null || bestNode.z == null) {
    return null;
  }

  return { x: bestNode.x, y: bestNode.y, z: bestNode.z };
}

/**
 * Computes a camera position offset from a target point,
 * maintaining a consistent distance with slight orbit.
 */
function offsetFromTarget(
  target: { x: number; y: number; z: number },
  distance: number,
  angle: number
): { x: number; y: number; z: number } {
  return {
    x: target.x + Math.cos(angle * 0.3) * distance,
    y: target.y + distance * 0.3,
    z: target.z + Math.sin(angle * 0.3) * distance,
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
