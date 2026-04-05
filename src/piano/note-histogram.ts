/**
 * Note histogram module — tracks cumulative intensity per chromatic note
 * and renders a visual bar chart integrated above the piano keyboard.
 *
 * Each note trigger adds intensity. Intensity decays over time, similar
 * to the graph highlight system. The histogram reveals which notes are
 * being played most frequently — useful during audio analysis to see
 * the tonal profile of a piece of music.
 *
 * @module piano/note-histogram
 *
 * @example
 * ```ts
 * import { createNoteHistogram, triggerNote } from "@/piano/note-histogram";
 * const histogram = createNoteHistogram(container);
 * triggerNote("C");
 * ```
 */

import { NOTE_NAMES, type NoteName } from "../types";
import { displayNote, onNotationChange } from "../music/notation";

/** How much intensity each trigger adds. */
const TRIGGER_INCREMENT = 0.15;

/** Decay rate per second (same feel as highlight module). */
const DECAY_RATE = 0.5;

/** Maximum bar height in pixels. */
const MAX_BAR_HEIGHT = 20;

/** Intensity below this is considered zero. */
const THRESHOLD = 0.01;

/** Per-note intensity state. */
const noteIntensity = new Map<NoteName, number>();

/** DOM references for each note bar and label. */
const barElements = new Map<NoteName, HTMLDivElement>();
const labelElements = new Map<NoteName, HTMLDivElement>();

/** The histogram container element. */
let histogramEl: HTMLDivElement | null = null;

/** Animation state. */
let rafId: number | null = null;
let lastTime = 0;
let running = false;

/**
 * Creates the note histogram UI and appends it to the container.
 * Should be placed above the piano keyboard.
 */
export function createNoteHistogram(container: HTMLElement): HTMLDivElement {
  histogramEl = document.createElement("div");
  histogramEl.className = "note-histogram";

  for (const note of NOTE_NAMES) {
    const isBlack = note.includes("#");

    const column = document.createElement("div");
    column.className = `histogram-column ${isBlack ? "histogram-column--black" : "histogram-column--white"}`;

    const bar = document.createElement("div");
    bar.className = "histogram-bar";
    bar.style.height = "0px";

    const label = document.createElement("div");
    label.className = "histogram-label";
    label.textContent = displayNote(note);

    column.appendChild(bar);
    column.appendChild(label);
    histogramEl.appendChild(column);

    barElements.set(note, bar);
    labelElements.set(note, label);
    noteIntensity.set(note, 0);
  }

  container.appendChild(histogramEl);

  // Update labels when notation changes
  onNotationChange(() => {
    for (const note of NOTE_NAMES) {
      const label = labelElements.get(note);
      if (label) label.textContent = displayNote(note);
    }
  });

  // Start animation loop
  if (!running) {
    running = true;
    lastTime = performance.now();
    rafId = requestAnimationFrame(tick);
  }

  return histogramEl;
}

/**
 * Triggers a note in the histogram, adding cumulative intensity.
 */
export function triggerNote(note: NoteName): void {
  const current = noteIntensity.get(note) ?? 0;
  noteIntensity.set(note, Math.min(1, current + TRIGGER_INCREMENT));
}

/**
 * Clears all histogram bars.
 */
export function clearHistogram(): void {
  for (const note of NOTE_NAMES) {
    noteIntensity.set(note, 0);
  }
  updateBars();
}

/**
 * Returns the current intensity for a note (0–1).
 */
export function getNoteIntensity(note: NoteName): number {
  return noteIntensity.get(note) ?? 0;
}

/**
 * Stops the histogram animation loop.
 */
export function stopHistogram(): void {
  running = false;
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

/** Animation tick — decays intensities and updates bar heights. */
function tick(timestamp: number): void {
  if (!running) return;

  const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
  lastTime = timestamp;

  const decayFactor = Math.pow(DECAY_RATE, dt);

  for (const note of NOTE_NAMES) {
    let intensity = noteIntensity.get(note) ?? 0;
    intensity *= decayFactor;
    if (intensity < THRESHOLD) intensity = 0;
    noteIntensity.set(note, intensity);
  }

  updateBars();
  rafId = requestAnimationFrame(tick);
}

/** Updates the visual bar heights from current intensity values. */
function updateBars(): void {
  for (const note of NOTE_NAMES) {
    const bar = barElements.get(note);
    if (!bar) continue;

    const intensity = noteIntensity.get(note) ?? 0;
    const height = intensity * MAX_BAR_HEIGHT;
    bar.style.height = `${height}px`;
    bar.style.opacity = intensity > THRESHOLD ? String(0.4 + 0.6 * intensity) : "0";
  }
}
