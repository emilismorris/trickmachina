#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dead = JSON.parse(await readFile(resolve(root, "src/data/dead.json"), "utf8"));
const hidden = new Map(Object.entries(dead).map(([key, ids]) => [key, new Set(ids)]));

function slug(film) {
  const base = `${film.company} ${film.title} ${film.year > 0 ? film.year : ""}`
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 72);
  return `${base || "film"}--${film.id}`;
}

const urls = ["https://trickmachina.com/", "https://trickmachina.com/skate", "https://trickmachina.com/bmx", "https://trickmachina.com/blades", "https://trickmachina.com/scoot", "https://trickmachina.com/about", "https://trickmachina.com/contact", "https://trickmachina.com/cookies"];
for (const discipline of ["skate", "bmx", "blades", "scoot"]) {
  const catalog = JSON.parse(await readFile(resolve(root, `public/catalogs/${discipline}.json`), "utf8"));
  const skip = hidden.get(discipline) ?? new Set();
  for (const film of Object.values(catalog.films)) {
    if (!film.watch || film.watch.host === "none" || skip.has(film.id)) continue;
    urls.push(`https://trickmachina.com/${discipline}/${encodeURIComponent(slug(film))}`);
  }
}

const body = [`<?xml version="1.0" encoding="UTF-8"?>`, `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`, ...urls.map((loc) => `  <url><loc>${loc}</loc></url>`), `</urlset>`, ""].join("\n");
await writeFile(resolve(root, "public/sitemap.xml"), body);
console.log("urls", urls.length);
