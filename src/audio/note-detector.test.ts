/**
 * Tests for the note detector module — verifies frequency-to-note conversion,
 * FFT bin mapping, and peak detection logic.
 */

import { describe, it, expect } from "vitest";
import {
  frequencyToMidi,
  frequencyToNoteName,
  binToFrequency,
  detectNotes,
} from "./note-detector";

describe("frequencyToMidi", () => {
  it("maps A4 (440Hz) to MIDI 69", () => {
    expect(frequencyToMidi(440)).toBe(69);
  });

  it("maps middle C (~261.6Hz) to MIDI 60", () => {
    expect(frequencyToMidi(261.63)).toBe(60);
  });

  it("maps A3 (220Hz) to MIDI 57", () => {
    expect(frequencyToMidi(220)).toBe(57);
  });

  it("maps C5 (~523.25Hz) to MIDI 72", () => {
    expect(frequencyToMidi(523.25)).toBe(72);
  });
});

describe("frequencyToNoteName", () => {
  it("converts 440Hz to A", () => {
    expect(frequencyToNoteName(440)).toBe("A");
  });

  it("converts ~261.6Hz to C", () => {
    expect(frequencyToNoteName(261.63)).toBe("C");
  });

  it("converts ~329.6Hz to E", () => {
    expect(frequencyToNoteName(329.63)).toBe("E");
  });

  it("returns null for sub-audible frequencies", () => {
    expect(frequencyToNoteName(10)).toBeNull();
  });

  it("returns null for very high frequencies", () => {
    expect(frequencyToNoteName(5000)).toBeNull();
  });
});

describe("binToFrequency", () => {
  it("bin 0 is 0Hz (DC)", () => {
    expect(binToFrequency(0, 44100, 2048)).toBe(0);
  });

  it("calculates correct frequency for a known bin", () => {
    // bin 10 at 44100Hz sample rate with 2048 FFT
    const freq = binToFrequency(10, 44100, 2048);
    expect(freq).toBeCloseTo(215.33, 1);
  });

  it("last bin equals Nyquist frequency", () => {
    const nyquist = binToFrequency(1024, 44100, 2048);
    expect(nyquist).toBe(22050);
  });
});

describe("detectNotes", () => {
  const sampleRate = 44100;
  const fftSize = 2048;
  const binCount = fftSize / 2;

  /** Creates silent FFT data (all values at -100 dB). */
  function createSilentFft(): Float32Array {
    return new Float32Array(binCount).fill(-100);
  }

  it("returns empty array for silent audio", () => {
    const fftData = createSilentFft();
    expect(detectNotes(fftData, sampleRate, fftSize)).toEqual([]);
  });

  it("detects a single peak at ~440Hz (A4)", () => {
    const fftData = createSilentFft();
    // 440Hz → bin index = 440 * 2048 / 44100 ≈ 20.4 → bin 20
    const targetBin = Math.round((440 * fftSize) / sampleRate);
    fftData[targetBin] = -20; // well above threshold
    fftData[targetBin - 1] = -40;
    fftData[targetBin + 1] = -40;

    const notes = detectNotes(fftData, sampleRate, fftSize);
    expect(notes).toContain("A");
  });

  it("detects multiple peaks (chord)", () => {
    // Use larger FFT for better resolution (bins are ~10.7Hz apart)
    const largeFft = 4096;
    const largeBinCount = largeFft / 2;
    const largeFftData = new Float32Array(largeBinCount).fill(-100);

    // C (~261Hz), E (~330Hz), G (~392Hz) — well-separated at 4096 FFT
    const cBin = Math.round((261.63 * largeFft) / sampleRate);
    const eBin = Math.round((329.63 * largeFft) / sampleRate);
    const gBin = Math.round((392.0 * largeFft) / sampleRate);

    for (const bin of [cBin, eBin, gBin]) {
      largeFftData[bin] = -25;
      largeFftData[bin - 1] = -45;
      largeFftData[bin + 1] = -45;
    }

    const notes = detectNotes(largeFftData, sampleRate, largeFft);
    expect(notes).toContain("C");
    expect(notes).toContain("E");
    expect(notes).toContain("G");
  });

  it("ignores peaks below the threshold", () => {
    const fftData = createSilentFft();
    const targetBin = Math.round((440 * fftSize) / sampleRate);
    fftData[targetBin] = -60; // below -50 threshold
    fftData[targetBin - 1] = -70;
    fftData[targetBin + 1] = -70;

    const notes = detectNotes(fftData, sampleRate, fftSize);
    expect(notes).toEqual([]);
  });

  it("limits the number of detected notes", () => {
    const fftData = createSilentFft();
    // Create many peaks across the spectrum
    for (let freq = 100; freq < 1500; freq += 50) {
      const bin = Math.round((freq * fftSize) / sampleRate);
      if (bin > 0 && bin < binCount - 1) {
        fftData[bin] = -20;
        fftData[bin - 1] = -45;
        fftData[bin + 1] = -45;
      }
    }

    const notes = detectNotes(fftData, sampleRate, fftSize);
    expect(notes.length).toBeLessThanOrEqual(6);
  });
});
