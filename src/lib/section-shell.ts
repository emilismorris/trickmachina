import { createServerFn } from "@tanstack/react-start";
import type { Catalog } from "@/data/types";

const DISCIPLINES = ["skate", "bmx", "blades", "scoot"] as const;
type Discipline = (typeof DISCIPLINES)[number];

const shells: Record<Discipline, () => Promise<{ default: Catalog }>> = {
  skate: () => import("@/data/shells/skate.json"),
  bmx: () => import("@/data/shells/bmx.json"),
  blades: () => import("@/data/shells/blades.json"),
  scoot: () => import("@/data/shells/scoot.json"),
};

export const loadSectionShell = createServerFn({ method: "GET" })
  .validator((discipline: unknown): Discipline => {
    if (typeof discipline !== "string" || !DISCIPLINES.includes(discipline as Discipline)) throw new Error("Unknown section");
    return discipline as Discipline;
  })
  .handler(async ({ data }) => {
    const mod = await shells[data]();
    return mod.default as Catalog;
  });
