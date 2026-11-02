export interface Progress {
  version: 1;
  credits: number;
  unlocked: number;
  stars: Record<string, number>;
  upgrades: { recruits: number; damage: number; armor: number };
}
export type Upgrade = keyof Progress["upgrades"];
export const freshProgress = (): Progress => ({
  version: 1,
  credits: 0,
  unlocked: 1,
  stars: {},
  upgrades: { recruits: 0, damage: 0, armor: 0 },
});
const integer = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= min && v <= max;
export function parseProgress(raw: string | null): Progress {
  try {
    const p = JSON.parse(raw ?? "null");
    if (
      p?.version !== 1 ||
      !integer(p.credits, 0, 1e9) ||
      !integer(p.unlocked, 1, 50) ||
      !p.upgrades ||
      !p.stars ||
      typeof p.stars !== "object" ||
      Array.isArray(p.stars)
    )
      return freshProgress();
    for (const k of ["recruits", "damage", "armor"])
      if (!integer(p.upgrades[k], 0, 5)) return freshProgress();
    const stars: Record<string, number> = {};
    for (const [k, v] of Object.entries(p.stars))
      if (integer(+k, 1, 50) && integer(v, 1, 3)) stars[k] = v;
    return {
      version: 1,
      credits: p.credits,
      unlocked: p.unlocked,
      upgrades: {
        recruits: p.upgrades.recruits,
        damage: p.upgrades.damage,
        armor: p.upgrades.armor,
      },
      stars,
    };
  } catch {
    return freshProgress();
  }
}
export function upgradeCost(level: number): number {
  return 120 + level * 100;
}
export function purchase(p: Progress, key: Upgrade): boolean {
  const rank = p.upgrades[key],
    cost = upgradeCost(rank);
  if (rank >= 5 || p.credits < cost) return false;
  p.credits -= cost;
  p.upgrades[key]++;
  return true;
}
export function complete(
  p: Progress,
  level: number,
  stars: number,
  reward: number,
): number {
  const previous = p.stars[level] ?? 0;
  const earned = previous ? Math.round(reward * 0.25) : reward;
  p.stars[level] = Math.max(previous, stars);
  p.unlocked = Math.min(50, Math.max(p.unlocked, level + 1));
  p.credits += earned;
  return earned;
}
