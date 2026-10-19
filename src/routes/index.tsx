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
  const phone = useRef<HTMLVideoElement>(null);
  const [pressed, setPressed] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const active = DISCIPLINES.find((item) => item.id === (hover ?? pressed));

  useEffect(() => {
    track("landing");
  }, []);

  useEffect(() => {
    const wide = desktop.current;
    const narrow = phone.current;
    if (!wide || !narrow) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const small = window.matchMedia("(max-width: 767px)");
    if (reduce.matches) {
      wide.pause();
      narrow.pause();
      return;
    }
    const play = (video: HTMLVideoElement) => {
      video.play().catch(() => {});
    };
    const current = () => (small.matches ? narrow : wide);
    const sync = () => {
      const next = current();
      (next === narrow ? wide : narrow).pause();
      play(next);
    };
    sync();
    let frame = 0;
    const tick = () => {
      const video = current();
      if (video.paused) play(video);
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    small.addEventListener("change", sync);
    return () => {
      window.cancelAnimationFrame(frame);
      small.removeEventListener("change", sync);
    };
  }, []);

  return (
    <main className="stage">
      <video
        ref={desktop}
        className="bg-video bg-desktop"
        src="/media/park.mp4"
        poster="/media/park-poster.jpg"
        autoPlay
        muted
        loop
        playsInline
        preload="none"
        aria-hidden="true"
      />
      <video
        ref={phone}
        className="bg-video bg-phone"
        src="/media/park.mp4"
        poster="/media/park-poster.jpg"
        muted
        loop
        playsInline
        preload="none"
        aria-hidden="true"
      />
      <div className="stack" data-ready="true">
        <div className="floor">
          <h1 className="archive-title">The Archive</h1>
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
