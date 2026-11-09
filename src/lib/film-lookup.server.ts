import { readFile } from "node:fs/promises";
import { join } from "node:path";
import dead from "@/data/dead.json";
import type { Catalog, Film } from "@/data/types";
import { filmIdFromSlug, filmSlug } from "@/lib/film-slug";

const DISCIPLINES = ["skate", "bmx", "blades", "scoot"] as const;
type Discipline = (typeof DISCIPLINES)[number];

const cache = new Map<Discipline, Catalog>();
const deadIds = dead as Record<string, string[]>;

async function catalogText(discipline: Discipline) {
  const name = `${discipline}.json`;
  const candidates = [
    join(process.cwd(), "public", "catalogs", name),
    join(process.cwd(), ".output", "public", "catalogs", name),
    join(process.cwd(), "dist", "client", "catalogs", name),
  ];
  for (const file of candidates) {
    try {
      return await readFile(file, "utf8");
    } catch {
      /* published builds serve this file over HTTP instead */
    }
  }
  const hosts = [
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
    "trickmachina.com",
  ].filter((host): host is string => Boolean(host));
  let last = "missing";
  for (const host of hosts) {
    const origin = host.startsWith("http") ? host : `https://${host}`;
    const response = await fetch(`${origin}/catalogs/${name}`);
    if (response.ok) return response.text();
    last = `${response.status}`;
  }
  throw new Error(`catalogue ${name} unavailable (${last})`);
}

async function catalog(discipline: Discipline) {
  const hit = cache.get(discipline);
  if (hit) return hit;
  const parsed = JSON.parse(await catalogText(discipline)) as Catalog;
  cache.set(discipline, parsed);
  return parsed;
}

export function isHidden(discipline: string, id: string) {
  return deadIds[discipline]?.includes(id) ?? false;
}

export async function loadFilm(discipline: string, slug: string): Promise<{ discipline: Discipline; film: Film; slug: string } | null> {
  if (!DISCIPLINES.includes(discipline as Discipline)) return null;
  const name = discipline as Discipline;
  const data = await catalog(name);
  const id = filmIdFromSlug(slug);
  const film = id ? data.films[id] : undefined;
  if (!film || film.watch.host === "none" || isHidden(name, film.id)) return null;
  if (filmSlug(film) !== slug) return null;
  return { discipline: name, film, slug };
}
