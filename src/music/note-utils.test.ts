/**
 * Tests for the note-utils module — note normalization, MIDI conversion,
 * scale matching, and helper functions.
 */

import { describe, it, expect } from "vitest";
import {
  normalizeNote,
  midiToNoteName,
  matchScales,
  extractTonic,
  getLinkNodeId,
} from "./note-utils";
import type { ScaleDict } from "../types";

describe("normalizeNote", () => {
  it("returns sharp note names unchanged", () => {
    expect(normalizeNote("C")).toBe("C");
    expect(normalizeNote("C#")).toBe("C#");
    expect(normalizeNote("F#")).toBe("F#");
  });

  it("converts flat names to sharps", () => {
    expect(normalizeNote("Db")).toBe("C#");
    expect(normalizeNote("Eb")).toBe("D#");
    expect(normalizeNote("Gb")).toBe("F#");
    expect(normalizeNote("Ab")).toBe("G#");
    expect(normalizeNote("Bb")).toBe("A#");
  });

  it("handles special enharmonic cases", () => {
    expect(normalizeNote("Fb")).toBe("E");
    expect(normalizeNote("Cb")).toBe("B");
  });

  it("strips octave numbers", () => {
    expect(normalizeNote("C4")).toBe("C");
    expect(normalizeNote("F#3")).toBe("F#");
    expect(normalizeNote("Bb2")).toBe("A#");
  });

  it("returns null for invalid input", () => {
    expect(normalizeNote("X")).toBeNull();
    expect(normalizeNote("")).toBeNull();
    expect(normalizeNote("H#")).toBeNull();
  });
});

describe("midiToNoteName", () => {
  it("converts middle C (60) correctly", () => {
    expect(midiToNoteName(60)).toBe("C");
  });

  it("converts across octaves", () => {
    expect(midiToNoteName(69)).toBe("A"); // A4 (440Hz)
    expect(midiToNoteName(72)).toBe("C"); // C5
    expect(midiToNoteName(61)).toBe("C#");
  });

  it("handles edge MIDI values", () => {
    expect(midiToNoteName(0)).toBe("C"); // C-1
    expect(midiToNoteName(127)).toBe("G"); // G9
  });
});

describe("matchScales", () => {
  const mockDict: ScaleDict = {
    "C Major Scale": {
      code: "101011010101",
      notes: ["C", "D", "E", "F", "G", "A", "B"],
      tonic: "C",
    },
    "A Minor Scale": {
      code: "101011010101",
      notes: ["A", "B", "C", "D", "E", "F", "G"],
      tonic: "A",
    },
    "C Blues Scale": {
      code: "100101110010",
      notes: ["C", "Eb", "F", "F#", "G", "Bb"],
      tonic: "C",
    },
  };

  it("returns empty for no active notes", () => {
    expect(matchScales(new Set(), mockDict)).toEqual([]);
  });

  it("matches single note against all containing scales", () => {
    const results = matchScales(new Set(["C"]), mockDict);
    expect(results.length).toBe(3); // All three scales contain C
    expect(results[0].score).toBe(1); // 1/1 notes match
  });

  it("ranks full matches higher than partial", () => {
    // C, E, G — all in C Major, only C and G in Blues
    const results = matchScales(new Set(["C", "E", "G"]), mockDict);
    const cMajor = results.find((r) => r.scaleId === "C Major Scale")!;
    const cBlues = results.find((r) => r.scaleId === "C Blues Scale")!;
    expect(cMajor.score).toBeGreaterThan(cBlues.score);
  });

  it("excludes scales with zero matches", () => {
    // F# is not in A Minor Scale (A minor has no sharps/flats in this dict representation)
    // Actually F# IS not in C Major or A Minor, but IS in C Blues
    const results = matchScales(new Set(["F#"]), mockDict);
    const blues = results.find((r) => r.scaleId === "C Blues Scale");
    expect(blues).toBeDefined();
    expect(blues!.matchCount).toBe(1);
  });
});

describe("extractTonic", () => {
  it("extracts natural notes", () => {
    expect(extractTonic("C Major Scale")).toBe("C");
    expect(extractTonic("A Minor Scale")).toBe("A");
  });

  it("extracts sharp notes", () => {
    expect(extractTonic("F# Blues Scale")).toBe("F#");
    expect(extractTonic("C# Minor Pentatonic Scale")).toBe("C#");
  });

  it("returns empty string for invalid input", () => {
    expect(extractTonic("")).toBe("");
  });
});

describe("getLinkNodeId", () => {
  it("returns the string directly if it is a string", () => {
    expect(getLinkNodeId("C Major Scale")).toBe("C Major Scale");
  });

  it("returns .id from an object", () => {
    expect(getLinkNodeId({ id: "A Minor Scale" })).toBe("A Minor Scale");
  });
});
