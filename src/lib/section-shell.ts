import { createServerFn } from "@tanstack/react-start";
import type { Catalog } from "@/data/types";

const DISCIPLINES = ["skate", "bmx", "blades", "scoot"] as const;
type Discipline = (typeof DISCIPLINES)[number];

const shells: Record<Discipline, () => Promise<{ default: Catalog }>> = {
  skate: () => import("@/data/shells/skate.json") as Promise<{ default: Catalog }>,
  bmx: () => import("@/data/shells/bmx.json") as Promise<{ default: Catalog }>,
  blades: () => import("@/data/shells/blades.json") as Promise<{ default: Catalog }>,
  scoot: () => import("@/data/shells/scoot.json") as Promise<{ default: Catalog }>,
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
