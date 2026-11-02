export type GateEffect =
  "add" | "multiply" | "subtract" | "divide" | "weapon" | "tank" | "heal";
export interface Gate {
  effect: GateEffect;
  value: number;
  label: string;
}
export interface GateRow {
  at: number;
  left: Gate;
  right: Gate;
}
export interface Level {
  id: number;
  name: string;
  region: string;
  duration: number;
  difficulty: number;
  reward: number;
  rows: GateRow[];
  boss: boolean;
}
const regions = [
  "OUTSKIRTS",
  "OCCUPIED CITY",
  "IRONWORKS",
  "DUST CONVOY",
  "THE CITADEL",
];
const names = [
  "First contact",
  "Strength in numbers",
  "Heavy metal",
  "Crossfire",
  "Checkpoint",
  "No easy road",
  "Reinforcements",
  "Breach protocol",
  "Final approach",
  "Sector guardian",
];
const gate = (effect: GateEffect, value: number, label: string): Gate => ({
  effect,
  value,
  label,
});
export const levels: Level[] = Array.from({ length: 50 }, (_, i) => {
  const id = i + 1,
    region = Math.floor(i / 10),
    stage = i % 10;
  const rows: GateRow[] = [
    {
      at: 7,
      left: gate("add", 6 + region * 2, "+ " + (6 + region * 2)),
      right: gate("subtract", 3, "− 3"),
    },
    {
      at: 19,
      left: gate("divide", 2, "÷ 2"),
      right: gate("weapon", 1, "RAPID FIRE"),
    },
    {
      at: 32,
      left: gate("multiply", 2, "× 2"),
      right: gate("add", 10, "+ 10"),
    },
    {
      at: 46,
      left: gate("weapon", 2, "ROCKETS"),
      right: gate("subtract", 8, "− 8"),
    },
    {
      at: 59,
      left: gate("subtract", 12, "− 12"),
      right: gate("tank", 12, "TANK · 12s"),
    },
    {
      at: 76,
      left: gate("heal", 1, "REPAIR"),
      right: gate("multiply", 2, "× 2"),
    },
  ];
  // Rotate choices and remix timings after the introductory mission.
  if (i > 0)
    rows.forEach((r, j) => {
      if ((i + j) % 2) [r.left, r.right] = [r.right, r.left];
      r.at += stage * 0.4;
    });
  return {
    id,
    name:
      region === 0
        ? names[stage]
        : `${["Urban", "Foundry", "Convoy", "Citadel"][region - 1]} ${names[stage].toLowerCase()}`,
    region: regions[region],
    duration: 96 + region * 8,
    difficulty: 1 + i * 0.065,
    reward: 100 + i * 15,
    rows,
    boss: stage === 9 || id <= 3,
  };
});
export const weaponNames = ["ASSAULT RIFLE", "RAPID FIRE", "ROCKET LAUNCHER"];
export const MAX_SQUAD = 48;
export function applyGate(count: number, g: Gate): number {
  if (g.effect === "add") return Math.min(MAX_SQUAD, count + g.value);
  if (g.effect === "multiply") return Math.min(MAX_SQUAD, count * g.value);
  if (g.effect === "subtract") return Math.max(0, count - g.value);
  if (g.effect === "divide") return Math.floor(count / g.value);
  return count;
}
