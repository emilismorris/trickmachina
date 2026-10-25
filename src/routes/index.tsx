import { useEffect, useState, type PointerEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { track } from "@/lib/track";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/")({
  head: () =>
    pageHead(
      "Trick Machina",
      "Free archive of skate, BMX, blades and scoot full lengths. No dead links.",
      "/",
    ),
  component: Home,
});

const DISCIPLINES = [
  { id: "skate", label: "Skate", soon: false, gear: "Skateboard" },
  { id: "bmx", label: "BMX", soon: false, gear: "BMX bike" },
  { id: "blades", label: "Blades", soon: false, gear: "Aggressive inline skates" },
  { id: "scoot", label: "Scoot", soon: false, gear: "Street scooter" },
] as const;

const COUNTS = [
  { id: "skate", label: "Skate", count: 2091 },
  { id: "bmx", label: "BMX", count: 20906 },
  { id: "blades", label: "Blades", count: 636 },
  { id: "scoot", label: "Scoot", count: 1773 },
] as const;

function Home() {
  const [pressed, setPressed] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const active = DISCIPLINES.find((item) => item.id === (hover ?? pressed));

  useEffect(() => {
    track("landing");
  }, []);

  return (
    <main className="stage">
      <div className="stack" data-ready="true">
        <div className="floor">
          <div className="archive-head">
            <h1 className="archive-title">The Archive</h1>
            <Link to="/about" className="archive-line">
              Free archive of skate, BMX, blades & scoot full lengths. No dead links.
            </Link>
            <p className="archive-counts" aria-label="Videos by discipline">
              {COUNTS.map((item, i) => (
                <span key={item.id}>
                  {i > 0 ? " · " : null}
                  {item.label} {item.count.toLocaleString("en-US")}
                </span>
              ))}
            </p>
          </div>
          <section className="deck" aria-label="Choose a discipline">
          {DISCIPLINES.map((item) => {
            const handlers = {
              onPointerEnter: () => setHover(item.id),
              onPointerLeave: (event: PointerEvent) => {
                if (event.pointerType === "mouse") setHover((current) => (current === item.id ? null : current));
              },
              onFocus: () => setHover(item.id),
              onBlur: () => setHover((current) => (current === item.id ? null : current)),
            };
            if (item.soon) {
              return (
                <button
                  key={item.id}
                  type="button"
                  className="cat"
                  data-cat={item.id}
                  aria-pressed={pressed === item.id}
                  onClick={() => setPressed(item.id)}
                  {...handlers}
                >
                  <span className="label">{item.label}</span>
                  <span className="soon">(coming soon)</span>
                </button>
              );
            }
            return (
              <Link key={item.id} to="/$discipline" params={{ discipline: item.id }} className="cat" data-cat={item.id} {...handlers}>
                <span className="label">{item.label}</span>
              </Link>
            );
          })}
          </section>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {active ? active.gear : ""}
      </p>
    </main>
  );
}
