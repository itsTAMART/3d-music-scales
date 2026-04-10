/**
 * Music theory utilities — note normalization, scale matching, and helpers.
 *
 * Provides functions to normalize enharmonic note names, convert between
 * note representations, and match a set of active notes against the scale dictionary.
 *
 * @module music/note-utils
 *
 * @example
 * ```ts
 * import { normalizeNote, matchScales } from "@/music/note-utils";
 * normalizeNote("Db"); // "C#"
 * ```
 */

import { NOTE_NAMES, type NoteName, type ScaleDict, type ScaleMatch } from "../types";

/** Map of flat note names to their sharp equivalents. */
const FLAT_TO_SHARP: Record<string, NoteName> = {
  Db: "C#",
  Eb: "D#",
  Fb: "E",
  Gb: "F#",
  Ab: "G#",
  Bb: "A#",
  Cb: "B",
};

/**
 * Normalizes a note name to use sharps (e.g., "Db" -> "C#", "E" -> "E").
 * Strips octave numbers if present (e.g., "C4" -> "C").
 * Returns null if the input is not a valid note name.
 */
export function normalizeNote(input: string): NoteName | null {
  // Strip octave number
  const cleaned = input.replace(/\d+$/, "").trim();

  // Check flat names first
  if (cleaned in FLAT_TO_SHARP) {
    return FLAT_TO_SHARP[cleaned];
  }

  // Check if it's already a valid sharp/natural note name
  if ((NOTE_NAMES as readonly string[]).includes(cleaned)) {
    return cleaned as NoteName;
  }

  return null;
}

/**
 * Converts a MIDI note number (0-127) to a note name.
 * Middle C (C4) = MIDI 60.
 */
export function midiToNoteName(midiNote: number): NoteName {
  return NOTE_NAMES[midiNote % 12];
}

/**
 * Matches a set of active notes against the scale dictionary.
 * Returns scales sorted by match score (best match first).
 *
 * Only returns scales where at least one active note matches.
 */
export function matchScales(
  activeNotes: Set<NoteName>,
  scaleDict: ScaleDict
): ScaleMatch[] {
  if (activeNotes.size === 0) return [];

  const results: ScaleMatch[] = [];

  for (const [scaleId, info] of Object.entries(scaleDict)) {
    const scaleNotes = new Set(
      info.notes.map((n) => normalizeNote(n)).filter(Boolean)
    );

    let matchCount = 0;
    for (const note of activeNotes) {
      if (scaleNotes.has(note)) matchCount++;
    }

    if (matchCount > 0) {
      results.push({
        scaleId,
        matchCount,
        totalNotes: info.notes.length,
        score: matchCount / activeNotes.size,
      });
    }
  }

  // Sort: highest score first, then by fewer total notes (more specific scale)
  results.sort((a, b) => b.score - a.score || a.totalNotes - b.totalNotes);

  return results;
}

/**
 * Finds all scales/chords whose notes are ALL contained in the active notes.
 * A chord/scale lights up only when every single note it contains is being played.
 * Returns the IDs of matching entries.
 */
export function findFullyActiveEntries(
  activeNotes: Set<NoteName>,
  scaleDict: ScaleDict
): string[] {
  if (activeNotes.size === 0) return [];

  const results: string[] = [];

  for (const [id, info] of Object.entries(scaleDict)) {
    const entryNotes = info.notes
      .map((n) => normalizeNote(n))
      .filter(Boolean) as NoteName[];

    if (entryNotes.length === 0) continue;

    // Check: are ALL notes of this entry currently active?
    const allActive = entryNotes.every((n) => activeNotes.has(n));
    if (allActive) {
      results.push(id);
    }
  }

  return results;
}

/**
 * Extracts the note name (tonic) from a scale ID string.
 * e.g., "C Major Scale" -> "C", "F# Blues Scale" -> "F#"
 */
export function extractTonic(scaleId: string): string {
  const match = scaleId.match(/^([A-G]#?)/);
  return match ? match[1] : "";
}

/**
 * Gets the link node ID, handling the case where source/target
 * may be a string or an object reference (after graph initialization).
 */
export function getLinkNodeId(node: string | { id: string }): string {
  return typeof node === "string" ? node : node.id;
}
