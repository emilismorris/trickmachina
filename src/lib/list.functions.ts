import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";

const DISCIPLINES = new Set(["skate", "bmx", "blades", "scoot"]);

export type SavedFilm = {
  discipline: string;
  filmId: string;
  title: string;
  year: number;
  company: string;
  thumb: string;
};

type ToggleInput = SavedFilm & { on: boolean };

function saved(input: unknown): ToggleInput {
  if (!input || typeof input !== "object") throw new Error("Check the film");
  const row = input as Partial<ToggleInput>;
  const discipline = typeof row.discipline === "string" ? row.discipline : "";
  const filmId = typeof row.filmId === "string" ? row.filmId.trim().slice(0, 160) : "";
  const title = typeof row.title === "string" ? row.title.trim().slice(0, 200) : "";
  if (!DISCIPLINES.has(discipline) || !filmId || !title) throw new Error("Check the film");
  return {
    on: row.on === true,
    discipline,
    filmId,
    title,
    year: typeof row.year === "number" && Number.isFinite(row.year) ? Math.trunc(row.year) : 0,
    company: typeof row.company === "string" ? row.company.trim().slice(0, 120) : "",
    thumb: typeof row.thumb === "string" && row.thumb.startsWith("/") ? row.thumb.slice(0, 240) : "",
  };
}

export const listFavorites = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<SavedFilm[]> => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql<SavedFilm>`
      select discipline, film_id as "filmId", title, year, company, thumb
      from favorite
      where user_id = ${context.userId}
      order by created_at desc
      limit 80
    `;
    return rows;
  });

export const toggleFavorite = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(saved)
  .handler(async ({ data, context }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    if (!data.on) {
      await sql`delete from favorite where user_id = ${context.userId} and discipline = ${data.discipline} and film_id = ${data.filmId}`;
      return { ok: true as const };
    }
    const count = await sql<{ n: number }>`select count(*) as n from favorite where user_id = ${context.userId}`;
    if ((count[0]?.n ?? 0) >= 80) throw new Error("The list is full");
    await sql`
      insert into favorite (user_id, discipline, film_id, title, year, company, thumb)
      values (${context.userId}, ${data.discipline}, ${data.filmId}, ${data.title}, ${data.year}, ${data.company}, ${data.thumb})
      on conflict (user_id, discipline, film_id) do update
      set title = excluded.title, year = excluded.year, company = excluded.company, thumb = excluded.thumb
    `;
    return { ok: true as const };
  });
