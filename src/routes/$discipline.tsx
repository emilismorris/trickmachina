import { createFileRoute, Link, notFound, Outlet, useMatch } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { CatalogScreen } from "@/components/catalog";
import type { Catalog } from "@/data/types";
import { isHitKey } from "@/lib/hits";
import { loadSectionShell } from "@/lib/section-shell";
import { track } from "@/lib/track";
import { pageHead } from "@/lib/seo";

const PAGES: Record<string, { title: string; description: string }> = {
  skate: {
    title: "Skate Videos 1984–2026 — Trick Machina",
    description: "1,990 skate videos, 1984–2026, classics first, then by year. Free to watch.",
  },
  bmx: {
    title: "BMX Videos 1985–2026 — Trick Machina",
    description: "20,887 BMX videos, 1985–2026, classics first, then by year. Free to watch.",
  },
  blades: {
    title: "Blades Videos 1923–2026 — Trick Machina",
    description: "636 blades videos, 1923–2026, classics first, then by year. Free to watch.",
  },
  scoot: {
    title: "Scoot Videos 2013–2026 — Trick Machina",
    description: "1,773 scoot videos, 2013–2026. Street scooter films and parts, free to watch.",
  },
};

export const Route = createFileRoute("/$discipline")({
  beforeLoad: ({ params }) => {
    if (!PAGES[params.discipline]) throw notFound();
  },
  loaderDeps: () => ({}),
  loader: ({ params }) => loadSectionShell({ data: params.discipline }),
  head: ({ params, loaderData }) => {
    const page = PAGES[params.discipline];
    if (!page) return { meta: [{ title: "Not found — Trick Machina" }] };
    const head = pageHead(page.title, page.description, `/${params.discipline}`);
    const hero = loaderData?.films[loaderData.featuredId] ?? loaderData?.films[loaderData.heroIds[0] ?? ""];
    if (!hero?.thumb) return head;
    return { ...head, links: [...head.links, { rel: "preload", href: hero.thumb, as: "image" }] } as typeof head;
  },
  component: DisciplinePage,
  notFoundComponent: NotFound,
});

function NotFound() {
  return (
    <main className="status-screen">
      <h1>That page isn’t in the archive.</h1>
      <Link to="/" className="btn-play">
        All disciplines
      </Link>
    </main>
  );
}

function DisciplinePage() {
  const filmMatch = useMatch({ from: "/$discipline/$film", shouldThrow: false });
  if (filmMatch) return <Outlet />;
  return <DisciplineCatalog />;
}

function DisciplineCatalog() {
  const { discipline } = Route.useParams();
  const search = Route.useSearch() as { q?: string };
  const q = typeof search.q === "string" ? search.q.slice(0, 80) : "";
  const shell = Route.useLoaderData();
  const [catalog, setCatalog] = useState<Catalog>(shell);
  const [failed, setFailed] = useState(false);
  const started = useRef(false);
  const generation = useRef(0);
  const ready = catalog.id === discipline && Object.keys(catalog.views).length > 0;

  useEffect(() => {
    setCatalog(shell);
    setFailed(false);
    started.current = false;
    generation.current += 1;
  }, [shell]);

  useEffect(() => {
    if (isHitKey(discipline)) track(discipline);
  }, [discipline]);

  const loadFull = useCallback(() => {
    if (ready || started.current) return;
    started.current = true;
    const gen = generation.current;
    fetch(`/catalogs/${discipline}.json`)
      .then((response) => {
        if (!response.ok) throw new Error("missing");
        return response.json() as Promise<Catalog>;
      })
      .then((data) => {
        if (gen !== generation.current) return;
        if (data.id === discipline) setCatalog(data);
      })
      .catch(() => {
        if (gen !== generation.current) return;
        started.current = false;
        setFailed(true);
      });
  }, [discipline, ready]);

  useEffect(() => {
    if (ready) return;
    const start = () => loadFull();
    const idle = window.requestIdleCallback?.(start, { timeout: 4000 });
    const timer = window.setTimeout(start, 3200);
    return () => {
      if (idle) window.cancelIdleCallback?.(idle);
      window.clearTimeout(timer);
    };
  }, [ready, loadFull]);

  if (failed && !catalog.films[catalog.featuredId]) {
    return (
      <main className="status-screen">
        <h1>The catalog didn’t load.</h1>
        <button type="button" className="btn-play" onClick={() => window.location.reload()}>
          Try again
        </button>
      </main>
    );
  }
  return <CatalogScreen catalog={catalog} initialQuery={q} onNeedMore={ready ? undefined : loadFull} />;
}
