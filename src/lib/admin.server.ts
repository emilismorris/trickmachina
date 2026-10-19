import archiveStats from "@/data/archive-stats.json";
import { isAdminEmail } from "@/lib/admin-email";
import { getSql } from "@/lib/db";
import { clientIp, locateIp } from "@/lib/geo.server";
import type { HitKey } from "@/lib/hits";
import { createHash } from "node:crypto";

type VisitBeacon = {
  path: string;
  source: string;
  device: "mobile" | "desktop" | "tablet";
  browser: string;
  language: string;
  visitor: string;
  session: string;
};

type VisitRange = "7" | "28" | "all";

export type ArchiveStats = typeof archiveStats;

export type TrafficPin = {
  ip: string;
  hits: number;
  lat: number | null;
  lng: number | null;
  place: string | null;
};

export type MetricRow = { label: string; hits: number };

export type VisitReport = {
  users: number;
  newUsers: number;
  sessions: number;
  views: number;
  events: number;
  engagement: string | null;
  importedUsers: number;
  pages: MetricRow[];
  sources: MetricRow[];
  countries: MetricRow[];
  devices: MetricRow[];
  browsers: MetricRow[];
  languages: MetricRow[];
};

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

async function addStat(kind: string, label: string) {
  const sql = await getSql();
  await sql`insert into analytics_stat (day, kind, label, hits) values (current_date, ${kind}, ${label}, 1)
    on conflict (day, kind, label) do update set hits = analytics_stat.hits + 1`;
}

export async function bumpVisit(visit: VisitBeacon) {
  const sql = await getSql();
  const visitor = digest(visit.visitor);
  const session = digest(visit.session);
  await addStat("path", visit.path);
  await addStat("source", visit.source.slice(0, 120));
  await addStat("device", visit.device);
  await addStat("browser", visit.browser);
  await addStat("language", visit.language);
  await addStat("event", "all");
  await sql`insert into analytics_visitor (day, visitor) values (current_date, ${visitor}) on conflict do nothing`;
  await sql`insert into analytics_user (visitor, first_day) values (${visitor}, current_date) on conflict do nothing`;
  await sql`insert into analytics_session (day, session) values (current_date, ${session}) on conflict do nothing`;

  const ip = clientIp();
  const geo = ip ? await locateIp(ip) : null;
  const country = geo?.place?.split(", ").at(-1)?.slice(0, 80);
  if (country) {
    await sql`update analytics_user set country = ${country} where visitor = ${visitor} and country is null`;
  }
}

export async function bumpHit(key: HitKey) {
  const sql = await getSql();
  await sql`insert into page_stat (key, hits) values (${key}, 1)
    on conflict (key) do update set hits = page_stat.hits + 1, updated_at = now()`;
  if (key === "play" || key === "search") await addStat("event", "all");

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

async function optional<T>(query: Promise<T>, fallback: T): Promise<T> {
  try {
    return await query;
  } catch (err) {
    console.error("[desk]", err);
    return fallback;
  }
}

export async function loadAdminDashboard(userId: string, range: VisitRange) {
  const sql = await getSql();
  const users = await sql<{ email: string }>`select email from "user" where id = ${userId}`;
  const email = users[0]?.email ?? "";
  if (!isAdminEmail(email)) {
    throw new Error("Forbidden");
  }
  const traffic = await optional(sql<{ key: string; hits: number }>`select key, hits from page_stat order by key`, []);
  const pins = await optional(
    sql<TrafficPin>`select ip, hits, lat, lng, place from traffic_pin order by hits desc, updated_at desc limit 400`,
    [],
  );
  const days = range === "all" ? null : Number(range);
  const since = days === null ? null : days - 1;
  const rows = async (kind: string) =>
    sql<MetricRow>`
      select label, sum(hits)::int as hits
      from analytics_stat
      where kind = ${kind} and (${since}::int is null or day >= current_date - ${since}::int)
      group by label
      order by hits desc, label
      limit 40
    `;
  const [usersRow, newRow, sessionsRow, viewsRow, eventsRow, importedRow, pages, sources, countries, devices, browsers, languages] =
    await Promise.all([
      optional(sql<{ n: number }>`select count(distinct visitor)::int as n from analytics_visitor where (${since}::int is null or day >= current_date - ${since}::int)`, []),
      optional(sql<{ n: number }>`select count(*)::int as n from analytics_user where (${since}::int is null or first_day >= current_date - ${since}::int)`, []),
      optional(sql<{ n: number }>`select count(distinct session)::int as n from analytics_session where (${since}::int is null or day >= current_date - ${since}::int)`, []),
      optional(sql<{ n: number }>`select coalesce(sum(hits), 0)::int as n from analytics_stat where kind = 'path' and (${since}::int is null or day >= current_date - ${since}::int)`, []),
      optional(sql<{ n: number }>`select coalesce(sum(hits), 0)::int as n from analytics_stat where kind = 'event' and label = 'all' and (${since}::int is null or day >= current_date - ${since}::int)`, []),
      optional(sql<{ n: number }>`select count(*)::int as n from analytics_user where visitor like 'ga:%' and (${since}::int is null or first_day >= current_date - ${since}::int)`, []),
      optional(rows("path"), []),
      optional(rows("source"), []),
      optional(
        sql<MetricRow>`
        select country as label, count(*)::int as hits
        from analytics_user
        where country is not null and (${since}::int is null or first_day >= current_date - ${since}::int)
        group by country
        order by hits desc, country
        limit 40
      `,
        [],
      ),
      optional(rows("device"), []),
      optional(rows("browser"), []),
      optional(rows("language"), []),
    ]);
  const report: VisitReport = {
    users: usersRow[0]?.n ?? 0,
    newUsers: newRow[0]?.n ?? 0,
    sessions: sessionsRow[0]?.n ?? 0,
    views: viewsRow[0]?.n ?? 0,
    events: eventsRow[0]?.n ?? 0,
    engagement: null,
    importedUsers: importedRow[0]?.n ?? 0,
    pages,
    sources,
    countries,
    devices,
    browsers,
    languages,
  };
  const notes = await optional(loadNotes(sql), { open: [], hidden: [] });
  return {
    email,
    traffic,
    pins,
    archive: archiveStats,
    range,
    report,
    notes,
  };
}

async function loadNotes(sql: Awaited<ReturnType<typeof getSql>>) {
  await sql`alter table contact_note add column if not exists archived boolean not null default false`;
  const rows = await sql<{ id: number; name: string; email: string; message: string; created_at: string; archived: boolean }>`
    select id, name, email, message, created_at::text as created_at, archived
    from contact_note
    order by id desc
    limit 400
  `;
  const open = [];
  const hidden = [];
  for (const row of rows) {
    const note = { id: row.id, name: row.name, email: row.email, message: row.message, created_at: row.created_at };
    if (row.archived) hidden.push(note);
    else open.push(note);
  }
  return { open, hidden };
}

export async function hideNotes(userId: string, ids: number[], hidden = true) {
  const sql = await getSql();
  const users = await sql<{ email: string }>`select email from "user" where id = ${userId}`;
  if (!isAdminEmail(users[0]?.email)) throw new Error("Forbidden");
  await sql`alter table contact_note add column if not exists archived boolean not null default false`;
  for (const id of ids) {
    await sql`update contact_note set archived = ${hidden} where id = ${id}`;
  }
}
