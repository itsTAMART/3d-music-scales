/**
 * Application entry point — initializes all modules and wires them together.
 *
 * Loads data, creates the DOM layout, initializes the 3D graph,
 * sets up the piano keyboard, and connects the note event pipeline
 * for scale highlighting.
 *
 * @module main
 */

import { loadAppData } from "./data/loader";
import { createLayout } from "./ui/layout";
import { createGraph, resetCamera, type GraphInstance } from "./graph/graph";
import { updateHighlights, clearHighlights } from "./graph/highlight";
import { updateScalePanel } from "./ui/scale-panel";
import { updateChordPanel } from "./ui/chord-panel";
import { createPiano, highlightPianoKey, clearPianoHighlights } from "./piano/piano";
import { initKeyboardBindings } from "./piano/keyboard-bindings";
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
      updateScalePanel(scaleId, data, {
        scaleNameEl: elements.scaleNameEl,
        scaleNotesEl: elements.scaleNotesEl,
        relatedScalesEl: elements.relatedScalesEl,
      });
      updateChordPanel(scaleId, data, elements.relatedChordsEl);
    }
  );

  // Initialize piano keyboard + keyboard bindings
  const pianoSvg = createPiano(elements.bottomPanel);
  initKeyboardBindings();

  // Reset camera button
  createResetCameraButton(elements.controlsEl, graph);

  // Initialize MIDI controls
  createMIDIButton(elements.controlsEl);

  // Initialize audio upload + analysis controls
  createAudioControls(elements.controlsEl);

  // Wire up note events from all sources (piano, MIDI, audio)
  document.addEventListener("piano:noteon", ((e: CustomEvent<NoteEventDetail>) => {
    const note = normalizeNote(e.detail.note);
    if (!note) return;

    activeNotes.add(note);
    highlightPianoKey(pianoSvg, note, true);
    updateNoteHighlights(graph, data);
  }) as EventListener);

  document.addEventListener("piano:noteoff", ((e: CustomEvent<NoteEventDetail>) => {
    const note = normalizeNote(e.detail.note);
    if (!note) return;

    activeNotes.delete(note);
    highlightPianoKey(pianoSvg, note, false);

    if (activeNotes.size === 0) {
      clearHighlights(graph);
      clearPianoHighlights(pianoSvg);
    } else {
      updateNoteHighlights(graph, data);
    }
  }) as EventListener);
}

/**
 * Matches active notes against scales and updates graph highlighting.
 */
function updateNoteHighlights(graph: GraphInstance, data: AppData): void {
  const matches = matchScales(activeNotes, data.scaleDict);

  // Highlight scales where ALL active notes match (score === 1)
  // and scales with high partial matches (score >= 0.5)
  const highlightIds = new Set(
    matches
      .filter((m) => m.score >= 0.5)
      .map((m) => m.scaleId)
  );

  updateHighlights(graph, highlightIds);
}

/** Creates a "Reset Camera" button in the controls panel. */
function createResetCameraButton(
  container: HTMLElement,
  graph: GraphInstance
): void {
  const wrapper = document.createElement("div");
  wrapper.className = "midi-controls"; // reuse the flex layout style

  const button = document.createElement("button");
  button.className = "midi-button";
  button.textContent = "Reset Camera";
  button.addEventListener("click", () => resetCamera(graph));

  const hint = document.createElement("div");
  hint.className = "midi-status";
  hint.textContent = "Orbit: drag · Zoom: scroll · Pan: right-drag";

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
