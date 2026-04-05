/**
 * Chord panel module — populates the right sidebar with related chords.
 * Chords are clickable to navigate to them in the graph.
 *
 * @module ui/chord-panel
 */

import type { AppData } from "../types";
import { displayNote, displayScaleName, onNotationChange } from "../music/notation";

/** Callback for navigating to a chord node. */
export type ChordNavigateHandler = (chordId: string) => void;

let currentScaleId: string | null = null;
let currentData: AppData | null = null;
let currentContainer: HTMLElement | null = null;
let navigateHandler: ChordNavigateHandler | null = null;

/** Initialize with notation change listener and navigate handler. */
export function initChordPanel(
  container: HTMLElement,
  onNavigate: ChordNavigateHandler
): void {
  currentContainer = container;
  navigateHandler = onNavigate;
  onNotationChange(() => {
    if (currentScaleId && currentData && currentContainer) {
      renderPanel(currentScaleId, currentData, currentContainer);
    }
  });
}

/** Updates the chord panel. */
export function updateChordPanel(
  scaleId: string,
  data: AppData,
  container: HTMLElement
): void {
  currentScaleId = scaleId;
  currentData = data;
  currentContainer = container;
  renderPanel(scaleId, data, container);
}

/** Clears the chord panel. */
export function clearChordPanel(container: HTMLElement): void {
  currentScaleId = null;
  container.innerHTML = "";
}

function renderPanel(scaleId: string, data: AppData, container: HTMLElement): void {
  const { chordData, scaleDict } = data;

  const chordLinks = chordData.links
    .filter((link) => link.source === scaleId || link.target === scaleId)
    .sort((a, b) => a.value - b.value);

  const chords = chordLinks.map((link) => ({
    name: link.source === scaleId ? link.target : link.source,
    distance: link.value,
  }));

  container.innerHTML = "";

  if (chords.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No related chords";
    container.appendChild(empty);
    return;
  }

  for (const chord of chords) {
    const item = document.createElement("div");
    item.className = "chord-item";
    item.style.cursor = "pointer";

    item.addEventListener("click", () => {
      navigateHandler?.(chord.name);
    });

    const nameDiv = document.createElement("div");
    nameDiv.className = "item-name";
    nameDiv.textContent = displayScaleName(chord.name);

    const notesDiv = document.createElement("div");
    notesDiv.className = "item-notes";

    const info = scaleDict[chord.name];
    if (info) {
      const noteSpan = document.createElement("span");
      noteSpan.className = "note";
      noteSpan.textContent = info.notes.map(displayNote).join(", ");
      notesDiv.appendChild(document.createTextNode("["));
      notesDiv.appendChild(noteSpan);
      notesDiv.appendChild(document.createTextNode("]"));
    }

    item.appendChild(nameDiv);
    item.appendChild(notesDiv);
    container.appendChild(item);
  }
}
