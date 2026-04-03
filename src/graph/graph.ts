/**
 * Graph module — initializes and manages the 3D force-directed graph.
 *
 * Renders scale nodes as glowing star points with text labels, connected
 * by faint constellation-line links. Uses OrbitControls for stable camera
 * navigation with zoom limits.
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
import {
  Group,
  Mesh,
  SphereGeometry,
  MeshBasicMaterial,
  SpriteMaterial,
  Sprite,
  AdditiveBlending,
  TextureLoader,
  Color,
} from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { GraphData } from "../types";

/** Callback type for when a graph node is clicked. */
export type NodeClickHandler = (nodeId: string) => void;

/** Re-export the graph instance type for use by other modules. */
export type GraphInstance = ForceGraph3DInstance;

/** Shared glow texture for star sprites (created once). */
let glowTexture: ReturnType<typeof createGlowCanvas> | null = null;

/**
 * Creates and initializes the 3D force graph in the given container.
 * Nodes look like stars; links look like constellation lines.
 */
export function createGraph(
  container: HTMLElement,
  data: GraphData,
  onNodeClick: NodeClickHandler
): GraphInstance {
  const config: ConfigOptions = { controlType: "orbit" };

  // Create glow texture once
  if (!glowTexture) {
    glowTexture = createGlowCanvas();
  }

  const graph = new ForceGraph3D(container, config)
    .graphData(data)
    .nodeLabel("id")
    .nodeAutoColorBy("group")
    .nodeThreeObject((node: NodeObject) => {
      const id = (node.id as string) ?? "";
      const color =
        ((node as Record<string, unknown>).color as string) ?? "#ffffff";

      const group = new Group();

      // Invisible sphere for drag/click hit area
      const hitArea = new Mesh(
        new SphereGeometry(8),
        new MeshBasicMaterial({
          depthWrite: false,
          transparent: true,
          opacity: 0,
        })
      );
      group.add(hitArea);

      // Star core — small bright sphere
      const core = new Mesh(
        new SphereGeometry(1.2, 16, 16),
        new MeshBasicMaterial({
          color: new Color(color).lerp(new Color("#ffffff"), 0.5),
          transparent: true,
          opacity: 0.9,
        })
      );
      group.add(core);

      // Glow sprite — soft additive halo
      const glowMat = new SpriteMaterial({
        map: glowTexture!,
        color: new Color(color),
        transparent: true,
        opacity: 0.35,
        blending: AdditiveBlending,
        depthWrite: false,
      });
      const glow = new Sprite(glowMat);
      glow.scale.set(14, 14, 1);
      group.add(glow);

      // Text label
      const sprite = new SpriteText(id);
      sprite.color = color;
      sprite.textHeight = 3.2;
      sprite.fontWeight = "300";
      sprite.position.y = 6;
      group.add(sprite);

      // Store references for highlight module
      group.userData.sprite = sprite;
      group.userData.core = core;
      group.userData.glow = glow;
      group.userData.nodeId = id;
      group.userData.originalColor = color;

      return group;
    })
    // Constellation-line links — thin, faint, with subtle color
    .linkColor(() => "rgba(60, 140, 220, 0.12)")
    .linkOpacity(1)
    .linkWidth(0.3)
    .onNodeHover((node: NodeObject | null) => {
      container.style.cursor = node ? "pointer" : "";
    })
    .onNodeClick((node: NodeObject) => {
      const { x, y, z } = node;
      if (x == null || y == null || z == null) return;

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

  // Configure OrbitControls
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
  setTimeout(() => {
    const controls = graph.controls() as OrbitControls;
    if (controls) {
      controls.minDistance = 50;
      controls.maxDistance = 800;
      controls.enableDamping = true;
      controls.dampingFactor = 0.1;
      controls.minPolarAngle = 0.2;
      controls.maxPolarAngle = Math.PI - 0.2;
    }
  }, 500);
}

/**
 * Creates a canvas-based radial gradient texture for star glow sprites.
 * Returns a Three.js texture.
 */
function createGlowCanvas() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const gradient = ctx.createRadialGradient(
    size / 2, size / 2, 0,
    size / 2, size / 2, size / 2
  );
  gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
  gradient.addColorStop(0.15, "rgba(255, 255, 255, 0.6)");
  gradient.addColorStop(0.4, "rgba(200, 220, 255, 0.15)");
  gradient.addColorStop(1, "rgba(100, 150, 255, 0)");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const loader = new TextureLoader();
  return loader.load(canvas.toDataURL());
}
