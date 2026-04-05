/**
 * Piano keyboard module — renders an interactive SVG piano.
 *
 * Creates a 2-octave (C3–B4) SVG keyboard. Keys emit custom DOM events
 * (`piano:noteon` / `piano:noteoff`) when pressed/released, which other
 * modules listen to for highlighting and analysis.
 *
 * @module piano/piano
 *
 * @example
 * ```ts
 * import { createPiano } from "@/piano/piano";
 * createPiano(document.getElementById("bottom-panel")!);
 * ```
 */

import type { NoteName, NoteEventDetail } from "../types";
import { NOTE_NAMES } from "../types";
import "./piano.css";

/** Piano key configuration. */
interface KeyConfig {
  note: NoteName;
  octave: number;
  isBlack: boolean;
}

/** White key dimensions. */
const WHITE_KEY_WIDTH = 20;
const WHITE_KEY_HEIGHT = 42;

/** Black key dimensions. */
const BLACK_KEY_WIDTH = 12;
const BLACK_KEY_HEIGHT = 26;

/** Which note indices (0-11) are black keys. */
const BLACK_KEY_INDICES = new Set([1, 3, 6, 8, 10]); // C#, D#, F#, G#, A#

/** Black key X offsets relative to the preceding white key's right edge. */
const BLACK_KEY_OFFSETS: Record<number, number> = {
  1: -8,  // C#
  3: -4,  // D#
  6: -8,  // F#
  8: -6,  // G#
  10: -4, // A#
};

/** Set of currently pressed keys (for visual state). */
const pressedKeys = new Set<string>();

/**
 * Creates the SVG piano keyboard and appends it to the container.
 * Returns the SVG element for external manipulation (e.g., MIDI highlighting).
 */
export function createPiano(container: HTMLElement): SVGSVGElement {
  const keys = generateKeys(3, 5); // C3 to B4 (2 octaves)
  const whiteKeys = keys.filter((k) => !k.isBlack);
  const blackKeys = keys.filter((k) => k.isBlack);

  const totalWidth = whiteKeys.length * WHITE_KEY_WIDTH;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${totalWidth} ${WHITE_KEY_HEIGHT}`);
  svg.setAttribute("class", "piano-keyboard");
  svg.setAttribute("role", "group");
  svg.setAttribute("aria-label", "Piano keyboard");

  // Render white keys first (they go behind black keys)
  let whiteIndex = 0;
  for (const key of whiteKeys) {
    const rect = createKeyRect(
      whiteIndex * WHITE_KEY_WIDTH,
      0,
      WHITE_KEY_WIDTH - 1, // 1px gap between whites
      WHITE_KEY_HEIGHT,
      key,
      "piano-key piano-key--white"
    );
    svg.appendChild(rect);
    whiteIndex++;
  }

  // Render black keys on top
  whiteIndex = 0;
  let keyIdx = 0;
  for (const key of keys) {
    if (key.isBlack) {
      const noteIdx = NOTE_NAMES.indexOf(key.note);
      const offset = BLACK_KEY_OFFSETS[noteIdx] ?? -11;
      const x = whiteIndex * WHITE_KEY_WIDTH + offset;

      const rect = createKeyRect(
        x,
        0,
        BLACK_KEY_WIDTH,
        BLACK_KEY_HEIGHT,
        key,
        "piano-key piano-key--black"
      );
      svg.appendChild(rect);
    } else {
      if (keyIdx > 0) whiteIndex++;
      // whiteIndex tracks position
      if (keyIdx === 0) {
        // first key, whiteIndex stays 0
      }
    }
    keyIdx++;
  }

  // Wrapper div for centering and padding
  const wrapper = document.createElement("div");
  wrapper.className = "piano-wrapper";
  wrapper.appendChild(svg);

  container.appendChild(wrapper);

  return svg;
}

/**
 * Programmatically highlights a key on the piano (e.g., from MIDI input).
 * Uses the `piano-key--active` CSS class.
 */
export function highlightPianoKey(
  svg: SVGSVGElement,
  note: NoteName,
  active: boolean
): void {
  const keyId = `key-${note}`;
  // Find all keys matching this note (may span multiple octaves)
  const keys = svg.querySelectorAll(`[data-note="${note}"]`);
  keys.forEach((key) => {
    if (active) {
      key.classList.add("piano-key--active");
    } else {
      key.classList.remove("piano-key--active");
    }
  });

  if (active) {
    pressedKeys.add(keyId);
  } else {
    pressedKeys.delete(keyId);
  }
}

/**
 * Clears all highlighted keys on the piano.
 */
export function clearPianoHighlights(svg: SVGSVGElement): void {
  svg.querySelectorAll(".piano-key--active").forEach((key) => {
    key.classList.remove("piano-key--active");
  });
  pressedKeys.clear();
}

/** Generates key configs for the given octave range [startOctave, endOctave). */
function generateKeys(startOctave: number, endOctave: number): KeyConfig[] {
  const keys: KeyConfig[] = [];
  for (let oct = startOctave; oct < endOctave; oct++) {
    for (let i = 0; i < 12; i++) {
      keys.push({
        note: NOTE_NAMES[i],
        octave: oct,
        isBlack: BLACK_KEY_INDICES.has(i),
      });
    }
  }
  return keys;
}

/** Creates an SVG rect element for a piano key with event handlers. */
function createKeyRect(
  x: number,
  y: number,
  width: number,
  height: number,
  key: KeyConfig,
  className: string
): SVGRectElement {
  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect.setAttribute("x", String(x));
  rect.setAttribute("y", String(y));
  rect.setAttribute("width", String(width));
  rect.setAttribute("height", String(height));
  rect.setAttribute("rx", "3");
  rect.setAttribute("class", className);
  rect.setAttribute("data-note", key.note);
  rect.setAttribute("data-octave", String(key.octave));
  rect.setAttribute("role", "button");
  rect.setAttribute("aria-label", `${key.note}${key.octave}`);

  // Mouse/touch events
  const onPress = (e: Event) => {
    e.preventDefault();
    rect.classList.add("piano-key--pressed");
    dispatchNoteEvent("piano:noteon", key.note);
  };

  const onRelease = (e: Event) => {
    e.preventDefault();
    rect.classList.remove("piano-key--pressed");
    dispatchNoteEvent("piano:noteoff", key.note);
  };

  rect.addEventListener("mousedown", onPress);
  rect.addEventListener("mouseup", onRelease);
  rect.addEventListener("mouseleave", onRelease);
  rect.addEventListener("touchstart", onPress, { passive: false });
  rect.addEventListener("touchend", onRelease, { passive: false });

  return rect;
}

/** Dispatches a custom note event on the document. */
function dispatchNoteEvent(type: string, note: NoteName): void {
  const detail: NoteEventDetail = { note };
  document.dispatchEvent(new CustomEvent(type, { detail }));
}
