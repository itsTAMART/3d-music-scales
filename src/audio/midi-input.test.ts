/**
 * Tests for the MIDI input module — verifies message parsing,
 * note conversion, and browser support detection.
 */

import { describe, it, expect } from "vitest";
import {
  parseMIDIMessage,
  midiNoteToName,
  isMIDISupported,
} from "./midi-input";

describe("midiNoteToName", () => {
  it("converts MIDI 60 (middle C) to C", () => {
    expect(midiNoteToName(60)).toBe("C");
  });

  it("converts MIDI 69 (A4) to A", () => {
    expect(midiNoteToName(69)).toBe("A");
  });

  it("converts MIDI 61 to C#", () => {
    expect(midiNoteToName(61)).toBe("C#");
  });

  it("wraps around octaves correctly", () => {
    expect(midiNoteToName(0)).toBe("C");
    expect(midiNoteToName(12)).toBe("C");
    expect(midiNoteToName(127)).toBe("G");
  });
});

describe("parseMIDIMessage", () => {
  it("parses note-on message (channel 0)", () => {
    const data = new Uint8Array([0x90, 60, 100]); // note-on, C4, velocity 100
    const result = parseMIDIMessage(data);
    expect(result).toEqual({
      type: "noteon",
      note: "C",
      velocity: 100,
      channel: 0,
    });
  });

  it("parses note-off message", () => {
    const data = new Uint8Array([0x80, 60, 0]); // note-off, C4
    const result = parseMIDIMessage(data);
    expect(result).toEqual({
      type: "noteoff",
      note: "C",
      velocity: 0,
      channel: 0,
    });
  });

  it("treats note-on with velocity 0 as note-off", () => {
    const data = new Uint8Array([0x90, 64, 0]); // note-on, E4, velocity 0
    const result = parseMIDIMessage(data);
    expect(result?.type).toBe("noteoff");
    expect(result?.note).toBe("E");
  });

  it("parses messages on different channels", () => {
    const data = new Uint8Array([0x93, 60, 80]); // note-on, channel 3
    const result = parseMIDIMessage(data);
    expect(result?.channel).toBe(3);
  });

  it("returns null for non-note messages", () => {
    const data = new Uint8Array([0xb0, 1, 64]); // control change
    expect(parseMIDIMessage(data)).toBeNull();
  });

  it("returns null for too-short messages", () => {
    const data = new Uint8Array([0x90]);
    expect(parseMIDIMessage(data)).toBeNull();
  });

  it("parses sharp notes correctly", () => {
    const data = new Uint8Array([0x90, 61, 80]); // C#4
    expect(parseMIDIMessage(data)?.note).toBe("C#");
  });
});

describe("isMIDISupported", () => {
  it("returns a boolean", () => {
    // In jsdom, requestMIDIAccess is not available
    expect(typeof isMIDISupported()).toBe("boolean");
  });
});
