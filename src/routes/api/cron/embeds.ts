import { readFile } from "node:fs/promises";
import { createFileRoute } from "@tanstack/react-router";

const DISCIPLINES = ["skate", "bmx", "blades", "scoot"] as const;

async function thumbStatus(id: string) {
  const response = await fetch(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(8000) });
  return response.status;
}

export const Route = createFileRoute("/api/cron/embeds")({
  server: {
    handlers: {
      GET: async () => {
        const week = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
        const batch: { discipline: string; id: string; title: string; company: string; year: number; videoId: string }[] = [];
        for (const discipline of DISCIPLINES) {
          const raw = await readFile(new URL(`../../../../public/catalogs/${discipline}.json`, import.meta.url), "utf8");
          const catalog = JSON.parse(raw) as { films: Record<string, { id: string; title: string; company: string; year: number; watch: { host: string; id?: string; parts?: { id: string }[] } }> };
          for (const film of Object.values(catalog.films)) {
            const videoId = film.watch.host === "youtube" ? film.watch.id : film.watch.host === "parts" ? film.watch.parts?.[0]?.id : "";
            if (!videoId) continue;
            batch.push({ discipline, id: film.id, title: film.title, company: film.company, year: film.year, videoId });
          }
        }
        const size = 40;
        const start = (week * size) % Math.max(1, batch.length);
        const slice = batch.slice(start, start + size);
        const broken = [];
        for (const entry of slice) {
          try {
            const code = await thumbStatus(entry.videoId);
            if (code === 404) broken.push({ ...entry, bad_url: `https://www.youtube.com/watch?v=${entry.videoId}`, note: "unavailable" });
          } catch {
            /* leave it for the next week */
          }
        }
        return Response.json({ checked: slice.length, broken });
      },
    },
  },
});
