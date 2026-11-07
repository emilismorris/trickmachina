import { readFile } from "node:fs/promises";
import dead from "@/data/dead.json";
import type { Catalog, Film } from "@/data/types";
import { filmIdFromSlug, filmSlug } from "@/lib/film-slug";

const DISCIPLINES = ["skate", "bmx", "blades", "scoot"] as const;
type Discipline = (typeof DISCIPLINES)[number];

const cache = new Map<Discipline, Catalog>();
const deadIds = dead as Record<string, string[]>;

async function catalog(discipline: Discipline) {
  const hit = cache.get(discipline);
  if (hit) return hit;
  const raw = await readFile(new URL(`../../public/catalogs/${discipline}.json`, import.meta.url), "utf8");
  const parsed = JSON.parse(raw) as Catalog;
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
