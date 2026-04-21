/**
 * Application entry point — initializes all modules and wires them together.
 *
 * @module main
 */

import { loadAppData } from "./data/loader";
import { buildUnifiedGraph, defaultLayers, type GraphLayers } from "./data/graph-builder";
import { createLayout } from "./ui/layout";
import { createGraph, updateGraphData, refreshLabels, resetCamera, flyToNode, type GraphInstance } from "./graph/graph";
import { initCameraMotion, setCameraMode, getCameraMode, type CameraMode } from "./graph/camera-motion";
import {
  triggerHighlights,
  startHighlightLoop,
} from "./graph/highlight";
import { initScalePanel, updateScalePanel, clearScalePanel } from "./ui/scale-panel";
import { initChordPanel, updateChordPanel, clearChordPanel } from "./ui/chord-panel";
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
import { findFullyActiveEntries, normalizeNote } from "./music/note-utils";
import { setNotation, onNotationChange, type NotationMode } from "./music/notation";
import type { AppData, NoteName, NoteEventDetail } from "./types";

import "./styles/main.css";
import "./styles/panels.css";
import "./styles/typography.css";

/** Currently held notes (for piano key visual state). */
const activeNotes = new Set<NoteName>();

/**
 * Recently played notes with timestamps. Notes linger for RECENT_WINDOW_MS
 * after being played, so sequential notes (e.g., C then E then G) can
 * still trigger a chord/scale even if they're not all held simultaneously.
 */
const recentNotes = new Map<NoteName, number>();
const RECENT_WINDOW_MS = 2000;

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

  const panelElements = {
    scaleNameEl: elements.scaleNameEl,
    scaleNotesEl: elements.scaleNotesEl,
    relatedScalesEl: elements.relatedScalesEl,
  };

  // Initialize 3D graph
  const graph: GraphInstance = createGraph(
    elements.graphContainer,
    graphData,
    (nodeId: string, _nodeType: string) => {
      updateScalePanel(nodeId, data, panelElements);
      updateChordPanel(nodeId, data, elements.relatedChordsEl);
    },
    () => {
      // Double-click background: clear selection
      clearScalePanel(panelElements);
      clearChordPanel(elements.relatedChordsEl);
    }
  );

  // Initialize panels with navigation handler
  const navigateToScale = (scaleId: string) => {
    flyToNode(graph, scaleId);
    updateScalePanel(scaleId, data, panelElements);
    updateChordPanel(scaleId, data, elements.relatedChordsEl);
  };
  initScalePanel(panelElements, navigateToScale);
  initChordPanel(elements.relatedChordsEl, navigateToScale);

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
  createCameraControls(elements.controlsEl, graph);
  createLayerToggles(elements.controlsEl, graph, data);
  createNotationToggle(elements.controlsEl, graph, data);
  createMIDIButton(elements.controlsEl);
  createAudioControls(elements.controlsEl);
  createHelpButton(elements.controlsEl);

  // Note events
  document.addEventListener("piano:noteon", ((
    e: CustomEvent<NoteEventDetail>
  ) => {
    const note = normalizeNote(e.detail.note);
    if (!note) return;

    activeNotes.add(note);
    recentNotes.set(note, performance.now());
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
    }
    // Don't remove from recentNotes — let the window expire naturally
    updateNoteHighlights(graph, data);
  }) as EventListener);

  /** Rebuild graph when layers change. */
  function rebuildGraph() {
    graphData = buildUnifiedGraph(data, layers);
    updateGraphData(graph, graphData);
  }

  // Keep reference to rebuildGraph (used by layer toggles above)
  void rebuildGraph;
}

/**
 * Highlights nodes based on notes:
 * - Note nodes: light up immediately when played
 * - Chords/Scales: light up when ALL their notes were played recently
 *   (within RECENT_WINDOW_MS), even if not held simultaneously
 */
