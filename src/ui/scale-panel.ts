/**
 * Scale panel module — populates the left sidebar with scale info.
 *
 * When a scale node is clicked, shows its name, notes, and related scales.
 * Related scales are clickable to navigate to them. Panel re-renders
 * when notation mode changes.
 *
 * @module ui/scale-panel
 */

import type { AppData, ScaleLink } from "../types";
import { getLinkNodeId } from "../music/note-utils";
import { displayNote, displayScaleName, onNotationChange } from "../music/notation";

/** DOM elements needed by the scale panel. */
export interface ScalePanelElements {
  scaleNameEl: HTMLElement;
  scaleNotesEl: HTMLElement;
  relatedScalesEl: HTMLElement;
}

/** Callback for navigating to a scale (clicking a related item). */
export type ScaleNavigateHandler = (scaleId: string) => void;

/** Tracks current selection so we can re-render on notation change. */
let currentScaleId: string | null = null;
let currentData: AppData | null = null;
let currentElements: ScalePanelElements | null = null;
let currentNavigateHandler: ScaleNavigateHandler | null = null;

/**
 * Initializes the scale panel with notation change listener.
 * Call once at startup.
 */
export function initScalePanel(
  elements: ScalePanelElements,
  onNavigate: ScaleNavigateHandler
): void {
  currentElements = elements;
  currentNavigateHandler = onNavigate;

  onNotationChange(() => {
    if (currentScaleId && currentData && currentElements) {
      renderPanel(currentScaleId, currentData, currentElements);
    }
  });
}

/**
 * Updates the scale panel with information about the selected scale.
 */
export function updateScalePanel(
  scaleId: string,
  data: AppData,
  elements: ScalePanelElements
): void {
  currentScaleId = scaleId;
  currentData = data;
  currentElements = elements;
  renderPanel(scaleId, data, elements);
}

/** Clears the scale panel to its empty state. */
export function clearScalePanel(elements: ScalePanelElements): void {
  currentScaleId = null;
  elements.scaleNameEl.textContent = "";
  elements.scaleNotesEl.textContent = "";
  elements.relatedScalesEl.innerHTML = "";
}

/** Renders the panel content. */
function renderPanel(
  scaleId: string,
  data: AppData,
  elements: ScalePanelElements
): void {
  const { scaleDict, scaleGraph } = data;
  const info = scaleDict[scaleId];

  elements.scaleNameEl.textContent = displayScaleName(scaleId);

  if (info) {
    renderNotes(elements.scaleNotesEl, info.notes);
  } else {
    elements.scaleNotesEl.textContent = "";
  }

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

  renderRelatedScales(elements.relatedScalesEl, related, scaleDict);
}

/** Renders note names with highlighting. */
function renderNotes(container: HTMLElement, notes: string[]): void {
  container.innerHTML = "";
  container.appendChild(document.createTextNode("["));

  notes.forEach((note, i) => {
    const span = document.createElement("span");
    span.className = "note";
    span.textContent = displayNote(note);
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

/** Renders the list of related scales (clickable). */
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

    // Click to navigate to this scale
    item.addEventListener("click", () => {
      currentNavigateHandler?.(scale.name);
    });

    const nameDiv = document.createElement("div");
    nameDiv.className = "item-name";
    nameDiv.textContent = displayScaleName(scale.name);

    const notesDiv = document.createElement("div");
    notesDiv.className = "item-notes";
    const info = scaleDict[scale.name];
    if (info) {
      const noteSpan = document.createElement("span");
      noteSpan.className = "note";
      noteSpan.textContent = info.notes.map(displayNote).join(", ");
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

/** Gets the other node ID in a link. */
function getOtherNodeId(link: ScaleLink, selectedId: string): string {
  const sourceId = getLinkNodeId(link.source);
  return sourceId === selectedId ? getLinkNodeId(link.target) : sourceId;
}
