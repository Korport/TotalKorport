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
  id: number;
  y: number;
  targetId?: number;
  damage: number;
  speed: number;
  radius: number;
  age: number;
  x: number;
  z: number;
  targetX: number;
  targetZ: number;
  rocket: boolean;
}
export interface Explosion {
  id: number;
  x: number;
  z: number;
  radius: number;
  life: number;
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
  explosions: Explosion[] = [];
  fired = false;
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
    this.explosions = [];
    this.fired = false;
    this.row = 0;
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
    const n =
      2 +
      Math.floor(this.level.difficulty * 1.3) +
      (this.level.id <= 10 ? 1 : 0);
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
  private advanceShots(dt: number) {
    this.shots = this.shots.filter((shot) => {
      shot.age += dt;
      const target = this.enemies.find(
        (e) => e.id === shot.targetId && e.hp > 0,
      );
      if (target) {
        shot.targetX = target.x;
        shot.targetZ = target.z;
      }
      const dx = shot.targetX - shot.x,
        dz = shot.targetZ - shot.z;
      const distance = Math.hypot(dx, dz);
      const travel = Math.min(distance, shot.speed * dt);
      const vx = distance ? (dx / distance) * travel : 0;
      const vz = distance ? (dz / distance) * travel : 0;
      // Sweep the entire movement segment so fast bullets cannot skip an enemy.
      const hits = this.enemies
        .filter((e) => e.hp > 0 && e.z > 0)
        .map((enemy) => {
          const t = travel
            ? Math.max(
                0,
                Math.min(
                  1,
                  ((enemy.x - shot.x) * vx + (enemy.z - shot.z) * vz) /
                    (travel * travel),
                ),
              )
            : 0;
          return {
            enemy,
            t,
            distance: Math.hypot(
              enemy.x - shot.x - vx * t,
              enemy.z - shot.z - vz * t,
            ),
          };
        })
        .filter(
          (hit) => hit.distance < (hit.enemy.type === "boss" ? 1.7 : 0.45),
        )
        .sort((a, b) => a.t - b.t);
      const hit = hits[0];
      if (hit) {
        const x = shot.x + vx * hit.t,
          z = shot.z + vz * hit.t;
        hit.enemy.hp -= shot.damage;
        if (shot.rocket) {
          this.explosions.push({
            id: ++this.serial,
            x,
            z,
            radius: shot.radius,
            life: 0.3,
          });
          for (const enemy of this.enemies)
            if (
              enemy !== hit.enemy &&
              enemy.hp > 0 &&
              Math.hypot(enemy.x - x, enemy.z - z) <= shot.radius
            )
              enemy.hp -= shot.damage * 0.55;
        }
        return false;
      }
      shot.x += vx;
      shot.z += vz;
      return shot.age < 4 && distance > travel && shot.z < 40;
    });
  }
  step(dt: number) {
    if (this.status !== "running") return;
    dt = Math.min(dt, 0.05);
    this.time += dt;
    this.fired = false;
    for (const blast of this.explosions) blast.life -= dt;
    this.explosions = this.explosions.filter((blast) => blast.life > 0);
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
        this.time +
        Math.max(
          2.8,
          5.8 - this.level.difficulty * 0.3 - (this.level.id <= 5 ? 0.7 : 0),
        );
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
    const rocket = this.weapon === 2 || this.tank > 0;
    const fireInterval =
      this.tank > 0 ? 0.9 : rocket ? 0.75 : this.weapon === 1 ? 0.13 : 0.25;
    if (this.time >= this.nextShot) {
      this.nextShot = this.time + fireInterval;
      this.fired = true;
      const range = this.tank > 0 ? 12 : rocket ? 5 : 2.2;
      const target = this.enemies
        .filter((e) => e.hp > 0 && e.z > 0 && Math.abs(e.x - this.x) < range)
        .sort((a, b) => a.z - b.z)[0];
      const damage =
        this.tank > 0
          ? 65
          : (rocket ? 7.2 : 1.2) * Math.sqrt(this.squad) * this.damage;
      const origins = this.tank > 0 ? 1 : this.squad;
      const cols = Math.min(6, Math.ceil(Math.sqrt(this.squad * 1.5)));
      for (let i = 0; i < origins; i++) {
        // Match each projectile to its soldier's muzzle in the rendered formation.
        const x =
          this.tank > 0
            ? this.x
            : this.x + ((i % cols) - (cols - 1) / 2) * 0.72 + 0.28;
        const z = this.tank > 0 ? 2.95 : -Math.floor(i / cols) * 0.75 + 0.73;
        this.shots.push({
          id: ++this.serial,
          y: this.tank > 0 ? 1.55 : 1.05,
          x,
          z,
          targetId: target?.id,
          targetX: target?.x ?? x,
          targetZ: target?.z ?? 40,
          rocket,
          damage: damage / origins,
          speed: rocket ? 22 : 42,
          radius: this.tank > 0 ? 3.8 : rocket ? 2.6 : 0,
          age: 0,
        });
      }
    }
    this.advanceShots(dt);
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
