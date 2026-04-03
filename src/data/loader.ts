/**
 * Data loader module — fetches and types all JSON datasets.
 *
 * Loads scale graph data, scale metadata dictionary, and chord
 * relationship data in parallel using Promise.all.
 *
 * @module data/loader
 *
 * @example
 * ```ts
 * import { loadAppData } from "@/data/loader";
 * const data = await loadAppData();
 * console.log(data.scaleGraph.nodes.length); // 72
 * ```
 */

import type { AppData, ChordData, GraphData, ScaleDict } from "../types";

import scaleGraphJson from "./only-scales.json";
import scaleDictJson from "./scale_dict.json";
import chordDataJson from "./related_chords.json";

/**
 * Loads all application data from the bundled JSON files.
 * Returns typed data ready for use by the graph and UI modules.
 */
export function loadAppData(): AppData {
  return {
    scaleGraph: scaleGraphJson as unknown as GraphData,
    scaleDict: scaleDictJson as unknown as ScaleDict,
    chordData: chordDataJson as unknown as ChordData,
  };
}
