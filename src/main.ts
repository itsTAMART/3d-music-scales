/**
 * Application entry point — initializes all modules and wires them together.
 *
 * Loads data, creates the DOM layout, initializes the 3D graph,
 * sets up the piano keyboard with sound synthesis, and connects
 * the note event pipeline for scale highlighting with fade decay.
 *
 * @module main
 */

import { loadAppData } from "./data/loader";
import { createLayout } from "./ui/layout";
import { createGraph, resetCamera, type GraphInstance } from "./graph/graph";
import { initCameraMotion, notifyNodeClick } from "./graph/camera-motion";
import {
  triggerHighlights,
  clearHighlights,
  startHighlightLoop,
} from "./graph/highlight";
import { updateScalePanel } from "./ui/scale-panel";
import { updateChordPanel } from "./ui/chord-panel";
import {
  createPiano,
  highlightPianoKey,
  clearPianoHighlights,
} from "./piano/piano";
import { initKeyboardBindings } from "./piano/keyboard-bindings";
import { noteOn, noteOff } from "./piano/synth";
import { createNoteHistogram, triggerNote } from "./piano/note-histogram";
import { createMIDIButton } from "./audio/midi-input";
import { createAudioControls } from "./audio/audio-analyzer";
import { matchScales, normalizeNote } from "./music/note-utils";
import type { AppData, NoteName, NoteEventDetail } from "./types";

import "./styles/main.css";
import "./styles/panels.css";
import "./styles/typography.css";

/** Currently active notes from any input source. */
const activeNotes = new Set<NoteName>();

/** Initialize the application. */
function init(): void {
  const app = document.getElementById("app");
  if (!app) throw new Error("Missing #app element");

  // Load all data (bundled JSON imports)
  const data: AppData = loadAppData();

  // Create DOM layout
  const elements = createLayout(app);

  // Initialize 3D graph
  const graph: GraphInstance = createGraph(
    elements.graphContainer,
    data.scaleGraph,
    (scaleId: string) => {
      notifyNodeClick(); // pause auto-camera
      updateScalePanel(scaleId, data, {
        scaleNameEl: elements.scaleNameEl,
        scaleNotesEl: elements.scaleNotesEl,
        relatedScalesEl: elements.relatedScalesEl,
      });
      updateChordPanel(scaleId, data, elements.relatedChordsEl);
    }
  );

  // Start the highlight fade animation loop
  startHighlightLoop(graph);

  // Start cinematic auto-camera (idle orbit + music tracking)
  initCameraMotion(graph, elements.graphContainer);

  // Initialize piano keyboard + histogram + keyboard bindings
  const pianoSvg = createPiano(elements.bottomPanel);
  // Insert histogram above the piano SVG inside the wrapper
  const pianoWrapper = elements.bottomPanel.querySelector(".piano-wrapper");
  if (pianoWrapper) {
    createNoteHistogram(pianoWrapper as HTMLElement);
    // Move histogram before the SVG (it was appended after)
    const histogramEl = pianoWrapper.querySelector(".note-histogram");
    if (histogramEl) {
      pianoWrapper.insertBefore(histogramEl, pianoWrapper.firstChild);
    }
  }
  initKeyboardBindings();

  // Reset camera button
  createResetCameraButton(elements.controlsEl, graph);

  // Initialize MIDI controls
  createMIDIButton(elements.controlsEl);

  // Initialize audio upload + analysis controls
  createAudioControls(elements.controlsEl);

  // Wire up note events from all sources (piano, MIDI, audio)
  document.addEventListener("piano:noteon", ((
    e: CustomEvent<NoteEventDetail>
  ) => {
    const note = normalizeNote(e.detail.note);
    if (!note) return;

    activeNotes.add(note);
    highlightPianoKey(pianoSvg, note, true);
    triggerNote(note);

    // Only play synth sound for piano/MIDI input, not audio file analysis
    if (e.detail.source !== "audio") {
      noteOn(note);
    }

    // Trigger highlight with cumulative fade
    updateNoteHighlights(graph, data);
  }) as EventListener);

  document.addEventListener("piano:noteoff", ((
    e: CustomEvent<NoteEventDetail>
  ) => {
    const note = normalizeNote(e.detail.note);
    if (!note) return;

    activeNotes.delete(note);
    highlightPianoKey(pianoSvg, note, false);

    // Only release synth for piano/MIDI input
    if (e.detail.source !== "audio") {
      noteOff(note);
    }

    if (activeNotes.size === 0) {
      // Let the fade animation handle the visual decay — don't clear instantly
      clearPianoHighlights(pianoSvg);
    } else {
      updateNoteHighlights(graph, data);
    }
  }) as EventListener);
}

/**
 * Matches active notes against scales and triggers highlight with fade.
 */
function updateNoteHighlights(graph: GraphInstance, data: AppData): void {
  const matches = matchScales(activeNotes, data.scaleDict);

  // Highlight scales with high match scores (>= 0.5)
  const highlightIds = new Set(
    matches.filter((m) => m.score >= 0.5).map((m) => m.scaleId)
  );

  triggerHighlights(highlightIds);
}

/** Creates a "Reset Camera" button in the controls panel. */
function createResetCameraButton(
  container: HTMLElement,
  graph: GraphInstance
): void {
  const wrapper = document.createElement("div");
  wrapper.className = "midi-controls";

  const button = document.createElement("button");
  button.className = "midi-button";
  button.textContent = "Reset Camera";
  button.addEventListener("click", () => {
    notifyNodeClick(); // pause auto-camera
    resetCamera(graph);
  });

  const hint = document.createElement("div");
  hint.className = "midi-status";
  hint.textContent = "Auto-orbits when idle · Follows music when playing";

  wrapper.appendChild(button);
  wrapper.appendChild(hint);
  container.appendChild(wrapper);
}

// Run when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
