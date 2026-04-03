/**
 * Notation module — manages ABC vs Solfège note name display.
 *
 * Provides a global notation mode that all UI components read from,
 * and a function to convert note names between systems.
 *
 * @module music/notation
 *
 * @example
 * ```ts
 * import { displayNote, setNotation, getNotation } from "@/music/notation";
 * displayNote("C");  // "C" (ABC mode)
 * setNotation("solfege");
 * displayNote("C");  // "Do"
 * ```
 */

import type { NoteName } from "../types";

export type NotationMode = "abc" | "solfege";

/** ABC → Solfège mapping. */
const SOLFEGE_MAP: Record<NoteName, string> = {
  C: "Do",
  "C#": "Do#",
  D: "Re",
  "D#": "Re#",
  E: "Mi",
  F: "Fa",
  "F#": "Fa#",
  G: "Sol",
  "G#": "Sol#",
  A: "La",
  "A#": "La#",
  B: "Si",
};

/** Current notation mode. */
let currentMode: NotationMode = "abc";

/** Listeners for notation changes. */
const listeners: Array<(mode: NotationMode) => void> = [];

/**
 * Returns the display string for a note in the current notation mode.
 */
export function displayNote(note: string): string {
  if (currentMode === "solfege") {
    return SOLFEGE_MAP[note as NoteName] ?? note;
  }
  return note;
}

/**
 * Converts an array of note names to display strings.
 */
export function displayNotes(notes: string[]): string[] {
  return notes.map(displayNote);
}

/**
 * Sets the notation mode globally and notifies listeners.
 */
export function setNotation(mode: NotationMode): void {
  currentMode = mode;
  for (const listener of listeners) {
    listener(mode);
  }
}

/**
 * Returns the current notation mode.
 */
export function getNotation(): NotationMode {
  return currentMode;
}

/**
 * Registers a callback for notation mode changes.
 */
export function onNotationChange(callback: (mode: NotationMode) => void): void {
  listeners.push(callback);
}
