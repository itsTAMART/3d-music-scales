/**
 * Piano synthesizer module — generates sound for piano key presses.
 *
 * Uses the Web Audio API to create simple oscillator-based tones with
 * an ADSR-like envelope (attack, decay, sustain, release) for each note.
 * Supports polyphony — multiple notes can sound simultaneously.
 *
 * @module piano/synth
 *
 * @example
 * ```ts
 * import { noteOn, noteOff } from "@/piano/synth";
 * noteOn("C");  // start playing C
 * noteOff("C"); // release C
 * ```
 */

import type { NoteName } from "../types";
import { NOTE_NAMES } from "../types";

/** Base frequencies for octave 4 (A4 = 440Hz). */
const BASE_FREQUENCIES: Record<NoteName, number> = {
  C: 261.63,
  "C#": 277.18,
  D: 293.66,
  "D#": 311.13,
  E: 329.63,
  F: 349.23,
  "F#": 369.99,
  G: 392.0,
  "G#": 415.3,
  A: 440.0,
  "A#": 466.16,
  B: 493.88,
};

/** Active voice state for a playing note. */
interface Voice {
  oscillator: OscillatorNode;
  gainNode: GainNode;
}

/** Shared AudioContext — created lazily on first interaction. */
let audioCtx: AudioContext | null = null;

/** Master gain node for volume control. */
let masterGain: GainNode | null = null;

/** Currently playing voices, keyed by note name. */
const activeVoices = new Map<NoteName, Voice>();

/** Master volume (0–1). */
const MASTER_VOLUME = 0.15;

/** Envelope timings (seconds). */
const ATTACK = 0.02;
const DECAY = 0.15;
const SUSTAIN_LEVEL = 0.4;
const RELEASE = 0.3;

/**
 * Ensures the AudioContext and master gain are initialized.
 * Must be called from a user gesture (click/keydown) to satisfy autoplay policy.
 */
function ensureContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = MASTER_VOLUME;
    masterGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Gets the frequency for a note name. Defaults to octave 4.
 */
function getFrequency(note: NoteName, octave: number = 4): number {
  const base = BASE_FREQUENCIES[note];
  return base * Math.pow(2, octave - 4);
}

/**
 * Starts playing a note. Creates an oscillator with an attack-decay envelope.
 * If the note is already playing, it is retriggered.
 *
 * @param note - The note name to play.
 * @param octave - The octave (default 4, middle octave).
 */
export function noteOn(note: NoteName, octave: number = 4): void {
  const ctx = ensureContext();
  if (!masterGain) return;

  // Stop existing voice for this note (retrigger)
  if (activeVoices.has(note)) {
    noteOff(note);
  }

  const freq = getFrequency(note, octave);
  const now = ctx.currentTime;

  // Create oscillator — use a mix of triangle + sine for a softer piano-like tone
  const osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(freq, now);

  // Create gain for ADSR envelope
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(1, now + ATTACK);
  gain.gain.linearRampToValueAtTime(SUSTAIN_LEVEL, now + ATTACK + DECAY);

  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(now);

  activeVoices.set(note, { oscillator: osc, gainNode: gain });
}

/**
 * Releases a playing note with a fade-out envelope.
 * The oscillator is stopped and cleaned up after the release time.
 */
export function noteOff(note: NoteName): void {
  const voice = activeVoices.get(note);
  if (!voice || !audioCtx) return;

  const now = audioCtx.currentTime;

  // Release envelope
  voice.gainNode.gain.cancelScheduledValues(now);
  voice.gainNode.gain.setValueAtTime(voice.gainNode.gain.value, now);
  voice.gainNode.gain.linearRampToValueAtTime(0, now + RELEASE);

  // Schedule cleanup
  voice.oscillator.stop(now + RELEASE + 0.05);
  activeVoices.delete(note);
}

/**
 * Stops all currently playing notes immediately.
 */
export function allNotesOff(): void {
  for (const note of [...activeVoices.keys()]) {
    noteOff(note);
  }
}
