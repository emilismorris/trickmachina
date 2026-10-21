import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { CatalogScreen } from "@/components/catalog";
import type { Catalog } from "@/data/types";
import { isHitKey } from "@/lib/hits";
import { loadSectionShell } from "@/lib/section-shell";
import { track } from "@/lib/track";
import { pageHead } from "@/lib/seo";

const PAGES: Record<string, { title: string; description: string }> = {
  skate: {
    title: "Skate Videos 1984–2026 — Trick Machina",
    description: "2,090 skate videos, 1984–2026, sorted by era, team, brand and scene. Free to watch.",
  },
  bmx: {
    title: "BMX Videos 1985–2026 — Trick Machina",
    description: "20,906 BMX videos, 1985–2026, sorted by era, team and scene. Free to watch.",
  },
  blades: {
    title: "Blades Videos 1923–2026 — Trick Machina",
    description: "636 blades videos, 1923–2026, sorted by era and scene. Free to watch.",
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
  loader: ({ params }) => loadSectionShell({ data: params.discipline }),
  head: ({ params }) => {
    const page = PAGES[params.discipline];
    if (!page) return { meta: [{ title: "Not found — Trick Machina" }] };
    return pageHead(page.title, page.description, `/${params.discipline}`);
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
  const { discipline } = Route.useParams();
  const shell = Route.useLoaderData();
  const [catalog, setCatalog] = useState<Catalog>(shell);
  const [failed, setFailed] = useState(false);
  const ready = Object.keys(catalog.views).length > 0;

  useEffect(() => {
    setCatalog(shell);
    setFailed(false);
  }, [shell]);

  useEffect(() => {
    if (isHitKey(discipline)) track(discipline);
  }, [discipline]);

  const loadFull = useCallback(() => {
    if (ready) return;
    fetch(`/catalogs/${discipline}.json`)
      .then((response) => {
        if (!response.ok) throw new Error("missing");
        return response.json() as Promise<Catalog>;
      })
      .then(setCatalog)
      .catch(() => setFailed(true));
  }, [discipline, ready]);

  useEffect(() => {
    if (discipline !== "bmx") loadFull();
  }, [discipline, loadFull]);

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
  return <CatalogScreen catalog={catalog} onNeedMore={discipline === "bmx" && !ready ? loadFull : undefined} />;
}
