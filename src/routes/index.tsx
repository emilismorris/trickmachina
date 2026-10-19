import { useEffect, useRef, useState, type PointerEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { track } from "@/lib/track";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/")({
  head: () =>
    pageHead(
      "Trick Machina",
      "Skate, BMX, blades, and scoot videos, free to watch.",
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

function Home() {
  const desktop = useRef<HTMLVideoElement>(null);
  const [pressed, setPressed] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const active = DISCIPLINES.find((item) => item.id === (hover ?? pressed));

  useEffect(() => {
    track("landing");
  }, []);

  useEffect(() => {
    const wide = desktop.current;
    if (!wide) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const small = window.matchMedia("(max-width: 767px)");
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    const slow = Boolean(connection?.saveData || connection?.effectiveType === "slow-2g" || connection?.effectiveType === "2g");
    if (reduce.matches || small.matches || slow) return;
    wide.src = "/media/park.mp4";
    wide.play().catch(() => {});
  }, []);

  return (
    <main className="stage">
      <video
        ref={desktop}
        className="bg-video bg-desktop"
        poster="/media/park-poster.webp"
        muted
        loop
        playsInline
        preload="none"
        aria-hidden="true"
      />
      <div className="stack" data-ready="true">
        <div className="floor">
          <div className="archive-head">
            <h1 className="archive-title">The Archive</h1>
            <p className="archive-line">The four disciplines. Free videos and films.</p>
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