function updateNoteHighlights(graph: GraphInstance, data: AppData): void {
  const highlightIds = new Set<string>();
  const now = performance.now();

  // Prune expired notes from the recent window
  for (const [note, timestamp] of recentNotes) {
    if (now - timestamp > RECENT_WINDOW_MS) {
      recentNotes.delete(note);
    }
  }

  // Build the set of recently active notes
  const recent = new Set<NoteName>(recentNotes.keys());

  // Note nodes light up for currently held notes
  for (const note of activeNotes) {
    highlightIds.add(`♪ ${note}`);
  }
  // Also light up recently played notes (fading)
  for (const note of recent) {
    highlightIds.add(`♪ ${note}`);
  }

  // Scales and chords: ALL their notes must be in the recent window
  const fullyActive = findFullyActiveEntries(recent, data.scaleDict);
  for (const id of fullyActive) {
    highlightIds.add(id);
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

/** Creates camera mode buttons: Orbit, Follow, Free, and Reset. */
function createCameraControls(
  container: HTMLElement,
  graph: GraphInstance
): void {
  const wrapper = document.createElement("div");
  wrapper.className = "midi-controls";

  const modes: Array<{ mode: CameraMode; label: string }> = [
    { mode: "orbit", label: "Orbit" },
    { mode: "follow", label: "Follow" },
    { mode: "free", label: "Free" },
  ];

  const buttons: HTMLButtonElement[] = [];

  for (const { mode, label } of modes) {
    const btn = document.createElement("button");
    btn.className = `midi-button ${getCameraMode() === mode ? "midi-button--active" : ""}`;
    btn.textContent = label;
    btn.addEventListener("click", () => {
      setCameraMode(mode);
      for (const b of buttons) b.classList.remove("midi-button--active");
      btn.classList.add("midi-button--active");
    });
    buttons.push(btn);
    wrapper.appendChild(btn);
  }

  const resetBtn = document.createElement("button");
  resetBtn.className = "midi-button";
  resetBtn.textContent = "Reset";
  resetBtn.addEventListener("click", () => {
    resetCamera(graph);
  });
  wrapper.appendChild(resetBtn);

  container.appendChild(wrapper);
}

/** Creates a help button that shows keyboard shortcuts and controls. */
function createHelpButton(container: HTMLElement): void {
  const wrapper = document.createElement("div");
  wrapper.className = "midi-controls";

  const btn = document.createElement("button");
  btn.className = "midi-button";
  btn.textContent = "? Help";
  btn.addEventListener("click", () => toggleHelpOverlay());

  wrapper.appendChild(btn);
  container.appendChild(wrapper);
}

/** Toggles the help overlay. */
function toggleHelpOverlay(): void {
  let overlay = document.getElementById("help-overlay");
  if (overlay) {
    overlay.remove();
    return;
  }

  overlay = document.createElement("div");
  overlay.id = "help-overlay";
  overlay.className = "help-overlay";
  overlay.innerHTML = `
    <div class="help-content">
      <h2>Controls</h2>
      <div class="help-section">
        <h3>Navigation</h3>
        <p><b>Drag</b> — Orbit camera</p>
        <p><b>Scroll</b> — Zoom in/out</p>
        <p><b>Right-drag</b> — Pan</p>
        <p><b>Double-click background</b> — Reset camera &amp; deselect</p>
        <p><b>Click node</b> — Select scale, fly to it</p>
      </div>
      <div class="help-section">
        <h3>Piano Keyboard</h3>
        <p><b>Lower octave</b> — A S D F G H J (white) · W E T Y U (black)</p>
        <p><b>Upper octave</b> — K L ; ' Z X C (white) · O P [ ] \\ (black)</p>
      </div>
      <div class="help-section">
        <h3>Features</h3>
        <p><b>Chords / Notes</b> — Toggle graph layers</p>
        <p><b>ABC / Do Re Mi</b> — Switch notation system</p>
        <p><b>Connect MIDI</b> — Use a hardware MIDI controller</p>
        <p><b>Upload Audio</b> — Analyze frequencies in an audio file</p>
      </div>
      <div class="help-section">
        <p><a href="https://github.com/itsTAMART/3d-music-scales" target="_blank" rel="noopener noreferrer">View on GitHub</a></p>
      </div>
      <button class="midi-button help-close">Close</button>
    </div>
  `;

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay || (e.target as HTMLElement).classList.contains("help-close")) {
      overlay!.remove();
    }
  });

  document.body.appendChild(overlay);
}

// Run when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
