import { describe, it, expect } from "vitest";
import { applyGate, levels, MAX_SQUAD } from "../src/campaign";
import {
  freshProgress,
  parseProgress,
  purchase,
  complete,
} from "../src/progress";
import { Simulation } from "../src/simulation";
describe("gates and campaign", () => {
  it("caps growth, rounds division down, and allows fatal penalties", () => {
    expect(applyGate(30, { effect: "multiply", value: 2, label: "" })).toBe(
      MAX_SQUAD,
    );
    expect(applyGate(5, { effect: "divide", value: 2, label: "" })).toBe(2);
    expect(applyGate(3, { effect: "subtract", value: 8, label: "" })).toBe(0);
  });
  it("defines all 50 missions with valid, reachable gate timings", () => {
    expect(levels).toHaveLength(50);
    expect(new Set(levels.map((l) => l.id)).size).toBe(50);
    for (const l of levels) {
      expect(
        l.rows.every(
          (r, i) => r.at + 5 < l.duration && (!i || r.at > l.rows[i - 1].at),
        ),
      ).toBe(true);
    }
  });
});
describe("progression", () => {
  it("recovers malformed saves and rejects invalid balances and ranks", () => {
    for (const s of [
      "bad",
      "null",
      JSON.stringify({ ...freshProgress(), credits: -1 }),
      JSON.stringify({ ...freshProgress(), upgrades: { damage: 99 } }),
    ])
      expect(parseProgress(s)).toEqual(freshProgress());
  });
  it("retains only valid star entries and round trips a save", () => {
    const p = freshProgress();
    p.stars = { "1": 3 };
    expect(parseProgress(JSON.stringify(p))).toEqual(p);
    expect(
      parseProgress(
        JSON.stringify({ ...p, stars: { "1": 3, "99": 3, "2": 9 } }),
      ).stars,
    ).toEqual({ "1": 3 });
  });
  it("charges upgrades once, refuses insufficient funds and caps ranks", () => {
    const p = freshProgress();
    expect(purchase(p, "recruits")).toBe(false);
    p.credits = 10000;
    for (let i = 0; i < 5; i++) expect(purchase(p, "recruits")).toBe(true);
    const balance = p.credits;
    expect(purchase(p, "recruits")).toBe(false);
    expect(p.credits).toBe(balance);
    expect(p.upgrades.recruits).toBe(5);
  });
  it("unlocks the next mission, preserves best stars and reduces repeat rewards", () => {
    const p = freshProgress();
    expect(complete(p, 1, 3, 100)).toBe(100);
    expect(complete(p, 1, 1, 100)).toBe(25);
    expect(p.unlocked).toBe(2);
    expect(p.stars[1]).toBe(3);
    complete(p, 50, 2, 800);
    expect(p.unlocked).toBe(50);
  });
});
describe("combat", () => {
  it("resolves a gate once and resets temporary state on retry", () => {
    const s = new Simulation();
    s.start(levels[0], freshProgress());
    s.gates.push({
      id: 99,
      z: 0.01,
      left: { effect: "add", value: 5, label: "+5" },
      right: { effect: "subtract", value: 3, label: "-3" },
      resolved: false,
    });
    s.x = -2;
    s.targetX = -2;
    s.step(0.05);
    expect(s.squad).toBe(10);
    s.step(0.05);
    expect(s.squad).toBe(10);
    s.tank = 10;
    s.weapon = 2;
    s.start(levels[0], freshProgress());
    expect(s.tank).toBe(0);
    expect(s.weapon).toBe(0);
    expect(s.gates).toHaveLength(0);
  });
  it("ends on lethal penalties and refuses to advance an ended run", () => {
    const s = new Simulation();
    s.start(levels[0], freshProgress());
    s.takeGate({ effect: "subtract", value: 100, label: "−100" });
    expect(s.status).toBe("lost");
    s.step(0.05);
    expect(s.time).toBe(0);
  });
  it("can win the introductory mission through gameplay with no upgrades", () => {
    const s = new Simulation();
    s.start(levels[0], freshProgress());
    for (let i = 0; i < 5000 && s.status === "running"; i++) {
      const gate = s.gates.find((g) => !g.resolved);
      if (gate) {
        const bad = (effect: string) => ["divide", "subtract"].includes(effect);
        s.targetX = bad(gate.left.effect)
          ? 3.2
          : bad(gate.right.effect)
            ? -3.2
            : gate.left.effect === "multiply"
              ? -3.2
              : 3.2;
      } else {
        const e = [...s.enemies].sort((a, b) => a.z - b.z)[0];
        s.targetX = e?.x ?? 0;
      }
      s.step(0.05);
    }
    expect(s.status).toBe("won");
    expect(s.kills).toBeGreaterThan(10);
  });
  it("applies upgrades and temporary armor support, then expires the support", () => {
    const s = new Simulation(),
      p = freshProgress();
    p.upgrades = { armor: 2, damage: 2, recruits: 2 };
    s.start(levels[0], p);
    expect(s.squad).toBe(9);
    expect(s.hp).toBe(150);
    expect(s.damage).toBeCloseTo(1.36);
    s.takeGate({ effect: "tank", value: 1, label: "" });
    for (let i = 0; i < 21; i++) s.step(0.05);
    expect(s.tank).toBe(0);
  });
});

