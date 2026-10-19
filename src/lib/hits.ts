export const HIT_KEYS = ["landing", "skate", "bmx", "blades", "scoot", "play", "search"] as const;

export type HitKey = (typeof HIT_KEYS)[number];

export function isHitKey(value: string): value is HitKey {
  return (HIT_KEYS as readonly string[]).includes(value);
}
