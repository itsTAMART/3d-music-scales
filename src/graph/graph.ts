/**
 * Graph module — initializes and manages the 3D force-directed graph.
 *
 * Renders scale nodes as glowing stars with bloom post-processing,
 * distance-based label fading, and constellation-line links.
 * Uses UnrealBloomPass for physically-realistic light bleed that
 * makes stars look impressive at any zoom level.
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
import type { GraphData } from "../types";

/** Callback type for when a graph node is clicked. */
export type NodeClickHandler = (nodeId: string) => void;

/** Re-export the graph instance type for use by other modules. */
export type GraphInstance = ForceGraph3DInstance;

/** Shared glow texture (created once). */
let glowTexture: ReturnType<typeof createGlowCanvas> | null = null;

/** Distance at which labels start appearing. */
const LABEL_FADE_NEAR = 80;
/** Distance at which labels are fully invisible. */
const LABEL_FADE_FAR = 220;

/**
 * Creates and initializes the 3D force graph.
 * Stars with bloom, distance-faded labels, and constellation links.
 */
export function createGraph(
  container: HTMLElement,
  data: GraphData,
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

      const group = new Group();

      // Invisible sphere for drag/click hit area
      group.add(
        new Mesh(
          new SphereGeometry(8),
          new MeshBasicMaterial({
            depthWrite: false,
            transparent: true,
            opacity: 0,
          })
        )
      );

      // Star core — small bright point (bloom makes it glow)
      const coreColor = new Color(color).lerp(new Color("#ffffff"), 0.6);
      const core = new Mesh(
        new SphereGeometry(0.5, 12, 12),
        new MeshBasicMaterial({
          color: coreColor,
          transparent: false,
        })
      );
      group.add(core);

      // Soft halo sprite (additive, subtle — bloom does the heavy lifting)
      const glowMat = new SpriteMaterial({
        map: glowTexture!,
        color: new Color(color),
        transparent: true,
        opacity: 0.4,
        blending: AdditiveBlending,
        depthWrite: false,
      });
      const glow = new Sprite(glowMat);
      glow.scale.set(8, 8, 1);
      group.add(glow);

      // Text label — invisible at distance, fades in when close
      const sprite = new SpriteText(id);
      sprite.color = color;
      sprite.textHeight = 2.8;
      sprite.fontWeight = "300";
      sprite.position.y = 5;
      sprite.material.transparent = true;
      sprite.material.opacity = 0;
      group.add(sprite);

      group.userData.sprite = sprite;
      group.userData.core = core;
      group.userData.glow = glow;
      group.userData.nodeId = id;
      group.userData.originalColor = color;

      return group;
    })
    // Constellation links — thin, faint
    .linkColor(() => "rgba(60, 140, 220, 0.10)")
    .linkOpacity(1)
    .linkWidth(0.2)
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
    .backgroundColor("#030810");

  // Spread the graph wider
  graph.d3Force("charge")?.strength(-120);
  graph.d3Force("link")?.distance(
    (link: { value?: number }) => 40 + (link.value ?? 1) * 20
  );

  // Randomize initial positions so nodes don't start stacked
  for (const node of data.nodes) {
    if (node.x == null) node.x = (Math.random() - 0.5) * 200;
    if (node.y == null) node.y = (Math.random() - 0.5) * 200;
    if (node.z == null) node.z = (Math.random() - 0.5) * 200;
  }

  // Warm up the force simulation so nodes are spread by first render
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

/**
 * Adds UnrealBloomPass to the graph's post-processing pipeline.
 * Makes bright star cores naturally bleed light into surrounding pixels,
 * creating a physically-realistic glow at any zoom level.
 */
function setupBloom(graph: GraphInstance): void {
  setTimeout(() => {
    const composer = graph.postProcessingComposer();
    if (!composer) return;

    const renderer = graph.renderer();
    const bloomPass = new UnrealBloomPass(
      new Vector2(renderer.domElement.width, renderer.domElement.height),
      1.2,   // strength — how much glow
      0.6,   // radius — how far the glow spreads
      0.15   // threshold — brightness cutoff (low = more things glow)
    );

    composer.addPass(bloomPass);
  }, 200);
}

/**
 * Creates a radial gradient glow texture for star halos.
 * Tighter falloff than before since bloom handles the outer glow.
 */
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
