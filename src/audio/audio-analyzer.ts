/**
 * Audio analyzer module — handles audio file upload, playback, and FFT analysis.
 *
 * Uses the Web Audio API to decode uploaded audio files, play them back,
 * and continuously analyze the frequency content via an AnalyserNode.
 * Detected notes are dispatched as `piano:noteon` / `piano:noteoff` events
 * through the shared event pipeline.
 *
 * @module audio/audio-analyzer
 *
 * @example
 * ```ts
 * import { createAudioControls } from "@/audio/audio-analyzer";
 * createAudioControls(container);
 * ```
 */

import type { NoteName, NoteEventDetail } from "../types";
import { detectNotes } from "./note-detector";

/** FFT size for the analyser node. Higher = better frequency resolution. */
const FFT_SIZE = 4096;

/** How often to run note detection (ms). */
const DETECTION_INTERVAL_MS = 80;

/** Audio analysis state. */
interface AnalyzerState {
  audioContext: AudioContext | null;
  sourceNode: AudioBufferSourceNode | null;
  analyserNode: AnalyserNode | null;
  audioBuffer: AudioBuffer | null;
  isPlaying: boolean;
  animationId: number | null;
  intervalId: number | null;
  lastNotes: Set<NoteName>;
  fileName: string;
}

const state: AnalyzerState = {
  audioContext: null,
  sourceNode: null,
  analyserNode: null,
  audioBuffer: null,
  isPlaying: false,
  animationId: null,
  intervalId: null,
  lastNotes: new Set(),
  fileName: "",
};

/**
 * Creates the audio upload and playback controls UI.
 * Appends to the given container element.
 */
export function createAudioControls(container: HTMLElement): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "audio-controls";

  // File input (hidden)
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "audio/*";
  fileInput.style.display = "none";
  fileInput.id = "audio-file-input";

  // Upload label (styled as button)
  const uploadLabel = document.createElement("label");
  uploadLabel.className = "audio-upload-label";
  uploadLabel.htmlFor = "audio-file-input";
  uploadLabel.textContent = "Upload Audio";

  // Experimental badge
  const badge = document.createElement("span");
  badge.className = "experimental-badge";
  badge.textContent = "experimental";
  uploadLabel.appendChild(badge);

  // Play/pause button
  const playBtn = document.createElement("button");
  playBtn.className = "audio-play-btn";
  playBtn.textContent = "Play";
  playBtn.disabled = true;

  // Status text
  const status = document.createElement("div");
  status.className = "audio-status";

  // File upload handler
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    status.textContent = "Loading...";
    status.className = "audio-status";

    try {
      await loadAudioFile(file);
      state.fileName = file.name;
      status.textContent = file.name;
      playBtn.disabled = false;
      playBtn.textContent = "Play";
    } catch (err) {
      status.textContent = `Error: ${(err as Error).message}`;
      status.className = "audio-status audio-status--error";
    }
  });

  // Play/pause handler
  playBtn.addEventListener("click", () => {
    if (state.isPlaying) {
      stopPlayback();
      playBtn.textContent = "Play";
      status.textContent = state.fileName;
      status.className = "audio-status";
    } else {
      startPlayback();
      playBtn.textContent = "Stop";
      status.textContent = `Analyzing: ${state.fileName}`;
      status.className = "audio-status audio-status--active";
    }
  });

  wrapper.appendChild(fileInput);
  wrapper.appendChild(uploadLabel);
  wrapper.appendChild(playBtn);
  wrapper.appendChild(status);
  container.appendChild(wrapper);

  return wrapper;
}

/**
 * Loads and decodes an audio file into the audio buffer.
 */
async function loadAudioFile(file: File): Promise<void> {
  // Stop any current playback
  if (state.isPlaying) {
    stopPlayback();
  }

  // Create or reuse AudioContext
  if (!state.audioContext) {
    state.audioContext = new AudioContext();
  }

  const arrayBuffer = await file.arrayBuffer();
  state.audioBuffer = await state.audioContext.decodeAudioData(arrayBuffer);

  // Set up analyser
  if (!state.analyserNode) {
    state.analyserNode = state.audioContext.createAnalyser();
    state.analyserNode.fftSize = FFT_SIZE;
    state.analyserNode.smoothingTimeConstant = 0.8;
    state.analyserNode.connect(state.audioContext.destination);
  }
}

/**
 * Starts audio playback and begins frequency analysis.
 */
function startPlayback(): void {
  if (!state.audioContext || !state.audioBuffer || !state.analyserNode) return;

  // Resume context if suspended (autoplay policy)
  if (state.audioContext.state === "suspended") {
    state.audioContext.resume();
  }

  // Create new source (AudioBufferSourceNode is one-shot)
  state.sourceNode = state.audioContext.createBufferSource();
  state.sourceNode.buffer = state.audioBuffer;
  state.sourceNode.connect(state.analyserNode);

  state.sourceNode.onended = () => {
    if (state.isPlaying) {
      stopPlayback();
      // Re-enable play button
      const playBtn = document.querySelector(".audio-play-btn") as HTMLButtonElement | null;
      if (playBtn) {
        playBtn.textContent = "Play";
      }
      const status = document.querySelector(".audio-status");
      if (status) {
        status.textContent = state.fileName;
        status.className = "audio-status";
      }
    }
  };

  state.sourceNode.start(0);
  state.isPlaying = true;

  // Start analysis loop
  startAnalysis();
}

/**
 * Stops audio playback and analysis.
 */
function stopPlayback(): void {
  if (state.sourceNode) {
    try {
      state.sourceNode.stop();
    } catch {
      // Already stopped
    }
    state.sourceNode.disconnect();
    state.sourceNode = null;
  }

  state.isPlaying = false;
  stopAnalysis();

  // Release all currently held notes
  for (const note of state.lastNotes) {
    dispatchNoteEvent("piano:noteoff", note);
  }
  state.lastNotes.clear();
}

/**
 * Starts the frequency analysis loop.
 */
function startAnalysis(): void {
  if (!state.analyserNode || !state.audioContext) return;

  const fftData = new Float32Array(state.analyserNode.frequencyBinCount);
  const sampleRate = state.audioContext.sampleRate;
  const fftSize = state.analyserNode.fftSize;

  state.intervalId = window.setInterval(() => {
    if (!state.analyserNode || !state.isPlaying) return;

    state.analyserNode.getFloatFrequencyData(fftData);
    const detectedNotes = new Set(detectNotes(fftData, sampleRate, fftSize));

    // Dispatch note-off for notes that are no longer detected
    for (const note of state.lastNotes) {
      if (!detectedNotes.has(note)) {
        dispatchNoteEvent("piano:noteoff", note);
      }
    }

    // Dispatch note-on for newly detected notes
    for (const note of detectedNotes) {
      if (!state.lastNotes.has(note)) {
        dispatchNoteEvent("piano:noteon", note);
      }
    }

    state.lastNotes = detectedNotes;
  }, DETECTION_INTERVAL_MS);
}

/**
 * Stops the frequency analysis loop.
 */
function stopAnalysis(): void {
  if (state.intervalId !== null) {
    window.clearInterval(state.intervalId);
    state.intervalId = null;
  }
}

/** Dispatches a custom note event on the document, tagged as audio source. */
function dispatchNoteEvent(type: string, note: NoteName): void {
  const detail: NoteEventDetail = { note, source: "audio" };
  document.dispatchEvent(new CustomEvent(type, { detail }));
}
