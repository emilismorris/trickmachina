import type { Film, Watch } from "@/data/types";

export function filmSlug(film: Pick<Film, "id" | "title" | "company" | "year">) {
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

export function filmIdFromSlug(slug: string) {
  const mark = slug.lastIndexOf("--");
  return mark >= 0 ? slug.slice(mark + 2) : "";
}

export function watchPageUrl(watch: Watch) {
  if (watch.host === "youtube") return `https://www.youtube.com/watch?v=${watch.id}`;
  if (watch.host === "youtube-list") return `https://www.youtube.com/playlist?list=${watch.id}`;
  if (watch.host === "parts") {
    const id = watch.parts[0]?.id;
    return id ? `https://www.youtube.com/watch?v=${id}` : "";
  }
  if (watch.host === "vimeo") return `https://vimeo.com/${watch.id}`;
  if (watch.host === "archive") return `https://archive.org/details/${watch.id}`;
  if (watch.host === "wawax") return `https://videoarchive.wawax.info/videos/watch/${watch.id}`;
  if (watch.host === "link") return watch.url;
  return "";
}

export function embedSrc(watch: Watch) {
  if (watch.host === "youtube") return `https://www.youtube-nocookie.com/embed/${watch.id}?rel=0&modestbranding=1&playsinline=1`;
  if (watch.host === "youtube-list") return `https://www.youtube-nocookie.com/embed/videoseries?list=${watch.id}&rel=0`;
  if (watch.host === "parts") {
    const id = watch.parts[0]?.id;
    return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1` : null;
  }
  if (watch.host === "vimeo") return `https://player.vimeo.com/video/${watch.id}`;
  if (watch.host === "archive") return `https://archive.org/embed/${watch.id}`;
  if (watch.host === "wawax") return `https://videoarchive.wawax.info/videos/embed/${watch.id}`;
  return null;
}
