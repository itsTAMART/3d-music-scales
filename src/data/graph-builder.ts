/**
 * Graph data builder — combines scales, chords, and notes into a unified graph.
 *
 * Creates a merged graph with performance limits:
 * - Scale nodes (group 0–5): all included with all inter-scale links
 * - Chord nodes (group 10): included, but only the top N strongest
 *   links per chord to keep the graph manageable
 * - Note nodes (group 20): 12 chromatic notes, connected only to
 *   scales where that note is the tonic (root) to limit link explosion
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

/** Max chord-scale links per chord (keep only closest). */
const MAX_CHORD_LINKS = 3;

/**
 * Builds the full unified graph data from the app data.
 */
export function buildUnifiedGraph(
  data: AppData,
  layers: GraphLayers
): { nodes: UnifiedNode[]; links: ScaleLink[] } {
  const nodes: UnifiedNode[] = [];
  const links: ScaleLink[] = [];
  const nodeIds = new Set<string>();

  // Scale nodes — always the foundation
  if (layers.scales) {
    for (const node of data.scaleGraph.nodes) {
      nodes.push({ ...node, nodeType: "scale" });
      nodeIds.add(node.id);
    }
    for (const link of data.scaleGraph.links) {
      links.push({ ...link });
    }
  }

  // Chord nodes — limit links per chord for performance
  if (layers.chords && layers.scales) {
    // Group chord links by chord, keep only the N closest
    const chordLinkMap = new Map<string, Array<{ source: string; target: string; value: number }>>();

    for (const link of data.chordData.links) {
      // Identify which side is the chord
      const isSourceScale = nodeIds.has(link.source);
      const isTargetScale = nodeIds.has(link.target);
      const chordId = isSourceScale ? link.target : link.source;

      if (!chordLinkMap.has(chordId)) chordLinkMap.set(chordId, []);
      chordLinkMap.get(chordId)!.push(link);
    }

    for (const [chordId, chordLinks] of chordLinkMap) {
      // Sort by value (closest first) and keep top N
      chordLinks.sort((a, b) => a.value - b.value);
      const kept = chordLinks.slice(0, MAX_CHORD_LINKS);

      // Only add the chord if it has valid links
      if (kept.some((l) => nodeIds.has(l.source) || nodeIds.has(l.target))) {
        nodes.push({ id: chordId, group: 10, nodeType: "chord" });
        nodeIds.add(chordId);

        for (const link of kept) {
          if (nodeIds.has(link.source) && nodeIds.has(link.target)) {
            links.push({ source: link.source, target: link.target, value: link.value });
          }
        }
      }
    }
  }

  // Note nodes — connect to scales where the note is the tonic
  // This creates ~12 links per note (one per key) instead of ~50+
  if (layers.notes && layers.scales) {
    for (const note of NOTE_NAMES) {
      const noteId = `♪ ${note}`;
      nodes.push({ id: noteId, group: 20, nodeType: "note" });
      nodeIds.add(noteId);

      for (const [scaleId, info] of Object.entries(data.scaleDict)) {
        if (!nodeIds.has(scaleId)) continue;

        const tonic = normalizeNote(info.tonic);
        if (tonic === note) {
          // Tonic link — strong connection
          links.push({ source: noteId, target: scaleId, value: 2 });
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
