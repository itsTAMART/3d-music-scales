/**
 * Keyboard bindings module — maps physical keyboard keys to piano notes.
 *
 * Uses the classic two-row piano layout where the bottom row of QWERTY
 * keys plays the lower octave and the top row plays the upper octave.
 * Black keys are on the row above their corresponding white keys.
 *
 * Lower octave (C3–B3):
 *   White: A S D F G H J
 *   Black:  W E   T Y U
 *
 * Upper octave (C4–B4):
 *   White: K L ; ' (and Z X C for remaining)
 *   Black:  O P   [ ]
 *
 * @module piano/keyboard-bindings
 *
 * @example
 * ```ts
 * import { initKeyboardBindings } from "@/piano/keyboard-bindings";
 * initKeyboardBindings();
 * ```
 */

import type { NoteName, NoteEventDetail } from "../types";

/**
 * Maps keyboard key codes to {note, octave} pairs.
 * Uses KeyboardEvent.code for layout-independent mapping.
 */
const KEY_MAP: Record<string, { note: NoteName; octave: number }> = {
  // Lower octave (C3–B3) — white keys on home row
  KeyA: { note: "C", octave: 3 },
  KeyS: { note: "D", octave: 3 },
  KeyD: { note: "E", octave: 3 },
  KeyF: { note: "F", octave: 3 },
  KeyG: { note: "G", octave: 3 },
  KeyH: { note: "A", octave: 3 },
  KeyJ: { note: "B", octave: 3 },

  // Lower octave — black keys on top row
  KeyW: { note: "C#", octave: 3 },
  KeyE: { note: "D#", octave: 3 },
  KeyT: { note: "F#", octave: 3 },
  KeyY: { note: "G#", octave: 3 },
  KeyU: { note: "A#", octave: 3 },

  // Upper octave (C4–B4) — white keys continue right
  KeyK: { note: "C", octave: 4 },
  KeyL: { note: "D", octave: 4 },
  Semicolon: { note: "E", octave: 4 },
  Quote: { note: "F", octave: 4 },
  KeyZ: { note: "G", octave: 4 },
  KeyX: { note: "A", octave: 4 },
  KeyC: { note: "B", octave: 4 },

  // Upper octave — black keys
  KeyO: { note: "C#", octave: 4 },
  KeyP: { note: "D#", octave: 4 },
  BracketLeft: { note: "F#", octave: 4 },
  BracketRight: { note: "G#", octave: 4 },
  Backslash: { note: "A#", octave: 4 },
};

/** Set of currently held keys to prevent key-repeat firing multiple events. */
const heldKeys = new Set<string>();

/**
 * Initializes keyboard event listeners for piano input.
 * Pressing a mapped key dispatches `piano:noteon`, releasing dispatches `piano:noteoff`.
 * Key repeat is suppressed (holding a key only triggers one noteon).
 */
export function initKeyboardBindings(): void {
  document.addEventListener("keydown", handleKeyDown);
  document.addEventListener("keyup", handleKeyUp);
}

/**
 * Removes keyboard event listeners (cleanup).
 */
export function removeKeyboardBindings(): void {
  document.removeEventListener("keydown", handleKeyDown);
  document.removeEventListener("keyup", handleKeyUp);
  heldKeys.clear();
}

/**
 * Returns the key mapping for display/help purposes.
 */
export function getKeyMap(): ReadonlyMap<string, { note: NoteName; octave: number }> {
  return new Map(Object.entries(KEY_MAP));
}

function handleKeyDown(e: KeyboardEvent): void {
  // Don't intercept when typing in an input/textarea
  if (isTypingTarget(e.target)) return;

  const mapping = KEY_MAP[e.code];
  if (!mapping) return;

  // Suppress key repeat
  if (heldKeys.has(e.code)) return;
  heldKeys.add(e.code);

  e.preventDefault();
  const detail: NoteEventDetail = { note: mapping.note };
  document.dispatchEvent(new CustomEvent("piano:noteon", { detail }));
}

function handleKeyUp(e: KeyboardEvent): void {
  if (isTypingTarget(e.target)) return;

  const mapping = KEY_MAP[e.code];
  if (!mapping) return;

  heldKeys.delete(e.code);

  e.preventDefault();
  const detail: NoteEventDetail = { note: mapping.note };
  document.dispatchEvent(new CustomEvent("piano:noteoff", { detail }));
}

/** Returns true if the event target is a text input element. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}
