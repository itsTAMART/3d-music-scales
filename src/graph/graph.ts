/**
 * Graph module — initializes and manages the 3D force-directed graph.
 *
 * Renders three types of nodes as stars with different visual styles:
 * - Scale nodes: medium bright stars (default)
 * - Chord nodes: smaller, dimmer stars
 * - Note nodes: bright, slightly larger stars with distinct color
 *
 * Uses bloom post-processing and distance-based label fading.
 *
 * @module graph/graph
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
  Vector2,
  Vector3,
} from "three";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { UnifiedNode } from "../data/graph-builder";
import type { ScaleLink } from "../types";
import { displayNote } from "../music/notation";

/** Callback type for when a graph node is clicked. */
export type NodeClickHandler = (nodeId: string, nodeType: string) => void;

/** Re-export the graph instance type for use by other modules. */
export type GraphInstance = ForceGraph3DInstance;

/** Shared glow texture. */
let glowTexture: ReturnType<typeof createGlowCanvas> | null = null;

/** Distance at which labels start appearing. */
const LABEL_FADE_NEAR = 80;
const LABEL_FADE_FAR = 220;

/** Node type visual configs. */
const NODE_STYLES: Record<string, {
  coreSize: number;
  glowSize: number;
  glowOpacity: number;
  textSize: number;
  textY: number;
  whiteMix: number;
}> = {
  scale: { coreSize: 0.5, glowSize: 8, glowOpacity: 0.4, textSize: 2.8, textY: 5, whiteMix: 0.6 },
  chord: { coreSize: 0.25, glowSize: 4, glowOpacity: 0.2, textSize: 2.0, textY: 3.5, whiteMix: 0.4 },
  note:  { coreSize: 0.8, glowSize: 12, glowOpacity: 0.6, textSize: 3.5, textY: 6, whiteMix: 0.8 },
};

/**
 * Creates and initializes the 3D force graph.
 */
export function createGraph(
  container: HTMLElement,
  data: { nodes: UnifiedNode[]; links: ScaleLink[] },
  onNodeClick: NodeClickHandler
): GraphInstance {
  const config: ConfigOptions = { controlType: "orbit" };

  if (!glowTexture) glowTexture = createGlowCanvas();

  const graph = new ForceGraph3D(container, config)
    .graphData(data)
    .nodeLabel("")
    .nodeAutoColorBy("group")
    .nodeThreeObject((node: NodeObject) => {
      const id = (node.id as string) ?? "";
      const color =
        ((node as Record<string, unknown>).color as string) ?? "#ffffff";
      const nodeType =
        ((node as Record<string, unknown>).nodeType as string) ?? "scale";

      const style = NODE_STYLES[nodeType] ?? NODE_STYLES.scale;
      const group = new Group();

      // Invisible hit area
      group.add(
        new Mesh(
          new SphereGeometry(8),
          new MeshBasicMaterial({ depthWrite: false, transparent: true, opacity: 0 })
        )
      );

      // Star core
      const coreColor = new Color(color).lerp(new Color("#ffffff"), style.whiteMix);
      const core = new Mesh(
        new SphereGeometry(style.coreSize, 12, 12),
        new MeshBasicMaterial({ color: coreColor, transparent: false })
      );
      group.add(core);

      // Glow halo
      const glowMat = new SpriteMaterial({
        map: glowTexture!,
        color: new Color(color),
        transparent: true,
        opacity: style.glowOpacity,
        blending: AdditiveBlending,
        depthWrite: false,
      });
      const glow = new Sprite(glowMat);
      glow.scale.set(style.glowSize, style.glowSize, 1);
      group.add(glow);

      // Label — use display notation for note nodes
      let labelText = id;
      if (nodeType === "note") {
        // Strip the ♪ prefix and convert
        const rawNote = id.replace("♪ ", "");
        labelText = displayNote(rawNote);
      }

      const sprite = new SpriteText(labelText);
      sprite.color = color;
      sprite.textHeight = style.textSize;
      sprite.fontWeight = nodeType === "note" ? "600" : "300";
      sprite.position.y = style.textY;
      sprite.material.transparent = true;
      sprite.material.opacity = 0;
      group.add(sprite);

      group.userData.sprite = sprite;
      group.userData.core = core;
      group.userData.glow = glow;
      group.userData.nodeId = id;
      group.userData.nodeType = nodeType;
      group.userData.originalColor = color;

      return group;
    })
    .linkColor((link: Record<string, unknown>) => {
      // Different link colors based on what's connected
      const val = (link.value as number) ?? 1;
      if (val >= 3) return "rgba(100, 220, 180, 0.06)"; // note-scale links
      return "rgba(60, 140, 220, 0.10)";
    })
    .linkOpacity(1)
    .linkWidth((link: Record<string, unknown>) => {
      const val = (link.value as number) ?? 1;
      return val >= 3 ? 0.1 : 0.2; // note links thinner
    })
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

      const nodeType = ((node as Record<string, unknown>).nodeType as string) ?? "scale";
      onNodeClick((node.id as string) ?? "", nodeType);
    })
    .backgroundColor("rgba(0,0,0,0)");

  // Force layout tuning
  graph.d3Force("charge")?.strength(-120);
  graph.d3Force("link")?.distance(
    (link: { value?: number }) => {
      const v = link.value ?? 1;
      if (v >= 3) return 60; // note-scale: moderate distance
      return 40 + v * 20;
    }
  );

  // Randomize initial positions
  for (const node of data.nodes) {
    if (node.x == null) node.x = (Math.random() - 0.5) * 200;
    if (node.y == null) node.y = (Math.random() - 0.5) * 200;
    if (node.z == null) node.z = (Math.random() - 0.5) * 200;
  }

  graph.d3ReheatSimulation();

  // Distance-based label fading
  graph.onEngineTick(() => {
    const camera = graph.camera();
    if (!camera) return;
    const camPos = camera.position;
    const graphNodes = graph.graphData().nodes as NodeObject[];
    const nodePos = new Vector3();

    for (const node of graphNodes) {
      const threeObj = (node as Record<string, unknown>).__threeObj as Group | undefined;
      if (!threeObj) continue;

      const label = threeObj.userData.sprite as {
        material?: { opacity: number };
      } | undefined;
      if (!label?.material) continue;
      if (threeObj.userData._highlightActive) continue;

      nodePos.set(node.x ?? 0, node.y ?? 0, node.z ?? 0);
      const dist = camPos.distanceTo(nodePos);
      const t = Math.max(0, Math.min(1, (dist - LABEL_FADE_NEAR) / (LABEL_FADE_FAR - LABEL_FADE_NEAR)));
      label.material.opacity = 1 - t;
    }
  });

  // Double-click background to reset camera
  let lastBgClick = 0;
  graph.onBackgroundClick(() => {
    const now = Date.now();
    if (now - lastBgClick < 400) {
      resetCamera(graph);
    }
    lastBgClick = now;
  });

  setupCameraControls(graph);
  setupBloom(graph);

  return graph;
}

