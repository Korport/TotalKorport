import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { GlowLayer } from "@babylonjs/core/Layers/glowLayer";
import type { Simulation, Enemy, WorldGate } from "./simulation";
import type { Gate } from "./campaign";
interface Unit {
  root: TransformNode;
  parts: Mesh[];
}
const palettes = [
  ["#77785b", "#a4a181"],
  ["#707d7d", "#a0aeb1"],
  ["#776756", "#b29876"],
  ["#b49b70", "#dac49b"],
  ["#64696d", "#969aa5"],
];
export class Battlefield {
  engine: Engine;
  scene: Scene;
  camera: FreeCamera;
  private units: Unit[] = [];
  private enemies = new Map<number, Unit>();
  private gates = new Map<number, TransformNode>();
  private flashes: { mesh: Mesh; life: number }[] = [];
  private road: Mesh[] = [];
  private tank: TransformNode;
  private t = 0;
  private materials = new Map<string, StandardMaterial>();
  private templates = new Map<string, Mesh>();
  private region = -1;
  constructor(canvas: HTMLCanvasElement) {
    this.engine = new Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
    });
    this.engine.setHardwareScalingLevel(
      Math.max(1, window.devicePixelRatio / 1.5),
    );
    this.scene = new Scene(this.engine);
    this.scene.clearColor = Color4.FromHexString("#bec7b5ff");
    this.scene.fogMode = Scene.FOGMODE_LINEAR;
    this.scene.fogStart = 38;
    this.scene.fogEnd = 85;
    this.scene.fogColor = Color3.FromHexString("#bec7b5");
    this.camera = new FreeCamera("camera", new Vector3(0, 18, -13), this.scene);
    this.camera.setTarget(new Vector3(0, 0, 10));
    this.camera.fov = 1.05;
    this.camera.fovMode = 1;
    this.camera.minZ = 0.1;
    this.camera.maxZ = 140;
    new HemisphericLight("sky", new Vector3(0, 1, 0), this.scene).intensity =
      0.85;
    const sun = new DirectionalLight(
      "sun",
      new Vector3(-0.5, -1, 0.6),
      this.scene,
    );
    sun.intensity = 0.65;
    const glow = new GlowLayer("glow", this.scene, { blurKernelSize: 24 });
    glow.intensity = 0.35;
    this.box("terrain", 150, 0.3, 180, "#8b9273", 0, -0.45, 35);
    this.box("road", 15, 0.15, 145, "#596452", 0, -0.15, 40);
    for (const x of [-7.7, 7.7]) {
      this.box("shoulder", 0.45, 0.22, 145, "#d2c8a7", x, -0.04, 40);
      for (let i = 0; i < 32; i++)
        this.box(
          "road stud",
          0.12,
          0.05,
          0.4,
          "#d8debc",
          x * 0.91,
          0.02,
          i * 4 - 15,
        );
    }
    for (let i = 0; i < 28; i++) {
      for (const x of [-2.5, 2.5]) {
        const m = this.box(
          "lane",
          0.07,
          0.025,
          1.4,
          "#b6bd92",
          x,
          0.01,
          i * 4 - 15,
        );
        this.road.push(m);
      }
    }
    for (let i = 0; i < 46; i++) {
      const side = i % 2 ? 1 : -1,
        x = side * (10 + this.random(i) * 15),
        z = this.random(i + 55) * 110 - 14;
      if (i % 3 === 0) {
        this.box("barrier", 1.5, 0.7, 2.4, "#535c4b", x, 0.2, z);
        this.box("barrier stripe", 1.55, 0.16, 2.45, "#b6b797", x, 0.5, z);
      } else {
        const h = 1 + this.random(i + 3) * 3;
        this.box("trunk", 0.3, h, 0.3, "#5e5d43", x, h / 2, z);
        const tree = MeshBuilder.CreateCylinder(
          "tree",
          {
            diameterTop: 0,
            diameterBottom: 2.5 + this.random(i),
            height: h * 1.6,
            tessellation: 5,
          },
          this.scene,
        );
        tree.position.set(x, h + 1, z);
        tree.material = this.mat(i % 2 ? "#67794c" : "#506d45");
      }
    }
    this.tank = this.makeTank(false);
    this.tank.setEnabled(false);
  }
  random(i: number) {
    const n = Math.sin(i * 127.1 + 311.7) * 43758.5453;
    return n - Math.floor(n);
  }
  mat(color: string, glow = false) {
    const key = color + glow;
    if (this.materials.has(key)) return this.materials.get(key)!;
    const m = new StandardMaterial(key, this.scene);
    m.diffuseColor = Color3.FromHexString(color);
    m.specularColor = Color3.Black();
    if (glow) m.emissiveColor = Color3.FromHexString(color).scale(0.6);
    this.materials.set(key, m);
    return m;
  }
  box(
    name: string,
    w: number,
    h: number,
    d: number,
    color: string,
    x = 0,
    y = 0,
    z = 0,
    parent?: TransformNode,
  ) {
    const m = MeshBuilder.CreateBox(
      name,
      { width: w, height: h, depth: d },
      this.scene,
    );
    m.material = this.mat(color);
    m.position.set(x, y, z);
    if (parent) m.parent = parent;
    return m;
  }
  unit(color: string, big = false): Unit {
    const root = new TransformNode("unit", this.scene),
      parts: Mesh[] = [];
    const specs: [number, number, number, string, number, number, number][] = [
      [0.5, 0.6, 0.32, color, 0, 0.85, 0],
      [0.42, 0.35, 0.4, big ? "#454950" : "#d9bd91", 0, 1.32, 0],
      [0.52, 0.17, 0.46, color, 0, 1.5, 0],
      [0.18, 0.5, 0.2, "#303a32", -0.16, 0.3, 0],
      [0.18, 0.5, 0.2, "#303a32", 0.16, 0.3, 0],
      [0.14, 0.15, 0.75, "#252f2c", 0.28, 1, 0.35],
    ];
    for (const [w, h, d, c, x, y, z] of specs) {
      const key = [w, h, d, c].join(":");
      let source = this.templates.get(key);
      if (!source) {
        source = this.box("template", w, h, d, c);
        source.isVisible = false;
        this.templates.set(key, source);
      }
      const part = source.createInstance("soldier");
      part.parent = root;
      part.position.set(x, y, z);
      parts.push(part as unknown as Mesh);
    }
    // Soft ground contact, shared geometry across all units.
    const key = "shadow";
    let shadow = this.templates.get(key);
    if (!shadow) {
      shadow = MeshBuilder.CreateDisc(
        "contact",
        { radius: 0.48, tessellation: 12 },
        this.scene,
      );
      shadow.rotation.x = Math.PI / 2;
      const mat = this.mat("#243627");
      mat.alpha = 0.24;
      shadow.material = mat;
      shadow.isVisible = false;
      this.templates.set(key, shadow);
    }
    const s = shadow.createInstance("shadow");
    s.parent = root;
    s.rotation.x = Math.PI / 2;
    s.position.y = 0.025;
    parts.push(s as unknown as Mesh);
    return { root, parts };
  }
  makeTank(enemy: boolean) {
    const root = new TransformNode("tank", this.scene);
    const color = enemy ? "#834c40" : "#8a9d56";
    this.box("hull", 2.6, 0.8, 3.1, color, 0, 0.8, 0, root);
    for (const x of [-1.4, 1.4]) {
      this.box("track", 0.55, 0.7, 3.6, "#28332e", x, 0.4, 0, root);
      for (let z = -1.2; z <= 1.3; z += 0.6)
        this.box("wheel", 0.6, 0.25, 0.35, "#444b3e", x, 0.35, z, root);
    }
    this.box("turret", 1.7, 0.7, 1.7, color, 0, 1.5, 0, root);
    this.box("barrel", 0.25, 0.25, 2.5, "#343f32", 0, 1.55, 1.7, root);
    this.box("hatch", 0.7, 0.18, 0.7, "#b2ba83", 0, 1.95, -0.2, root);
    return root;
  }
  gate(g: WorldGate) {
    const root = new TransformNode("gate row", this.scene);
    for (let i = 0; i < 2; i++) {
      const def = i ? g.right : g.left;
      const bad = ["subtract", "divide"].includes(def.effect),
        c = bad ? "#ee8064" : "#c8fa78",
        x = i ? 3.55 : -3.55;
      for (const dx of [-3.25, 3.25]) {
        this.box("gate post", 0.2, 3.1, 0.25, c, x + dx, 1.55, 0, root);
      }
      this.box("gate beam", 6.7, 0.18, 0.25, c, x, 3.1, 0, root);
      const pane = MeshBuilder.CreatePlane(
        "gate panel",
        { width: 6.25, height: 2.5, sideOrientation: Mesh.DOUBLESIDE },
        this.scene,
      );
      pane.parent = root;
      pane.position.set(x, 1.8, 0);
      const tex = new DynamicTexture(
        "gate label",
        { width: 512, height: 256 },
        this.scene,
        false,
      );
      const ctx = tex.getContext() as CanvasRenderingContext2D;
      ctx.fillStyle = bad ? "rgba(98,34,30,.65)" : "rgba(34,68,35,.65)";
      ctx.fillRect(0, 0, 512, 256);
      ctx.fillStyle = c;
      ctx.textAlign = "center";
      ctx.font = `bold ${def.label.length > 7 ? 42 : 88}px sans-serif`;
      ctx.fillText(def.label, 256, 145);
      ctx.font = "22px sans-serif";
      ctx.fillText(this.gateCaption(def), 256, 205);
      tex.update();
      const m = new StandardMaterial("gate", this.scene);
      m.diffuseTexture = tex;
      m.emissiveTexture = tex;
      m.useAlphaFromDiffuseTexture = true;
      m.backFaceCulling = false;
      pane.material = m;
    }
    return root;
  }
  gateCaption(g: Gate) {
    return g.effect === "weapon"
      ? "WEAPON UPGRADE"
      : g.effect === "tank"
        ? "TEMPORARY SUPPORT"
        : g.effect === "heal"
          ? "RESTORE ARMOR"
          : ["divide", "subtract"].includes(g.effect)
            ? "SQUAD PENALTY"
            : "REINFORCEMENTS";
  }
  update(sim: Simulation, dt: number, active: boolean) {
    this.t += dt;
    const colorIndex = Math.floor((sim.level.id - 1) / 10);
    if (this.region !== colorIndex) {
      this.region = colorIndex;
      this.scene.getMeshByName("terrain")!.material = this.mat(
        palettes[colorIndex][0],
      );
    }
    const count = sim.squad;
    while (this.units.length < count) this.units.push(this.unit("#729e75"));
    this.units.forEach((u, i) => {
      u.root.setEnabled(i < count && sim.tank <= 0);
      const cols = Math.min(6, Math.ceil(Math.sqrt(count * 1.5)));
      u.root.position.set(
        (active ? sim.x : 0) + ((i % cols) - (cols - 1) / 2) * 0.72,
        Math.sin(this.t * 12 + i) * 0.035,
        -Math.floor(i / cols) * 0.75,
      );
      u.parts[3].rotation.x = Math.sin(this.t * 12 + i) * 0.3;
      u.parts[4].rotation.x = -Math.sin(this.t * 12 + i) * 0.3;
    });
    this.tank.setEnabled(active && sim.tank > 0);
    this.tank.position.x = sim.x;
    const ids = new Set(sim.enemies.map((e) => e.id));
    for (const [id, u] of this.enemies)
      if (!ids.has(id)) {
        this.burst(u.root.position.x, u.root.position.z, "#e9be75");
        u.root.dispose();
        this.enemies.delete(id);
      }
    for (const e of sim.enemies) {
      let u = this.enemies.get(e.id);
      if (!u) {
        u =
          e.type === "boss"
            ? { root: this.makeTank(true), parts: [] }
            : this.unit(
                e.type === "armor" ? "#726e7f" : "#af6153",
                e.type === "armor",
              );
        if (e.type === "armor") u.root.scaling.setAll(1.25);
        if (e.type === "boss") u.root.scaling.setAll(1.5);
        u.root.rotation.y = Math.PI;
        this.enemies.set(e.id, u);
      }
      u.root.position.set(
        e.x,
        e.type === "boss" ? 0 : Math.sin(this.t * 10 + e.id) * 0.03,
        e.z,
      );
    }
    const gids = new Set(sim.gates.map((g) => g.id));
    for (const [id, node] of this.gates)
      if (!gids.has(id)) {
        for (const mesh of node.getChildMeshes()) {
          const material = mesh.material;
          if (material?.name === "gate") material.dispose(false, true);
        }
        node.dispose();
        this.gates.delete(id);
      }
    for (const g of sim.gates) {
      let root = this.gates.get(g.id);
      if (!root) {
        root = this.gate(g);
        this.gates.set(g.id, root);
      }
      root.position.z = g.z;
      root.setEnabled(!g.resolved);
    }
    if (active) {
      for (const shot of sim.shots) {
        const length = Math.hypot(shot.targetX - shot.x, shot.targetZ - shot.z);
        const mesh = this.box(
          "tracer",
          shot.rocket ? 0.09 : 0.035,
          0.035,
          length,
          shot.rocket ? "#ffbf65" : "#f7edac",
          (shot.x + shot.targetX) / 2,
          1.05,
          (shot.z + shot.targetZ) / 2,
        );
        mesh.rotation.y = Math.atan2(
          shot.targetX - shot.x,
          shot.targetZ - shot.z,
        );
        mesh.material = this.mat(shot.rocket ? "#ffbf65" : "#f7edac", true);
        this.flashes.push({ mesh, life: 0.065 });
      }
      sim.shots = [];
      for (const m of this.road) {
        m.position.z -= dt * 6;
        if (m.position.z < -18) m.position.z += 112;
      }
    }
    for (const f of this.flashes) {
      f.life -= dt;
      if (f.mesh.name === "burst") {
        f.mesh.scaling.scaleInPlace(1 + dt * 9);
        f.mesh.position.y += dt * 2;
      }
      if (f.life <= 0) f.mesh.dispose();
    }
    this.flashes = this.flashes.filter((f) => f.life > 0);
    this.scene.render();
  }
  burst(x: number, z: number, color: string) {
    const m = MeshBuilder.CreatePolyhedron(
      "burst",
      { type: 1, size: 0.5 },
      this.scene,
    );
    m.position.set(x, 0.8, z);
    m.material = this.mat(color, true);
    this.flashes.push({ mesh: m, life: 0.22 });
  }
  resize() {
    this.engine.resize();
    const aspect = this.engine.getRenderWidth() / this.engine.getRenderHeight();
    this.camera.setTarget(
      new Vector3(0, 0, Math.max(4, Math.min(12, 12 - (aspect - 0.6) * 8))),
    );
  }
}
