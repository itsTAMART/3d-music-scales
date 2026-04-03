/**
 * Notation module — manages ABC vs Solfège note name display.
 *
 * @module music/notation
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

let currentMode: NotationMode = "abc";
const listeners: Array<(mode: NotationMode) => void> = [];

/** Returns the display string for a single note name. */
export function displayNote(note: string): string {
  if (currentMode === "solfege") {
    return SOLFEGE_MAP[note as NoteName] ?? note;
  }
  return note;
}

/** Converts an array of note names to display strings. */
export function displayNotes(notes: string[]): string[] {
  return notes.map(displayNote);
}

/**
 * Converts note names inside a longer string (e.g., "C# Major Scale" → "Do# Major Scale").
 * Replaces note-name prefixes (A#, C#, etc. and single letters A-G) at the start of the string.
 */
export function displayScaleName(name: string): string {
  if (currentMode === "abc") return name;

  // Match a note name at the start: e.g. "C#", "Db", "C" followed by space or (
  return name.replace(
    /^([A-G][#b]?)/,
    (match) => SOLFEGE_MAP[match as NoteName] ?? match
  );
}

/** Sets the notation mode globally and notifies listeners. */
export function setNotation(mode: NotationMode): void {
  currentMode = mode;
  for (const listener of listeners) listener(mode);
}

/** Returns the current notation mode. */
export function getNotation(): NotationMode {
  return currentMode;
}

/** Registers a callback for notation mode changes. */
export function onNotationChange(callback: (mode: NotationMode) => void): void {
  listeners.push(callback);
}
