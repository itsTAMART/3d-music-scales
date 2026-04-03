/**
 * Application entry point — initializes all modules and wires them together.
 *
 * @module main
 */

import { loadAppData } from "./data/loader";
import { buildUnifiedGraph, defaultLayers, type GraphLayers } from "./data/graph-builder";
import { createLayout } from "./ui/layout";
import { createGraph, updateGraphData, refreshLabels, resetCamera, type GraphInstance } from "./graph/graph";
import { initCameraMotion, notifyNodeClick } from "./graph/camera-motion";
import {
  triggerHighlights,
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
import { setNotation, onNotationChange, type NotationMode } from "./music/notation";
import type { AppData, NoteName, NoteEventDetail } from "./types";

import "./styles/main.css";
import "./styles/panels.css";
import "./styles/typography.css";

/** Currently active notes from any input source. */
const activeNotes = new Set<NoteName>();

/** Current graph layers state. */
const layers: GraphLayers = defaultLayers();

/** Initialize the application. */
function init(): void {
  const app = document.getElementById("app");
  if (!app) throw new Error("Missing #app element");

  const data: AppData = loadAppData();
  const elements = createLayout(app);

  // Build unified graph with current layers
  let graphData = buildUnifiedGraph(data, layers);

  // Initialize 3D graph
  const graph: GraphInstance = createGraph(
    elements.graphContainer,
    graphData,
    (nodeId: string, _nodeType: string) => {
      notifyNodeClick();
      updateScalePanel(nodeId, data, {
        scaleNameEl: elements.scaleNameEl,
        scaleNotesEl: elements.scaleNotesEl,
        relatedScalesEl: elements.relatedScalesEl,
      });
      updateChordPanel(nodeId, data, elements.relatedChordsEl);
    }
  );

  startHighlightLoop(graph);
  initCameraMotion(graph, elements.graphContainer);

  // Piano keyboard + histogram
  const pianoSvg = createPiano(elements.bottomPanel);
  const pianoWrapper = elements.bottomPanel.querySelector(".piano-wrapper");
  if (pianoWrapper) {
    createNoteHistogram(pianoWrapper as HTMLElement);
    const histogramEl = pianoWrapper.querySelector(".note-histogram");
    if (histogramEl) {
      pianoWrapper.insertBefore(histogramEl, pianoWrapper.firstChild);
    }
  }
  initKeyboardBindings();

  // Controls
  createResetCameraButton(elements.controlsEl, graph);
  createLayerToggles(elements.controlsEl, graph, data);
  createNotationToggle(elements.controlsEl, graph, data);
  createMIDIButton(elements.controlsEl);
  createAudioControls(elements.controlsEl);

  // Note events
  document.addEventListener("piano:noteon", ((
    e: CustomEvent<NoteEventDetail>
  ) => {
    const note = normalizeNote(e.detail.note);
    if (!note) return;

    activeNotes.add(note);
    highlightPianoKey(pianoSvg, note, true);
    triggerNote(note);

    if (e.detail.source !== "audio") noteOn(note);

    updateNoteHighlights(graph, data);
  }) as EventListener);

  document.addEventListener("piano:noteoff", ((
    e: CustomEvent<NoteEventDetail>
  ) => {
    const note = normalizeNote(e.detail.note);
    if (!note) return;

    activeNotes.delete(note);
    highlightPianoKey(pianoSvg, note, false);

    if (e.detail.source !== "audio") noteOff(note);

    if (activeNotes.size === 0) {
      clearPianoHighlights(pianoSvg);
    } else {
      updateNoteHighlights(graph, data);
    }
  }) as EventListener);

  /** Rebuild graph when layers change. */
  function rebuildGraph() {
    graphData = buildUnifiedGraph(data, layers);
    updateGraphData(graph, graphData);
  }

  // Keep reference to rebuildGraph (used by layer toggles above)
  void rebuildGraph;
}

/** Matches active notes against scales/chords and triggers highlights. */
function updateNoteHighlights(graph: GraphInstance, data: AppData): void {
  const matches = matchScales(activeNotes, data.scaleDict);

  // Require almost all played notes to be in the scale (>= 80%)
  // This means a scale only lights up when you're actually playing it
  const highlightIds = new Set(
    matches.filter((m) => m.score >= 0.8).map((m) => m.scaleId)
  );

  // Also highlight the note nodes themselves (always)
  for (const note of activeNotes) {
    highlightIds.add(`♪ ${note}`);
  }

  triggerHighlights(highlightIds);
}

/** Creates layer toggle buttons (Chords, Notes). */
function createLayerToggles(
  container: HTMLElement,
  graph: GraphInstance,
  data: AppData
): void {
  const wrapper = document.createElement("div");
  wrapper.className = "midi-controls";

  const chordsBtn = createToggleButton("Chords", layers.chords, (on) => {
    layers.chords = on;
    const graphData = buildUnifiedGraph(data, layers);
    updateGraphData(graph, graphData);
  });

  const notesBtn = createToggleButton("Notes", layers.notes, (on) => {
    layers.notes = on;
    const graphData = buildUnifiedGraph(data, layers);
    updateGraphData(graph, graphData);
  });

  wrapper.appendChild(chordsBtn);
  wrapper.appendChild(notesBtn);
  container.appendChild(wrapper);
}

/** Creates the ABC/Solfège notation toggle. */
function createNotationToggle(
  container: HTMLElement,
  graph: GraphInstance,
  _data: AppData
): void {
  const wrapper = document.createElement("div");
  wrapper.className = "midi-controls";

  const btn = document.createElement("button");
  btn.className = "midi-button";
  btn.textContent = "ABC → Do Re Mi";

  btn.addEventListener("click", () => {
    const current = btn.dataset.mode ?? "abc";
    const next: NotationMode = current === "abc" ? "solfege" : "abc";
    btn.dataset.mode = next;
    btn.textContent = next === "abc" ? "ABC → Do Re Mi" : "Do Re Mi → ABC";
    setNotation(next);
  });

  btn.dataset.mode = "abc";

  // When notation changes, update labels in-place (no graph rebuild)
  onNotationChange(() => {
    refreshLabels(graph);
  });

  wrapper.appendChild(btn);
  container.appendChild(wrapper);
}

/** Creates a toggle button with on/off state. */
function createToggleButton(
  label: string,
  initialState: boolean,
  onChange: (on: boolean) => void
): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.className = `midi-button ${initialState ? "midi-button--active" : ""}`;
  btn.textContent = `${initialState ? "◉" : "○"} ${label}`;

  btn.addEventListener("click", () => {
    const isOn = btn.classList.toggle("midi-button--active");
    btn.textContent = `${isOn ? "◉" : "○"} ${label}`;
    onChange(isOn);
  });

  return btn;
}

/** Creates a "Reset Camera" button. */
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
    notifyNodeClick();
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