/**
 * Updates the graph data (e.g., when toggling layers).
 */
export function updateGraphData(
  graph: GraphInstance,
  data: { nodes: UnifiedNode[]; links: ScaleLink[] }
): void {
  // Randomize new nodes' positions
  for (const node of data.nodes) {
    if (node.x == null) node.x = (Math.random() - 0.5) * 200;
    if (node.y == null) node.y = (Math.random() - 0.5) * 200;
    if (node.z == null) node.z = (Math.random() - 0.5) * 200;
  }
  graph.graphData(data);
}

/** Resets the camera to show all nodes. */
export function resetCamera(graph: GraphInstance): void {
  graph.zoomToFit(1000, 50);
}

/** Configures OrbitControls. */
function setupCameraControls(graph: GraphInstance): void {
  setTimeout(() => {
    const controls = graph.controls() as OrbitControls;
    if (controls) {
      controls.minDistance = 30;
      controls.maxDistance = 1200;
      controls.enableDamping = true;
      controls.dampingFactor = 0.1;
      controls.minPolarAngle = 0.2;
      controls.maxPolarAngle = Math.PI - 0.2;
    }
  }, 500);
}

/** Adds bloom post-processing. */
function setupBloom(graph: GraphInstance): void {
  setTimeout(() => {
    try {
      const composer = graph.postProcessingComposer();
      const renderer = graph.renderer();
      if (!composer || !renderer) return;

      const width = renderer.domElement.clientWidth || window.innerWidth;
      const height = renderer.domElement.clientHeight || window.innerHeight;

      const bloomPass = new UnrealBloomPass(
        new Vector2(width, height),
        1.0, 0.5, 0.2
      );
      composer.addPass(bloomPass);
    } catch {
      // Bloom is cosmetic, not critical
    }
  }, 1000);
}

/** Creates a radial gradient glow texture. */
function createGlowCanvas() {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const gradient = ctx.createRadialGradient(
    size / 2, size / 2, 0,
    size / 2, size / 2, size / 2
  );
  gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
  gradient.addColorStop(0.1, "rgba(255, 255, 255, 0.7)");
  gradient.addColorStop(0.3, "rgba(200, 230, 255, 0.15)");
  gradient.addColorStop(0.6, "rgba(150, 200, 255, 0.03)");
  gradient.addColorStop(1, "rgba(100, 150, 255, 0)");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  return new TextureLoader().load(canvas.toDataURL());
}
