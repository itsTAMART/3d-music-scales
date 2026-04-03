/**
 * Graph module — initializes and manages the 3D force-directed graph.
 *
 * Renders scale nodes as glowing stars with distance-based label fading.
 * Labels only appear when the camera is close to a node, making the
 * graph look like a star field from afar and a labeled constellation
 * up close. Uses OrbitControls for stable camera navigation.
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
  Vector3,
} from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { GraphData } from "../types";

/** Callback type for when a graph node is clicked. */
export type NodeClickHandler = (nodeId: string) => void;

/** Re-export the graph instance type for use by other modules. */
export type GraphInstance = ForceGraph3DInstance;

/** Shared glow texture (created once). */
let glowTexture: ReturnType<typeof createGlowCanvas> | null = null;

/** Shared spike texture for 4-point diffraction (created once). */
let spikeTexture: ReturnType<typeof createSpikeCanvas> | null = null;

/** Distance at which labels start appearing. */
const LABEL_FADE_NEAR = 80;
/** Distance at which labels are fully invisible. */
const LABEL_FADE_FAR = 200;

/**
 * Creates and initializes the 3D force graph.
 * Stars with distance-faded labels and constellation links.
 */
export function createGraph(
  container: HTMLElement,
  data: GraphData,
  onNodeClick: NodeClickHandler
): GraphInstance {
  const config: ConfigOptions = { controlType: "orbit" };

  if (!glowTexture) glowTexture = createGlowCanvas();
  if (!spikeTexture) spikeTexture = createSpikeCanvas();

  const graph = new ForceGraph3D(container, config)
    .graphData(data)
    .nodeLabel("") // disable default tooltip — we use custom labels
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

      // Star core — tiny bright point
      const coreColor = new Color(color).lerp(new Color("#ffffff"), 0.7);
      const core = new Mesh(
        new SphereGeometry(0.6, 12, 12),
        new MeshBasicMaterial({
          color: coreColor,
          transparent: true,
          opacity: 1,
        })
      );
      group.add(core);

      // Soft glow halo (additive)
      const glowMat = new SpriteMaterial({
        map: glowTexture!,
        color: new Color(color),
        transparent: true,
        opacity: 0.5,
        blending: AdditiveBlending,
        depthWrite: false,
      });
      const glow = new Sprite(glowMat);
      glow.scale.set(10, 10, 1);
      group.add(glow);

      // Diffraction spike cross (additive)
      const spikeMat = new SpriteMaterial({
        map: spikeTexture!,
        color: new Color(color).lerp(new Color("#ffffff"), 0.3),
        transparent: true,
        opacity: 0.25,
        blending: AdditiveBlending,
        depthWrite: false,
        rotation: Math.PI / 4, // 45° so spikes are ✕ shaped
      });
      const spike = new Sprite(spikeMat);
      spike.scale.set(18, 18, 1);
      group.add(spike);

      // Text label — starts invisible, fades in when camera approaches
      const sprite = new SpriteText(id);
      sprite.color = color;
      sprite.textHeight = 2.8;
      sprite.fontWeight = "300";
      sprite.position.y = 5;
      sprite.material.transparent = true;
      sprite.material.opacity = 0;
      group.add(sprite);

      // Store references
      group.userData.sprite = sprite;
      group.userData.core = core;
      group.userData.glow = glow;
      group.userData.spike = spike;
      group.userData.nodeId = id;
      group.userData.originalColor = color;

      return group;
    })
    // Constellation links
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
    .backgroundColor("rgba(0, 0, 0, 0)");

  // Spread the graph wider — more space between nodes
  graph.d3Force("charge")?.strength(-120);
  graph.d3Force("link")?.distance(
    (link: { value?: number }) => 40 + (link.value ?? 1) * 20
  );

  // Distance-based label fading — runs every frame
  graph.onEngineTick(() => {
    const camera = graph.camera();
    if (!camera) return;
    const camPos = camera.position;

    const nodes = graph.graphData().nodes as NodeObject[];
    const nodePos = new Vector3();

    for (const node of nodes) {
      const threeObj = (node as Record<string, unknown>).__threeObj as Group | undefined;
      if (!threeObj) continue;

      const label = threeObj.userData.sprite as {
        material?: { opacity: number };
      } | undefined;
      if (!label?.material) continue;

      // Skip if highlight module is controlling opacity
      // (userData.highlightControlled is set by highlight.ts)
      if (threeObj.userData._highlightActive) continue;

      nodePos.set(node.x ?? 0, node.y ?? 0, node.z ?? 0);
      const dist = camPos.distanceTo(nodePos);

      // Smoothstep fade: fully visible at NEAR, invisible at FAR
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
 * Creates a radial gradient glow texture for star halos.
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
  gradient.addColorStop(0.08, "rgba(255, 255, 255, 0.8)");
  gradient.addColorStop(0.25, "rgba(200, 230, 255, 0.2)");
  gradient.addColorStop(0.5, "rgba(150, 200, 255, 0.05)");
  gradient.addColorStop(1, "rgba(100, 150, 255, 0)");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  return new TextureLoader().load(canvas.toDataURL());
}

/**
 * Creates a 4-point diffraction spike texture.
 * Produces the classic star "cross" pattern.
 */
function createSpikeCanvas() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const cx = size / 2;
  const cy = size / 2;

  // Horizontal spike
  const hGrad = ctx.createLinearGradient(0, cy, size, cy);
  hGrad.addColorStop(0, "rgba(255,255,255,0)");
  hGrad.addColorStop(0.35, "rgba(255,255,255,0)");
  hGrad.addColorStop(0.48, "rgba(255,255,255,0.6)");
  hGrad.addColorStop(0.5, "rgba(255,255,255,1)");
  hGrad.addColorStop(0.52, "rgba(255,255,255,0.6)");
  hGrad.addColorStop(0.65, "rgba(255,255,255,0)");
  hGrad.addColorStop(1, "rgba(255,255,255,0)");

  ctx.fillStyle = hGrad;
  ctx.fillRect(0, cy - 1.5, size, 3);

  // Vertical spike
  const vGrad = ctx.createLinearGradient(cx, 0, cx, size);
  vGrad.addColorStop(0, "rgba(255,255,255,0)");
  vGrad.addColorStop(0.35, "rgba(255,255,255,0)");
  vGrad.addColorStop(0.48, "rgba(255,255,255,0.6)");
  vGrad.addColorStop(0.5, "rgba(255,255,255,1)");
  vGrad.addColorStop(0.52, "rgba(255,255,255,0.6)");
  vGrad.addColorStop(0.65, "rgba(255,255,255,0)");
  vGrad.addColorStop(1, "rgba(255,255,255,0)");

  ctx.fillStyle = vGrad;
  ctx.fillRect(cx - 1.5, 0, 3, size);

  // Bright center point
  const cGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 4);
  cGrad.addColorStop(0, "rgba(255,255,255,1)");
  cGrad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = cGrad;
  ctx.fillRect(cx - 4, cy - 4, 8, 8);

  return new TextureLoader().load(canvas.toDataURL());
}
