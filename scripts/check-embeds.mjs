#!/usr/bin/env node
// Checks catalogue embeds. Writes a CSV of broken entries and src/data/dead.json
// so the site can hide them. Usage: node scripts/check-embeds.mjs [--limit N] [--discipline skate]
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";

const root = resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const limit = flag("--limit");
const only = flag("--discipline");

function flag(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : "";
}

function watchUrl(watch) {
  if (!watch || watch.host === "none") return "";
  if (watch.host === "youtube") return `https://www.youtube.com/watch?v=${watch.id}`;
  if (watch.host === "youtube-list") return `https://www.youtube.com/playlist?list=${watch.id}`;
  if (watch.host === "parts") return watch.parts?.[0]?.id ? `https://www.youtube.com/watch?v=${watch.parts[0].id}` : "";
  if (watch.host === "vimeo") return `https://vimeo.com/${watch.id}`;
  if (watch.host === "archive") return `https://archive.org/details/${watch.id}`;
  if (watch.host === "wawax") return `https://videoarchive.wawax.info/videos/watch/${watch.id}`;
  if (watch.host === "link") return watch.url || "";
  return "";
}

async function status(url) {
  const response = await fetch(url, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(12000) });
  return response.status;
}

async function check(entry) {
  const url = entry.url;
  if (!url) return { ...entry, status: "skip", code: 0 };
  try {
    if (entry.host === "youtube" || entry.host === "parts") {
      const id = entry.videoId;
      const thumb = await status(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`);
      if (thumb === 404) return { ...entry, status: "broken", code: 404 };
      if (thumb === 200) return { ...entry, status: "ok", code: 200 };
      const code = await status(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
      if (code === 404 || code === 410) return { ...entry, status: "broken", code };
      if (code === 200) return { ...entry, status: "ok", code };
      return { ...entry, status: "inconclusive", code };
    }
    if (entry.host === "vimeo") {
      const code = await status(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`);
      if (code === 404 || code === 410) return { ...entry, status: "broken", code };
      if (code === 200) return { ...entry, status: "ok", code };
      return { ...entry, status: "inconclusive", code };
    }
    const code = await status(url);
    if (code === 404 || code === 410) return { ...entry, status: "broken", code };
    if (code >= 200 && code < 400) return { ...entry, status: "ok", code };
    return { ...entry, status: "inconclusive", code };
  } catch {
    return { ...entry, status: "inconclusive", code: 0 };
  }
}

const disciplines = ["skate", "bmx", "blades", "scoot"].filter((id) => !only || id === only);
const entries = [];
for (const discipline of disciplines) {
  const catalog = JSON.parse(await readFile(resolve(root, `public/catalogs/${discipline}.json`), "utf8"));
  for (const film of Object.values(catalog.films)) {
    const watch = film.watch ?? { host: "none" };
    const videoId = watch.host === "parts" ? watch.parts?.[0]?.id ?? "" : watch.id ?? "";
    entries.push({
      discipline,
      id: film.id,
      title: film.title ?? "",
      company: film.company ?? "",
      year: film.year ?? "",
      host: watch.host,
      videoId,
      url: watchUrl(watch),
    });
  }
}

const queue = entries.filter((entry) => entry.url && entry.host !== "none" && entry.host !== "link");
const slice = limit ? queue.slice(0, Number(limit)) : queue;
const broken = [];
const inconclusive = [];
let cursor = 0;
const workers = 12;

async function worker() {
  while (cursor < slice.length) {
    const entry = slice[cursor++];
    const result = await check(entry);
    if (result.status === "broken") broken.push(result);
    else if (result.status === "inconclusive") inconclusive.push(result);
    const done = broken.length + inconclusive.length;
    if ((cursor % 100) === 0) console.log(`checked ${cursor}/${slice.length} broken ${broken.length}`);
    if (done && done % 25 === 0) await dump();
  }
}

function csvCell(value) {
  const text = String(value ?? "").replaceAll('"', '""');
  return `"${text}"`;
}

async function dump() {
  const dir = resolve(root, "reports");
  await mkdir(dir, { recursive: true });
  const lines = ["title,company,year,discipline,bad_url,replacement,note"];
  for (const row of broken) {
    lines.push(
      [row.title, row.company, row.year, row.discipline, row.url, "", "unavailable, no clear public replacement"].map(csvCell).join(","),
    );
  }
  for (const row of inconclusive) {
    lines.push([row.title, row.company, row.year, row.discipline, row.url, "", `inconclusive HTTP ${row.code}`].map(csvCell).join(","));
  }
  await writeFile(resolve(dir, "broken-embeds.csv"), `${lines.join("\n")}\n`);
  const dead = { skate: [], bmx: [], blades: [], scoot: [] };
  for (const row of broken) dead[row.discipline].push(row.id);
  await writeFile(resolve(root, "src/data/dead.json"), `${JSON.stringify(dead)}\n`);
}

await Promise.all(Array.from({ length: workers }, () => worker()));
await dump();
console.log(JSON.stringify({ checked: slice.length, broken: broken.length, inconclusive: inconclusive.length }));
