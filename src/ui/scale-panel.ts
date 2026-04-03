/**
 * Scale panel module — populates the left sidebar with scale info.
 *
 * When a scale node is clicked, this module updates the "This Scale"
 * section and the "Related Scales" list with sorted related scales.
 *
 * @module ui/scale-panel
 *
 * @example
 * ```ts
 * import { updateScalePanel } from "@/ui/scale-panel";
 * updateScalePanel("C Major Scale", appData, elements);
 * ```
 */

import type { AppData, ScaleLink } from "../types";
import { getLinkNodeId } from "../music/note-utils";

/** DOM elements needed by the scale panel. */
export interface ScalePanelElements {
  scaleNameEl: HTMLElement;
  scaleNotesEl: HTMLElement;
  relatedScalesEl: HTMLElement;
}

/**
 * Updates the scale panel with information about the selected scale.
 * Shows the scale name, its notes, and a sorted list of related scales.
 */
export function updateScalePanel(
  scaleId: string,
  data: AppData,
  elements: ScalePanelElements
): void {
  const { scaleDict, scaleGraph } = data;
  const info = scaleDict[scaleId];

  // Update scale name and notes
  elements.scaleNameEl.textContent = scaleId;

  if (info) {
    renderNotes(elements.scaleNotesEl, info.notes);
  } else {
    elements.scaleNotesEl.textContent = "";
  }

  // Find and sort related scales
  const relatedLinks = scaleGraph.links.filter(
    (link) =>
      getLinkNodeId(link.source) === scaleId ||
      getLinkNodeId(link.target) === scaleId
  );

  const related = relatedLinks
    .map((link) => ({
      name: getOtherNodeId(link, scaleId),
      distance: link.value,
    }))
    .sort((a, b) => a.distance - b.distance);

  // Render related scales list
  renderRelatedScales(elements.relatedScalesEl, related, scaleDict);
}

/** Clears the scale panel to its empty state. */
export function clearScalePanel(elements: ScalePanelElements): void {
  elements.scaleNameEl.textContent = "";
  elements.scaleNotesEl.textContent = "";
  elements.relatedScalesEl.innerHTML = "";
}

/** Renders an array of note names with highlighting. */
function renderNotes(container: HTMLElement, notes: string[]): void {
  container.innerHTML = "";
  const open = document.createTextNode("[");
  container.appendChild(open);

  notes.forEach((note, i) => {
    const span = document.createElement("span");
    span.className = "note";
    span.textContent = note;
    container.appendChild(span);
    if (i < notes.length - 1) {
      container.appendChild(document.createTextNode(", "));
    }
  });

  container.appendChild(document.createTextNode("]"));
}

interface RelatedScale {
  name: string;
  distance: number;
}

/** Renders the list of related scales. */
function renderRelatedScales(
  container: HTMLElement,
  scales: RelatedScale[],
  scaleDict: AppData["scaleDict"]
): void {
  container.innerHTML = "";

  if (scales.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Click a scale to see relations";
    container.appendChild(empty);
    return;
  }

  for (const scale of scales) {
    const item = document.createElement("div");
    item.className = "related-item";
    item.dataset.scaleId = scale.name;

    const nameDiv = document.createElement("div");
    nameDiv.className = "item-name";
    nameDiv.textContent = scale.name;

    const notesDiv = document.createElement("div");
    notesDiv.className = "item-notes";
    const info = scaleDict[scale.name];
    if (info) {
      const noteSpan = document.createElement("span");
      noteSpan.className = "note";
      noteSpan.textContent = info.notes.join(", ");
      notesDiv.appendChild(document.createTextNode("["));
      notesDiv.appendChild(noteSpan);
      notesDiv.appendChild(document.createTextNode("]"));
    }

    const distSpan = document.createElement("span");
    distSpan.className = "item-distance";
    distSpan.textContent = `${scale.distance}`;
    notesDiv.appendChild(distSpan);

    item.appendChild(nameDiv);
    item.appendChild(notesDiv);
    container.appendChild(item);
  }
}

/** Gets the ID of the other node in a link (not the selected one). */
function getOtherNodeId(link: ScaleLink, selectedId: string): string {
  const sourceId = getLinkNodeId(link.source);
  return sourceId === selectedId ? getLinkNodeId(link.target) : sourceId;
}
