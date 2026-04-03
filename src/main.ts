/**
 * Application entry point — initializes all modules and wires them together.
 *
 * Loads data, creates the DOM layout, initializes the 3D graph,
 * and sets up event handlers for node selection.
 *
 * @module main
 */

import { loadAppData } from "./data/loader";
import { createLayout } from "./ui/layout";
import { createGraph } from "./graph/graph";
import { updateScalePanel } from "./ui/scale-panel";
import { updateChordPanel } from "./ui/chord-panel";
import type { AppData } from "./types";

import "./styles/main.css";
import "./styles/panels.css";
import "./styles/typography.css";

/** Initialize the application. */
function init(): void {
  const app = document.getElementById("app");
  if (!app) throw new Error("Missing #app element");

  // Load all data synchronously (bundled JSON imports)
  const data: AppData = loadAppData();

  // Create DOM layout
  const elements = createLayout(app);

  // Initialize 3D graph with node click handler
  createGraph(elements.graphContainer, data.scaleGraph, (scaleId: string) => {
    updateScalePanel(scaleId, data, {
      scaleNameEl: elements.scaleNameEl,
      scaleNotesEl: elements.scaleNotesEl,
      relatedScalesEl: elements.relatedScalesEl,
    });
    updateChordPanel(scaleId, data, elements.relatedChordsEl);
  });
}

// Run when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
