import {
  applyGate,
  levels,
  MAX_SQUAD,
  type Level,
  type Gate,
} from "./campaign";
import type { Progress } from "./progress";
export interface Enemy {
  id: number;
  x: number;
  z: number;
  hp: number;
  maxHp: number;
  type: "grunt" | "armor" | "boss";
  speed: number;
  attack: number;
}
export interface WorldGate {
  id: number;
  z: number;
  left: Gate;
  right: Gate;
  resolved: boolean;
}
export interface Shot {
  x: number;
  z: number;
  targetX: number;
  targetZ: number;
  rocket: boolean;
}
export class Simulation {
  level: Level = levels[0];
  time = 0;
  x = 0;
  targetX = 0;
  squad = 5;
  hp = 100;
  maxHp = 100;
  weapon = 0;
  tank = 0;
  kills = 0;
  damage = 1;
  enemies: Enemy[] = [];
  gates: WorldGate[] = [];
  shots: Shot[] = [];
  status: "idle" | "running" | "won" | "lost" = "idle";
  message = "";
  messageUntil = 0;
  bossSpawned = false;
  private nextWave = 3;
  private nextShot = 0;
  private row = 0;
  private serial = 0;
  private armor = 0;
  start(level: Level, p: Progress) {
    this.level = level;
    this.time = 0;
    this.x = 0;
    this.targetX = 0;
    this.squad = 5 + p.upgrades.recruits * 2;
    this.maxHp = 100 + p.upgrades.armor * 25;
    this.hp = this.maxHp;
    this.damage = 1 + p.upgrades.damage * 0.18;
    this.armor = p.upgrades.armor;
    this.weapon = 0;
    this.tank = 0;
    this.kills = 0;
    this.enemies = [];
    this.gates = [];
    this.shots = [];
    this.row = 0;
    this.serial = 0;
    this.nextWave = 3;
    this.nextShot = 0;
    this.bossSpawned = false;
    this.status = "running";
    this.message = "MOVE SIDEWAYS · FIRE IS AUTOMATIC";
    this.messageUntil = 5;
  }
  note(s: string) {
    this.message = s;
    this.messageUntil = this.time + 2.4;
  }
  takeGate(g: Gate) {
    this.squad = applyGate(this.squad, g);
    if (g.effect === "weapon") this.weapon = g.value;
    if (g.effect === "tank") this.tank = g.value;
    if (g.effect === "heal") this.hp = this.maxHp;
    this.note(g.effect === "tank" ? "ARMORED SUPPORT ONLINE" : g.label);
    if (this.squad <= 0) this.status = "lost";
  }
  spawnWave() {
    const n = 2 + Math.floor(this.level.difficulty * 1.3);
    for (let j = 0; j < n; j++) {
      const armored = this.level.id > 2 && j === 0;
      const hp = (armored ? 16 : 5) * this.level.difficulty;
      this.enemies.push({
        id: ++this.serial,
        x: Math.sin(this.serial * 2.4) * 5.4,
        z: 33 + j * 0.8,
        hp,
        maxHp: hp,
        type: armored ? "armor" : "grunt",
        speed: 2.1 + this.level.difficulty * 0.25,
        attack: 0,
      });
    }
  }
  step(dt: number) {
    if (this.status !== "running") return;
    dt = Math.min(dt, 0.05);
    this.time += dt;
    this.shots = [];
    this.x +=
      (Math.max(-5, Math.min(5, this.targetX)) - this.x) * Math.min(1, dt * 12);
    this.tank = Math.max(0, this.tank - dt);
    while (
      this.row < this.level.rows.length &&
      this.level.rows[this.row].at <= this.time
    ) {
      this.gates.push({
        id: ++this.serial,
        z: 30,
        ...this.level.rows[this.row],
        resolved: false,
      });
      this.row++;
    }
    for (const g of this.gates) {
      g.z -= 6 * dt;
      if (g.z <= 0 && !g.resolved) {
        g.resolved = true;
        this.takeGate(this.x < 0 ? g.left : g.right);
      }
    }
    this.gates = this.gates.filter((g) => g.z > -3);
    if (this.time >= this.nextWave && this.time < this.level.duration - 13) {
      this.spawnWave();
      this.nextWave =
        this.time + Math.max(2.8, 5.8 - this.level.difficulty * 0.3);
    }
    if (
      this.level.boss &&
      !this.bossSpawned &&
      this.time >= this.level.duration - 19
    ) {
      this.bossSpawned = true;
      const hp = 160 * this.level.difficulty;
      this.enemies.push({
        id: ++this.serial,
        x: 0,
        z: 30,
        hp,
        maxHp: hp,
        type: "boss",
        speed: 1.3,
        attack: 0,
      });
      this.note("HEAVY CONTACT · KEEP FIRING");
    }
    const fireInterval = this.tank > 0 ? 0.38 : this.weapon === 1 ? 0.13 : 0.25;
    if (this.time >= this.nextShot) {
      this.nextShot = this.time + fireInterval;
      const range = this.tank > 0 ? 12 : this.weapon === 2 ? 5 : 2.2;
      const targets = this.enemies
        .filter((e) => e.z > 0 && Math.abs(e.x - this.x) < range)
        .sort((a, b) => a.z - b.z);
      const target = targets[0];
      const damage =
        this.tank > 0
          ? 30
          : (this.weapon === 2 ? 2.6 : 1.2) *
            Math.sqrt(this.squad) *
            this.damage;
      const origins = Math.min(this.squad, 8);
      for (let i = 0; i < origins; i++)
        this.shots.push({
          x: this.x + (i - (origins - 1) / 2) * 0.45,
          z: 1,
          targetX: target?.x ?? this.x + (i - (origins - 1) / 2) * 0.45,
          targetZ: target?.z ?? 34,
          rocket: this.weapon === 2 || this.tank > 0,
        });
      if (target) {
        target.hp -= damage;
        if (this.weapon === 2 || this.tank > 0)
          for (const e of this.enemies)
            if (
              e !== target &&
              Math.hypot(e.x - target.x, e.z - target.z) < 3.8
            )
              e.hp -= damage * 0.55;
      }
    }
    for (const e of this.enemies) {
      if (e.hp <= 0) {
        this.kills++;
        continue;
      }
      e.z -= e.speed * dt;
      if (e.z < 18 && e.type !== "boss")
        e.x +=
          Math.sign(this.x - e.x) * Math.min(Math.abs(this.x - e.x), dt * 0.95);
      if (e.type === "boss" && e.z < 8) {
        e.z = 8;
        e.attack += dt;
        if (e.attack > 1.4) {
          e.attack = 0;
          this.hp -= Math.max(2, 9 - this.armor) * (this.tank > 0 ? 0.2 : 1);
          this.note("INCOMING FIRE · DESTROY THE WALKER");
        }
      } else if (e.z <= 0) {
        this.hp -= e.type === "armor" ? 18 : 9;
        if (this.tank <= 0)
          this.squad = Math.max(0, this.squad - (e.type === "armor" ? 2 : 1));
        e.hp = 0;
        this.note("SQUAD HIT");
      }
    }
    this.enemies = this.enemies.filter((e) => e.hp > 0);
    if (this.hp <= 0 || this.squad <= 0) {
      this.hp = Math.max(0, this.hp);
      this.status = "lost";
    } else if (this.time >= this.level.duration && this.enemies.length === 0)
      this.status = "won";
    this.squad = Math.min(MAX_SQUAD, this.squad);
  }
}
