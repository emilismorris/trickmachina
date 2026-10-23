import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/about")({
  head: () =>
    pageHead(
      "About — Trick Machina",
      "Trick Machina is a free archive of skate, BMX, blades, and scoot videos, in one place.",
      "/about",
    ),
  component: About,
});

function About() {
  const router = useRouter();
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
      <h1>About</h1>
      <p>
        Trick Machina is a free archive of skate, BMX, blades, and scoot full lengths. No dead links.
      </p>
      <p>
        The films are already out there, under different names and years. Trick Machina puts them on one shelf, so
        you can browse and watch instead of searching. Skate runs from 1984, BMX from 1985, blades from the earliest
        reels, and scoot from 2013, up to today.
      </p>
      <p>
        Each discipline is its own room. Rows follow the way riders look: classics, teams, brands, magazines,
        contests, and scenes. Open a title and the film plays. Watching is free. No account.
      </p>
      <p>
        <Link to="/contact">Contact</Link>
      </p>
    </main>
  );
}