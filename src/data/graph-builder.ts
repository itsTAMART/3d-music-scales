/**
 * Graph data builder — combines scales, chords, and notes into a unified graph.
 *
 * Creates a merged graph where:
 * - Scale nodes (group 0–5) are the original scale data
 * - Chord nodes (group 10) come from related_chords.json
 * - Note nodes (group 20) are the 12 chromatic notes, connected to
 *   every scale that contains them
 *
 * Each node has a `nodeType` field ("scale" | "chord" | "note") for
 * rendering differentiation. Layers can be toggled on/off.
 *
 * @module data/graph-builder
 */

import type { AppData, ScaleNode, ScaleLink } from "../types";
import { NOTE_NAMES, type NoteName } from "../types";
import { normalizeNote } from "../music/note-utils";

/** Extended node with type info for the unified graph. */
export interface UnifiedNode extends ScaleNode {
  nodeType: "scale" | "chord" | "note";
}

/** Layers that can be toggled. */
export interface GraphLayers {
  scales: boolean;
  chords: boolean;
  notes: boolean;
}

/**
 * Builds the full unified graph data from the app data.
 * Returns all nodes and links; filtering by layer is done at render time.
 */
export function buildUnifiedGraph(
  data: AppData,
  layers: GraphLayers
): { nodes: UnifiedNode[]; links: ScaleLink[] } {
  const nodes: UnifiedNode[] = [];
  const links: ScaleLink[] = [];
  const nodeIds = new Set<string>();

  // Always include scale nodes
  if (layers.scales) {
    for (const node of data.scaleGraph.nodes) {
      nodes.push({ ...node, nodeType: "scale" });
      nodeIds.add(node.id);
    }
    for (const link of data.scaleGraph.links) {
      links.push({ ...link });
    }
  }

  // Chord nodes
  if (layers.chords && layers.scales) {
    for (const chord of data.chordData.nodes) {
      nodes.push({ id: chord.id, group: 10, nodeType: "chord" });
      nodeIds.add(chord.id);
    }
    // Only add chord-scale links where both endpoints exist
    for (const link of data.chordData.links) {
      if (nodeIds.has(link.source) && nodeIds.has(link.target)) {
        links.push({ source: link.source, target: link.target, value: link.value });
      }
    }
  }

  // Note nodes — 12 chromatic notes connected to scales
  if (layers.notes && layers.scales) {
    for (const note of NOTE_NAMES) {
      const noteId = `♪ ${note}`;
      nodes.push({ id: noteId, group: 20, nodeType: "note" });
      nodeIds.add(noteId);

      // Connect to every scale that contains this note
      for (const [scaleId, info] of Object.entries(data.scaleDict)) {
        if (!nodeIds.has(scaleId)) continue;

        const scaleNotes = info.notes.map((n) => normalizeNote(n)).filter(Boolean) as NoteName[];
        if (scaleNotes.includes(note)) {
          links.push({ source: noteId, target: scaleId, value: 3 });
        }
      }
    }
  }

  return { nodes, links };
}

/**
 * Returns the default layers configuration.
 */
export function defaultLayers(): GraphLayers {
  return { scales: true, chords: false, notes: false };
}
