/**
 * Layout module — creates the DOM structure for the application.
 *
 * Builds the header, side panels, graph container, and bottom panel
 * programmatically. Uses CSS Grid for positioning (see styles/main.css).
 *
 * @module ui/layout
 *
 * @example
 * ```ts
 * import { createLayout } from "@/ui/layout";
 * const elements = createLayout(document.getElementById("app")!);
 * ```
 */

/** References to all major DOM containers created by the layout. */
export interface LayoutElements {
  graphContainer: HTMLDivElement;
  leftPanel: HTMLDivElement;
  rightPanel: HTMLDivElement;
  bottomPanel: HTMLDivElement;
  controlsEl: HTMLDivElement;
  scaleNameEl: HTMLDivElement;
  scaleNotesEl: HTMLDivElement;
  relatedScalesEl: HTMLDivElement;
  relatedChordsEl: HTMLDivElement;
}

/**
 * Creates the full DOM layout inside the given root element.
 * Returns references to key containers for use by other modules.
 */
export function createLayout(root: HTMLElement): LayoutElements {
  root.innerHTML = "";

  // Graph container (absolute positioned behind everything)
  const graphContainer = createElement("div", { id: "graph-container" });
  root.appendChild(graphContainer);

  // Header — spaceship bridge targeting display
  const header = createElement("div", { id: "header" });
  header.innerHTML = `<h1><span class="accent">&laquo;</span> MUSIC SCALES IN 3D <span class="accent">&raquo;</span></h1>`;
  root.appendChild(header);

  // Left panel
  const leftPanel = createElement("div", { id: "left-panel" });

  const scaleBlock = createPanelBlock("THIS SCALE");
  const scaleNameEl = createElement("div", { className: "scale-name" });
  const scaleNotesEl = createElement("div", { className: "scale-notes" });
  scaleBlock.appendChild(scaleNameEl);
  scaleBlock.appendChild(scaleNotesEl);
  leftPanel.appendChild(scaleBlock);

  const relatedBlock = createPanelBlock("RELATED SCALES");
  const relatedScalesEl = createElement("div", {
    className: "related-scales-list",
  });
  relatedBlock.appendChild(relatedScalesEl);
  leftPanel.appendChild(relatedBlock);

  root.appendChild(leftPanel);

  // Right panel
  const rightPanel = createElement("div", { id: "right-panel" });

  // Controls block first (stays pinned at top)
  const controlsBlock = createPanelBlock("CONTROLS");
  const controlsEl = createElement("div", { className: "controls-list" });
  controlsBlock.appendChild(controlsEl);
  rightPanel.appendChild(controlsBlock);

  // Related chords below (expands without pushing controls)
  const chordsBlock = createPanelBlock("RELATED CHORDS");
  const relatedChordsEl = createElement("div", { className: "chord-grid" });
  chordsBlock.appendChild(relatedChordsEl);
  rightPanel.appendChild(chordsBlock);

  root.appendChild(rightPanel);

  // Bottom panel (for piano keyboard)
  const bottomPanel = createElement("div", { id: "bottom-panel" });
  root.appendChild(bottomPanel);

  return {
    graphContainer,
    leftPanel,
    rightPanel,
    bottomPanel,
    controlsEl,
    scaleNameEl,
    scaleNotesEl,
    relatedScalesEl,
    relatedChordsEl,
  };
}

/** Helper to create an element with attributes. */
function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Partial<HTMLElementTagNameMap[K]> & { id?: string } = {}
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs.id) el.id = attrs.id;
  if (attrs.className) el.className = attrs.className;
  return el;
}

/** Creates a styled panel block with a heading. */
function createPanelBlock(title: string): HTMLDivElement {
  const block = createElement("div", { className: "panel-block" });
  const h2 = document.createElement("h2");
  h2.textContent = title;
  block.appendChild(h2);
  return block;
}
