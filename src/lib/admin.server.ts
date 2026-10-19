import archiveStats from "@/data/archive-stats.json";
import { isAdminEmail } from "@/lib/admin-email";
import { getSql } from "@/lib/db";
import { clientIp, locateIp } from "@/lib/geo.server";
import type { HitKey } from "@/lib/hits";

export type ArchiveStats = typeof archiveStats;

export type TrafficPin = {
  ip: string;
  hits: number;
  lat: number | null;
  lng: number | null;
  place: string | null;
};

export async function bumpHit(key: HitKey) {
  const sql = await getSql();
  await sql`insert into page_stat (key, hits) values (${key}, 1)
    on conflict (key) do update set hits = page_stat.hits + 1, updated_at = now()`;

  const ip = clientIp();
  if (!ip) return;
  const existing = await sql<{ lat: number | null }>`select lat from traffic_pin where ip = ${ip}`;
  if (existing.length > 0) {
    await sql`update traffic_pin set hits = hits + 1, updated_at = now() where ip = ${ip}`;
    return;
  }
  const geo = await locateIp(ip);
  await sql`insert into traffic_pin (ip, hits, lat, lng, place)
    values (${ip}, 1, ${geo?.lat ?? null}, ${geo?.lng ?? null}, ${geo?.place ?? null})
    on conflict (ip) do update set hits = traffic_pin.hits + 1, updated_at = now()`;
}

export async function loadAdminDashboard(userId: string) {
  const sql = await getSql();
  const users = await sql<{ email: string }>`select email from "user" where id = ${userId}`;
  const email = users[0]?.email ?? "";
  if (!isAdminEmail(email)) {
    throw new Error("Forbidden");
  }
  const traffic = await sql<{ key: string; hits: number }>`select key, hits from page_stat order by key`;
  const pins = await sql<TrafficPin>`
    select ip, hits, lat, lng, place from traffic_pin order by hits desc, updated_at desc limit 400
  `;
  return {
    email,
    traffic,
    pins,
    archive: archiveStats,
  };
}
