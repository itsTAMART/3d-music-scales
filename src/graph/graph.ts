/**
 * Graph module — initializes and manages the 3D force-directed graph.
 *
 * Wraps the 3d-force-graph library, configuring node rendering (spheres
 * with text labels), link coloring, camera animation on click, and
 * hover interactions. Uses OrbitControls for stable camera navigation
 * with zoom limits.
 *
 * @module graph/graph
 *
 * @example
 * ```ts
 * import { createGraph } from "@/graph/graph";
 * const graph = createGraph(container, graphData, onNodeClick);
 * ```
 */

import ForceGraph3D from "3d-force-graph";
import type { ForceGraph3DInstance, ConfigOptions } from "3d-force-graph";
import type { NodeObject } from "three-forcegraph";
import SpriteText from "three-spritetext";
import { Mesh, SphereGeometry, MeshBasicMaterial } from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { GraphData } from "../types";

/** Callback type for when a graph node is clicked. */
export type NodeClickHandler = (nodeId: string) => void;

/** Re-export the graph instance type for use by other modules. */
export type GraphInstance = ForceGraph3DInstance;

/**
 * Creates and initializes the 3D force graph in the given container.
 * Uses OrbitControls for stable camera navigation with zoom limits.
 *
 * @param container - The DOM element to render the graph into.
 * @param data - The graph data (nodes and links).
 * @param onNodeClick - Callback fired when a node is clicked.
 * @returns The ForceGraph3D instance for further manipulation.
 */
export function createGraph(
  container: HTMLElement,
  data: GraphData,
  onNodeClick: NodeClickHandler
): GraphInstance {
  const config: ConfigOptions = { controlType: "orbit" };

  const graph = new ForceGraph3D(container, config)
    .graphData(data)
    .nodeLabel("id")
    .nodeAutoColorBy("group")
    .nodeThreeObject((node: NodeObject) => {
      const id = (node.id as string) ?? "";
      const color = (node as Record<string, unknown>).color as string ?? "#ffffff";

      // Invisible sphere for drag/click hit area
      const obj = new Mesh(
        new SphereGeometry(10),
        new MeshBasicMaterial({
          depthWrite: false,
          transparent: true,
          opacity: 0,
        })
      );

      // Text label as child sprite
      const sprite = new SpriteText(id);
      sprite.color = color;
      sprite.textHeight = 4;
      obj.add(sprite);

      // Store references for highlight module
      obj.userData.sprite = sprite;
      obj.userData.nodeId = id;
      obj.userData.originalColor = color;

      return obj;
    })
    .linkAutoColorBy("value")
    .linkOpacity(0.3)
    .linkWidth(0.5)
    .onNodeHover((node: NodeObject | null) => {
      container.style.cursor = node ? "pointer" : "";
    })
    .onNodeClick((node: NodeObject) => {
      const { x, y, z } = node;
      if (x == null || y == null || z == null) return;

      // Fly camera to the clicked node
      const distance = 40;
      const distRatio = 1 + distance / Math.hypot(x, y, z);

      graph.cameraPosition(
        { x: x * distRatio, y: y * distRatio, z: z * distRatio },
        { x, y, z },
        3000
      );

      onNodeClick((node.id as string) ?? "");
    })
    .backgroundColor("rgba(0, 0, 0, 0)");

  // Double-click background to reset camera
  let lastBgClick = 0;
  graph.onBackgroundClick(() => {
    const now = Date.now();
    if (now - lastBgClick < 400) {
      resetCamera(graph);
    }
    lastBgClick = now;
  });

  // Configure OrbitControls zoom limits after initialization
  setupCameraControls(graph);

  return graph;
}

/**
 * Resets the camera to show all nodes (zoom-to-fit).
 */
export function resetCamera(graph: GraphInstance): void {
  graph.zoomToFit(1000, 50);
}

/**
 * Configures OrbitControls with zoom limits and damping.
 */
function setupCameraControls(graph: GraphInstance): void {
  // Controls are available after the first render tick
  setTimeout(() => {
    const controls = graph.controls() as OrbitControls;
    if (controls) {
      // Zoom limits: don't let the user zoom too far in or out
      controls.minDistance = 50;
      controls.maxDistance = 800;

      // Smooth damping for more pleasant navigation
      controls.enableDamping = true;
      controls.dampingFactor = 0.1;

      // Limit vertical rotation to avoid flipping
      controls.minPolarAngle = 0.2;   // ~11° from top
      controls.maxPolarAngle = Math.PI - 0.2; // ~169° from top
    }
  }, 500);
}
