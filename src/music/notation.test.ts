/**
 * Tests for the notation module — ABC/Solfège conversion.
 */

import { describe, it, expect } from "vitest";
import { displayNote, displayNotes, setNotation, getNotation } from "./notation";

describe("notation", () => {
  it("defaults to ABC mode", () => {
    setNotation("abc"); // reset
    expect(getNotation()).toBe("abc");
  });

  it("displayNote returns ABC in abc mode", () => {
    setNotation("abc");
    expect(displayNote("C")).toBe("C");
    expect(displayNote("F#")).toBe("F#");
  });

  it("displayNote returns solfège in solfege mode", () => {
    setNotation("solfege");
    expect(displayNote("C")).toBe("Do");
    expect(displayNote("D")).toBe("Re");
    expect(displayNote("E")).toBe("Mi");
    expect(displayNote("F")).toBe("Fa");
    expect(displayNote("G")).toBe("Sol");
    expect(displayNote("A")).toBe("La");
    expect(displayNote("B")).toBe("Si");
    expect(displayNote("F#")).toBe("Fa#");
    setNotation("abc"); // reset
  });

  it("displayNotes converts an array", () => {
    setNotation("solfege");
    expect(displayNotes(["C", "E", "G"])).toEqual(["Do", "Mi", "Sol"]);
    setNotation("abc");
  });
});
