import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CatalogScreen } from "@/components/catalog";
import type { Catalog } from "@/data/types";
import { isHitKey } from "@/lib/hits";
import { track } from "@/lib/track";
import { pageHead } from "@/lib/seo";

const PAGES: Record<string, { title: string; description: string }> = {
  skate: {
    title: "Skate Videos 1984–2026 — Trick Machina",
    description: "2,090 skate videos, 1984–2026, sorted by era, team, brand and scene. Free to watch.",
  },
  bmx: {
    title: "BMX Videos 1985–2027 — Trick Machina",
    description: "20,899 BMX videos, 1985–2027, sorted by era, team and scene. Free to watch.",
  },
  blades: {
    title: "Blades Videos 1923–2026 — Trick Machina",
    description: "632 blades videos, 1923–2026, sorted by era and scene. Free to watch.",
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
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (isHitKey(discipline)) track(discipline);
  }, [discipline]);

  useEffect(() => {
    if (!PAGES[discipline]) return;
    let cancel = false;
    setCatalog(null);
    setFailed(false);
    fetch(`/catalogs/${discipline}.json`)
      .then((response) => {
        if (!response.ok) throw new Error("missing");
        return response.json() as Promise<Catalog>;
      })
      .then((data) => {
        if (!cancel) setCatalog(data);
      })
      .catch(() => {
        if (!cancel) setFailed(true);
      });
    return () => {
      cancel = true;
    };
  }, [discipline]);

  if (failed) {
    return (
      <main className="status-screen">
        <h1>The catalog didn’t load.</h1>
        <button type="button" className="btn-play" onClick={() => window.location.reload()}>
          Try again
        </button>
      </main>
    );
  }
  if (!catalog) {
    return (
      <main className="status-screen" role="status" aria-label="Loading films">
        <span className="skate-load" aria-hidden="true">
          <img className="skate-board" src="/media/loader-board.png" alt="" />
        </span>
        <p>Loading the archive</p>
      </main>
    );
  }
  return <CatalogScreen catalog={catalog} />;
}