describe("individual bullets and splash impacts", () => {
  function combat(weapon = 0, tank = 0) {
    const s = new Simulation();
    s.start({ ...levels[0], rows: [], boss: false }, freshProgress());
    s.weapon = weapon;
    s.tank = tank;
    s.enemies = [
      {
        id: 1000,
        x: 0,
        z: 8,
        hp: 200,
        maxHp: 200,
        type: "grunt",
        speed: 0,
        attack: 0,
      },
    ];
    return s;
  }
  it("keeps separate bullets in flight and applies damage only on collision", () => {
    const s = combat();
    s.step(0.05);
    expect(s.shots).toHaveLength(5);
    expect(new Set(s.shots.map((shot) => shot.id)).size).toBe(5);
    expect(s.enemies[0].hp).toBe(200);
    const z = s.shots[0].z;
    s.step(0.05);
    expect(s.shots[0].z).toBeGreaterThan(z);
    expect(s.enemies[0].hp).toBe(200);
    for (let i = 0; i < 4; i++) s.step(0.05);
    expect(s.enemies[0].hp).toBeLessThan(200);
    expect(s.impacts).toHaveLength(0);
  });
  it.each([
    [2, 0],
    [0, 12],
  ])(
    "fires a larger, slower heavy bullet with splash on impact (%i, %i)",
    (weapon, tank) => {
      const rifle = combat();
      rifle.step(0.05);
      const s = combat(weapon, tank);
      s.enemies.push(
        { ...s.enemies[0], id: 1001, x: 2 },
        { ...s.enemies[0], id: 1002, x: 5 },
      );
      s.step(0.05);
      expect(s.shots).toHaveLength(1);
      const shot = s.shots[0];
      expect(shot.radius).toBeGreaterThan(rifle.shots[0].radius);
      expect(shot.vz).toBeLessThan(rifle.shots[0].vz);
      expect(s.enemies.map((e) => e.hp)).toEqual([200, 200, 200]);
      for (let i = 0; i < 12 && !s.impacts.length; i++) s.step(0.05);
      expect(s.impacts).toHaveLength(1);
      expect(s.enemies[0].hp).toBeLessThan(200);
      expect(s.enemies[1].hp).toBeLessThan(200);
      expect(s.enemies[2].hp).toBe(200);
      expect(s.shots).toHaveLength(0); // No second heavy shot before its cooldown.
    },
  );
  it("detects an enemy crossed within a single simulation step", () => {
    const s = combat();
    s.enemies[0].z = 2.5;
    s.step(0.05);
    expect(s.enemies[0].hp).toBeLessThan(200);
  });
  it("starts early missions with six enemies per wave and brings the next wave sooner", () => {
    for (const level of levels.slice(0, 3)) {
      const s = new Simulation();
      s.start(level, freshProgress());
      s.spawnWave();
      expect(s.enemies).toHaveLength(6);
    }
    const s = new Simulation();
    s.start(levels[0], freshProgress());
    for (let i = 0; i < 160; i++) s.step(0.05);
    expect(s.enemies.length + s.kills).toBe(12);
  });
});
