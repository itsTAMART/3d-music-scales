/**
 * Core type definitions for the 3D Music Scales application.
 *
 * Defines the data model for scales, chords, graph nodes/links,
 * and the events used to communicate between modules.
 *
 * @module types
 */

/** The 12 chromatic note names using sharps. */
export type NoteName =
  | "C"
  | "C#"
  | "D"
  | "D#"
  | "E"
  | "F"
  | "F#"
  | "G"
  | "G#"
  | "A"
  | "A#"
  | "B";

/** All 12 note names in chromatic order, used for lookups. */
export const NOTE_NAMES: readonly NoteName[] = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const;

/**
 * Scale group IDs mapped to human-readable labels.
 * Groups 0–5 match the `group` field in only-scales.json.
 */
export const SCALE_GROUPS: Record<number, string> = {
  0: "Major",
  1: "Minor",
  2: "Major Blues",
  3: "Minor Blues",
  4: "Minor Pentatonic",
  5: "Major Pentatonic",
};

/** A node in the force-directed graph representing a scale. */
export interface ScaleNode {
  id: string;
  group: number;
  /** Runtime properties added by 3d-force-graph after initialization. */
  x?: number;
  y?: number;
  z?: number;
  vx?: number;
  vy?: number;
  vz?: number;
  color?: string;
}

/** A link between two scale nodes, with a closeness value. */
export interface ScaleLink {
  source: string | ScaleNode;
  target: string | ScaleNode;
  /** Relationship closeness: lower = stronger (1.0 or 2.0 in the dataset). */
  value: number;
}

/** Graph data structure consumed by 3d-force-graph. */
export interface GraphData {
  nodes: ScaleNode[];
  links: ScaleLink[];
}

/** Metadata for a single scale from scale_dict.json. */
export interface ScaleInfo {
  /** 12-bit binary string: 1 = note present in chromatic scale. */
  code: string;
  /** Note names belonging to this scale. */
  notes: string[];
  /** Root note of the scale. */
  tonic: string;
}

/** Dictionary mapping scale name -> metadata. */
export type ScaleDict = Record<string, ScaleInfo>;

/** A node representing a chord in related_chords.json. */
export interface ChordNode {
  id: string;
  group: number;
}

/** A link between a scale and a chord. */
export interface ChordLink {
  source: string;
  target: string;
  value: number;
}

/** Chord relationship data from related_chords.json. */
export interface ChordData {
  nodes: ChordNode[];
  links: ChordLink[];
}

/** All loaded application data, returned by the data loader. */
export interface AppData {
  scaleGraph: GraphData;
  scaleDict: ScaleDict;
  chordData: ChordData;
}

/** A scale match result with a relevance score. */
export interface ScaleMatch {
  /** The scale name (node ID). */
  scaleId: string;
  /** How many of the active notes appear in this scale (higher = better). */
  matchCount: number;
  /** Total notes in the scale. */
  totalNotes: number;
  /** matchCount / activeNotes.size — what fraction of played notes are in this scale. */
  score: number;
}

/** Custom event detail for piano note events. */
export interface NoteEventDetail {
  note: NoteName;
}
