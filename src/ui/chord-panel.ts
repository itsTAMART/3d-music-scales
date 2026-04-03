/**
 * Chord panel module — populates the right sidebar with related chords.
 *
 * When a scale is selected, this module finds all chords linked to that
 * scale and displays them in a grid layout.
 *
 * @module ui/chord-panel
 *
 * @example
 * ```ts
 * import { updateChordPanel } from "@/ui/chord-panel";
 * updateChordPanel("C Major Scale", appData, chordContainer);
 * ```
 */

import type { AppData } from "../types";

/**
 * Updates the chord panel with chords related to the selected scale.
 * Chords are sorted by closeness (value field) and displayed in a 2-column grid.
 */
export function updateChordPanel(
  scaleId: string,
  data: AppData,
  container: HTMLElement
): void {
  const { chordData, scaleDict } = data;

  // Find chord links for this scale
  const chordLinks = chordData.links
    .filter((link) => link.source === scaleId || link.target === scaleId)
    .sort((a, b) => a.value - b.value);

  // Get chord names (the side of the link that isn't the scale)
  const chords = chordLinks.map((link) => ({
    name: link.source === scaleId ? link.target : link.source,
    distance: link.value,
  }));

  renderChords(container, chords, scaleDict);
}

/** Clears the chord panel. */
export function clearChordPanel(container: HTMLElement): void {
  container.innerHTML = "";
}

interface ChordEntry {
  name: string;
  distance: number;
}

/** Renders chord items into the grid container. */
function renderChords(
  container: HTMLElement,
  chords: ChordEntry[],
  scaleDict: AppData["scaleDict"]
): void {
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

    const nameDiv = document.createElement("div");
    nameDiv.className = "item-name";
    nameDiv.textContent = chord.name;

    const notesDiv = document.createElement("div");
    notesDiv.className = "item-notes";

    // Look up notes for this chord in the scale dict (it has chord entries too)
    const info = scaleDict[chord.name];
    if (info) {
      const noteSpan = document.createElement("span");
      noteSpan.className = "note";
      noteSpan.textContent = info.notes.join(", ");
      notesDiv.appendChild(document.createTextNode("["));
      notesDiv.appendChild(noteSpan);
      notesDiv.appendChild(document.createTextNode("]"));
    }

    item.appendChild(nameDiv);
    item.appendChild(notesDiv);
    container.appendChild(item);
  }
}
