/**
 * Camera motion module — manages three camera modes.
 *
 * - **Orbit**: Slowly orbits the graph center. Resumes after user inactivity.
 * - **Follow**: Drifts toward the brightest highlighted node during playback.
 * - **Free**: User has full manual control, no auto-movement.
 *
 * @module graph/camera-motion
 */

import type { GraphInstance } from "./graph";
import { getNodeBrightness, hasHighlights } from "./highlight";
import type { NodeObject } from "three-forcegraph";

export type CameraMode = "orbit" | "follow" | "free";

/** How long to pause auto-camera after user interaction (ms). */
const PAUSE_DURATION_MS = 6000;

const ORBIT_SPEED = (2 * Math.PI) / 90;
const ORBIT_RADIUS = 450;
const ORBIT_Y_AMPLITUDE = 50;
const ORBIT_Y_PERIOD = 30;
const FOLLOW_LERP = 0.008;
const FOLLOW_DISTANCE = 150;

interface CameraState {
  graph: GraphInstance;
  container: HTMLElement;
  mode: CameraMode;
  lastInteraction: number;
  orbitAngle: number;
  currentPos: { x: number; y: number; z: number };
  currentLookAt: { x: number; y: number; z: number };
  initialized: boolean;
  rafId: number | null;
  running: boolean;
  lastTime: number;
}

let state: CameraState | null = null;

/** Listeners notified when mode changes. */
const modeListeners: Array<(mode: CameraMode) => void> = [];

/**
 * Initializes the camera motion system. Call once after graph creation.
 */
export function initCameraMotion(
  graph: GraphInstance,
  container: HTMLElement
): void {
  state = {
    graph,
    container,
    mode: "orbit",
    lastInteraction: 0,
    orbitAngle: 0,
    currentPos: { x: 0, y: ORBIT_Y_AMPLITUDE, z: ORBIT_RADIUS },
    currentLookAt: { x: 0, y: 0, z: 0 },
    initialized: false,
    rafId: null,
    running: false,
    lastTime: 0,
  };

  const markInteraction = () => {
    if (state) state.lastInteraction = performance.now();
  };

  container.addEventListener("mousedown", markInteraction);
  container.addEventListener("wheel", markInteraction, { passive: true });
  container.addEventListener("touchstart", markInteraction, { passive: true });

  state.running = true;
  state.lastTime = performance.now();
  state.rafId = requestAnimationFrame(tick);
}

/** Sets the camera mode. */
export function setCameraMode(mode: CameraMode): void {
  if (state) state.mode = mode;
  for (const fn of modeListeners) fn(mode);
}

/** Returns the current camera mode. */
export function getCameraMode(): CameraMode {
  return state?.mode ?? "orbit";
}

/** Registers a callback for mode changes. */
export function onCameraModeChange(fn: (mode: CameraMode) => void): void {
  modeListeners.push(fn);
}

/** Notifies the camera that the user clicked a node. */
export function notifyNodeClick(): void {
  if (state) state.lastInteraction = performance.now();
}

/** Stops the camera system. */
export function stopCameraMotion(): void {
  if (state) {
    state.running = false;
    if (state.rafId !== null) {
      cancelAnimationFrame(state.rafId);
      state.rafId = null;
    }
  }
}

function tick(timestamp: number): void {
  if (!state || !state.running) return;

  const dt = Math.min((timestamp - state.lastTime) / 1000, 0.1);
  state.lastTime = timestamp;

  if (state.mode === "free") {
    // No auto-movement
  } else if (state.mode === "orbit") {
    const timeSinceInteraction = timestamp - state.lastInteraction;
    if (timeSinceInteraction > PAUSE_DURATION_MS) {
      updateOrbit(dt, timestamp);
    }
  } else if (state.mode === "follow") {
    const timeSinceInteraction = timestamp - state.lastInteraction;
    if (timeSinceInteraction > PAUSE_DURATION_MS) {
      if (hasHighlights()) {
        updateFollow(dt);
      } else {
        updateOrbit(dt, timestamp);
      }
    }
  }

  state.rafId = requestAnimationFrame(tick);
}

function updateOrbit(dt: number, timestamp: number): void {
  if (!state) return;

  state.orbitAngle += ORBIT_SPEED * dt;
  const targetPos = {
    x: Math.cos(state.orbitAngle) * ORBIT_RADIUS,
    y: Math.sin(timestamp / 1000 / ORBIT_Y_PERIOD * 2 * Math.PI) * ORBIT_Y_AMPLITUDE,
    z: Math.sin(state.orbitAngle) * ORBIT_RADIUS,
  };
  const targetLookAt = { x: 0, y: 0, z: 0 };

  if (!state.initialized) {
    state.currentPos = { ...targetPos };
    state.currentLookAt = { ...targetLookAt };
    state.initialized = true;
  } else {
    lerpVec(state.currentPos, targetPos, 0.015);
    lerpVec(state.currentLookAt, targetLookAt, 0.015);
  }

  state.graph.cameraPosition(state.currentPos, state.currentLookAt, 0);
}

function updateFollow(dt: number): void {
  if (!state) return;

  const target = findBrightestNode();
  if (!target) return;

  // Orbit slowly around the target
  state.orbitAngle += ORBIT_SPEED * 0.3 * dt;
  const targetPos = {
    x: target.x + Math.cos(state.orbitAngle * 0.3) * FOLLOW_DISTANCE,
    y: target.y + FOLLOW_DISTANCE * 0.3,
    z: target.z + Math.sin(state.orbitAngle * 0.3) * FOLLOW_DISTANCE,
  };

  if (!state.initialized) {
    state.currentPos = { ...targetPos };
    state.currentLookAt = { ...target };
    state.initialized = true;
  } else {
    lerpVec(state.currentPos, targetPos, FOLLOW_LERP);
    lerpVec(state.currentLookAt, target, FOLLOW_LERP);
  }

  state.graph.cameraPosition(state.currentPos, state.currentLookAt, 0);
}

function findBrightestNode(): { x: number; y: number; z: number } | null {
  if (!state) return null;

  const brightness = getNodeBrightness();
  if (brightness.size === 0) return null;

  const nodes = state.graph.graphData().nodes as NodeObject[];
  let best: NodeObject | null = null;
  let bestB = 0;

  for (const node of nodes) {
    const b = brightness.get(String(node.id ?? ""));
    if (b != null && b > bestB) {
      bestB = b;
      best = node;
    }
  }

  if (!best || best.x == null || best.y == null || best.z == null) return null;
  return { x: best.x, y: best.y, z: best.z };
}

function lerpVec(
  current: { x: number; y: number; z: number },
  target: { x: number; y: number; z: number },
  t: number
): void {
  current.x += (target.x - current.x) * t;
  current.y += (target.y - current.y) * t;
  current.z += (target.z - current.z) * t;
}
