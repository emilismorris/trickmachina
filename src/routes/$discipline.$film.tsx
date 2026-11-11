import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { SiteSearch } from "@/components/site-search";
import { trackEvent } from "@/lib/ga";
import { embedSrc, watchPageUrl } from "@/lib/film-slug";
import { pageHead } from "@/lib/seo";
import { track } from "@/lib/track";

const loadFilmPage = createServerFn({ method: "GET" })
  .validator((input: { discipline: string; slug: string }) => input)
  .handler(async ({ data }) => {
    const { loadFilm } = await import("@/lib/film-lookup.server");
    return loadFilm(data.discipline, data.slug);
  });

export const Route = createFileRoute("/$discipline/$film")({
  loader: async ({ params }) => {
    const hit = await loadFilmPage({ data: { discipline: params.discipline, slug: params.film } });
    if (!hit) throw notFound();
    return hit;
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) return { meta: [{ title: "Film — Trick Machina" }] };
    const { film } = loaderData;
    const title = `${film.title} (${film.year || "archive"}) — Trick Machina`;
    const description = film.blurb || `${film.title}, ${film.company || params.discipline}, ${film.year || ""}. Free to watch on Trick Machina.`.replace(/\s+/g, " ").trim();
    const size = film.thumb.includes("ytimg.com") ? { width: 480, height: 360 } : undefined;
    return pageHead(title, description, `/${params.discipline}/${params.film}`, film.thumb, size);
  },
  component: FilmPage,
});

function FilmPage() {
  const { discipline, film, slug } = Route.useLoaderData();
  const [playing, setPlaying] = useState(false);
  const [part, setPart] = useState(0);
  const src = embedSrc(film.watch, part);
  const outbound = watchPageUrl(film.watch);
  const description = film.blurb || `${film.title} from ${film.company || discipline}.`;

  useEffect(() => {
    trackEvent("film_view", { film_id: film.id, film_title: film.title, discipline });
  }, [discipline, film.id, film.title]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: film.title,
    description,
    thumbnailUrl: film.thumb || undefined,
    uploadDate: film.year > 0 ? `${film.year}-01-01` : undefined,
    embedUrl: src ?? undefined,
    url: `https://trickmachina.com/${discipline}/${slug}`,
  };

  return (
    <main className="cookies film-page">
      <div className="page-search">
        <SiteSearch discipline={discipline} />
      </div>
      <p>
        <Link to="/$discipline" params={{ discipline }} className="page-back">
          <ChevronLeft aria-hidden="true" />
          {discipline}
        </Link>
      </p>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {film.thumb ? <img className="film-poster" src={film.thumb} alt="" width={480} height={360} fetchPriority="high" /> : null}
      <h1>{film.title}</h1>
      <p>{[film.company, film.year > 0 ? film.year : null].filter(Boolean).join(" · ")}</p>
      {description !== film.title ? <p>{film.blurb}</p> : null}
      {playing && src ? (
        <iframe className="player-frame" src={src} title={film.title} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
      ) : src ? (
        <button
          type="button"
          className="btn-play"
          onClick={() => {
            setPlaying(true);
            track("play", film.id);
            trackEvent("video_play", { film_id: film.id, film_title: film.title, discipline });
          }}
        >
          Play
        </button>
      ) : null}
      {film.watch.host === "parts" ? (
        <ol className="playlist">
          {film.watch.parts.map((item, index) => (
            <li key={item.id}>
              <button
                type="button"
                aria-current={playing && index === part}
                onClick={() => {
                  setPart(index);
                  setPlaying(true);
                  track("play", film.id);
                }}
              >
                <span>{item.title === "Trailer" ? "•" : film.watch.parts.slice(0, index).filter((entry) => entry.title !== "Trailer").length + 1}</span>
                {item.title}
              </button>
            </li>
          ))}
        </ol>
      ) : null}
      {outbound ? (
        <p>
          <a
            href={outbound}
            target="_blank"
            rel="noreferrer"
            onClick={() => trackEvent("video_play", { film_id: film.id, film_title: film.title, discipline, method: "outbound" })}
          >
            Open the video
          </a>
        </p>
      ) : null}
    </main>
  );
}
