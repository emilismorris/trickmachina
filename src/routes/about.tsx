import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/about")({
  head: () =>
    pageHead(
      "About — Trick Machina",
      "Trick Machina is a free archive of skate, BMX, blades, and scoot full lengths. One place, no dead links.",
      "/about",
    ),
  component: About,
});

const STATS = [
  { id: "skate", name: "Skateboarding", films: 1992, playable: 1992, years: "1980–2026", note: "From Animal Chin to today" },
  { id: "bmx", name: "BMX", films: 20887, playable: 20887, years: "1985–2026", note: "Parts, brands, contests, scenes" },
  { id: "blades", name: "Blades", films: 636, playable: 636, years: "1923–2026", note: "Aggressive inline reels" },
  { id: "scoot", name: "Scoot", films: 1773, playable: 1773, years: "2013–2026", note: "Street scooter full lengths" },
] as const;

function About() {
  const router = useRouter();
  const total = 25288;
  const playable = 25288;

  return (
    <main className="cookies about">
      <p>
        <button
          type="button"
          className="page-back"
          onClick={() => (window.history.length > 1 ? router.history.back() : router.navigate({ to: "/" }))}
        >
          <ChevronLeft aria-hidden="true" />
          Back
        </button>
      </p>

      <header className="about-hero">
        <p className="kicker">The free archive</p>
        <h1>One shelf for the films</h1>
        <p className="about-lead">
          {total.toLocaleString("en-US")} full lengths. {playable.toLocaleString("en-US")} playable. No dead links.
        </p>
      </header>

      <section className="about-numbers" aria-label="Catalogue size">
        <div className="about-stat about-stat-total">
          <span className="about-num">{total.toLocaleString("en-US")}</span>
          <span className="about-label">films</span>
        </div>
        <div className="about-stat">
          <span className="about-num">{playable.toLocaleString("en-US")}</span>
          <span className="about-label">playable</span>
        </div>
        <div className="about-stat">
          <span className="about-num">4</span>
          <span className="about-label">disciplines</span>
        </div>
        <div className="about-stat">
          <span className="about-num">0</span>
          <span className="about-label">accounts</span>
        </div>
      </section>

      <section className="about-section">
        <h2>The problem</h2>
        <p>
          The films are already out there. Skate from the 1980s, BMX from the mid-80s, blades from the earliest reels,
          scoot from the 2010s. They live under different names, years, and channels. Links die. Full lengths get
          chopped or buried. Finding one specific video usually means searching, then searching again.
        </p>
        <p>
          There was no single place to browse the history the way riders actually look for it: by era, by team, by
          brand, by scene.
        </p>
      </section>

      <section className="about-section">
        <h2>The solution</h2>
        <p>
          Trick Machina puts them on one shelf. Pick a discipline. Browse rows the way the culture is organised:
          classics, teams, brands, magazines, contests, and scenes. Open a title and the film plays. Watching is free.
          No account, no paywall, no dead links.
        </p>
        <p>
          Each discipline is its own room. The catalogue stays current up to today and keeps the older reels in place.
        </p>
      </section>

      <section className="about-section">
        <h2>The catalogue</h2>
        <ul className="about-disciplines">
          {STATS.map((item) => (
            <li key={item.id}>
              <Link to="/$discipline" params={{ discipline: item.id }} className="about-discipline">
                <div className="about-discipline-head">
                  <span className="about-discipline-name">{item.name}</span>
                  <span className="about-discipline-years">{item.years}</span>
                </div>
                <div className="about-discipline-nums">
                  <span>{item.films.toLocaleString("en-US")} films</span>
                  <span>{item.playable.toLocaleString("en-US")} playable</span>
                </div>
                <span className="about-discipline-note">{item.note}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="about-section">
        <h2>How it works</h2>
        <p>
          Open a discipline. Rows follow the way people already sort the material: classics and parts, teams and brands,
          magazines and contests, scenes by region. Thumbnails, years, and titles are in one place. Click and watch.
        </p>
        <p>
          Most films are on YouTube and play right here. A few older reels use other hosts. The point is the same:
          you stay in the archive instead of hunting.
        </p>
      </section>

      <p className="about-cta">
        <Link to="/">Browse the archive</Link>
        {" · "}
        <Link to="/contact">Contact</Link>
      </p>
    </main>
  );
}
