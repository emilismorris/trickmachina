import { recordHit } from "@/lib/admin.functions";
import type { HitKey } from "@/lib/hits";

const seen = new Set<string>();

export function track(key: HitKey, token: string = key) {
  const id = `${key}:${token}`;
  if (seen.has(id)) return;
  seen.add(id);
  void recordHit({ data: key }).catch(() => {});
}
