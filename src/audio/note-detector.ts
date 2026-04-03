/**
 * Note detector module — converts FFT frequency data into note names.
 *
 * Implements a simple peak-finding algorithm on FFT magnitude data
 * to detect the dominant frequencies, then maps them to the nearest
 * chromatic note names. Works for monophonic and simple polyphonic audio.
 *
 * @module audio/note-detector
 *
 * @example
 * ```ts
 * import { detectNotes, frequencyToNoteName } from "@/audio/note-detector";
 * const notes = detectNotes(fftData, sampleRate, fftSize);
 * ```
 */

import { NOTE_NAMES, type NoteName } from "../types";

/** Minimum frequency to consider (below this is noise/rumble). */
const MIN_FREQUENCY = 60; // ~B1

/** Maximum frequency to consider (above this is mostly harmonics). */
const MAX_FREQUENCY = 2000; // ~B6

/** Minimum dB above noise floor to consider a peak. */
const PEAK_THRESHOLD_DB = -50;

/** Minimum distance between peaks in frequency bins (avoids detecting same note twice). */
const MIN_PEAK_DISTANCE_BINS = 5;

/** Maximum number of simultaneous notes to detect. */
const MAX_NOTES = 6;

/**
 * Converts a frequency in Hz to the nearest MIDI note number.
 * A4 (440Hz) = MIDI 69.
 */
export function frequencyToMidi(freq: number): number {
  return Math.round(12 * Math.log2(freq / 440) + 69);
}

/**
 * Converts a frequency in Hz to the nearest chromatic note name.
 * Returns null if the frequency is out of the audible musical range.
 */
export function frequencyToNoteName(freq: number): NoteName | null {
  if (freq < 20 || freq > 4200) return null;
  const midi = frequencyToMidi(freq);
  if (midi < 0 || midi > 127) return null;
  return NOTE_NAMES[midi % 12];
}

/**
 * Converts an FFT bin index to a frequency in Hz.
 */
export function binToFrequency(
  bin: number,
  sampleRate: number,
  fftSize: number
): number {
  return (bin * sampleRate) / fftSize;
}

/**
 * Detects the dominant note names from FFT frequency data.
 *
 * @param fftData - Float32Array of dB magnitudes from AnalyserNode.getFloatFrequencyData()
 * @param sampleRate - Audio context sample rate (typically 44100 or 48000)
 * @param fftSize - FFT size used by the AnalyserNode (typically 2048 or 4096)
 * @returns Array of detected note names (deduplicated, up to MAX_NOTES)
 */
export function detectNotes(
  fftData: Float32Array,
  sampleRate: number,
  fftSize: number
): NoteName[] {
  const minBin = Math.ceil((MIN_FREQUENCY * fftSize) / sampleRate);
  const maxBin = Math.floor((MAX_FREQUENCY * fftSize) / sampleRate);

  // Find peaks above threshold
  const peaks: Array<{ bin: number; magnitude: number }> = [];

  for (let i = Math.max(minBin, 1); i < Math.min(maxBin, fftData.length - 1); i++) {
    const mag = fftData[i];
    if (
      mag > PEAK_THRESHOLD_DB &&
      mag > fftData[i - 1] &&
      mag > fftData[i + 1]
    ) {
      peaks.push({ bin: i, magnitude: mag });
    }
  }

  // Sort by magnitude (loudest first)
  peaks.sort((a, b) => b.magnitude - a.magnitude);

  // Filter peaks that are too close to each other (keep the louder one)
  const filteredPeaks: typeof peaks = [];
  for (const peak of peaks) {
    const tooClose = filteredPeaks.some(
      (p) => Math.abs(p.bin - peak.bin) < MIN_PEAK_DISTANCE_BINS
    );
    if (!tooClose) {
      filteredPeaks.push(peak);
    }
    if (filteredPeaks.length >= MAX_NOTES) break;
  }

  // Convert peaks to note names and deduplicate
  const noteSet = new Set<NoteName>();
  for (const peak of filteredPeaks) {
    const freq = binToFrequency(peak.bin, sampleRate, fftSize);
    const note = frequencyToNoteName(freq);
    if (note) {
      noteSet.add(note);
    }
  }

  return [...noteSet];
}
