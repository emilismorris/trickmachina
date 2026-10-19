import { createFileRoute, Link } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/about")({
  head: () =>
    pageHead(
      "About — Trick Machina",
      "Trick Machina is a free archive of skate, BMX, blades, and scoot videos.",
      "/about",
    ),
  component: About,
});

function About() {
  return (
    <main className="cookies about">
      <p>
        <Link to="/">The Archive</Link>
      </p>
      <h1>About</h1>
      <p>
        Trick Machina is a free archive of skate, BMX, blades, and scoot videos, from 1984 to today. Films stay
        grouped the way riders look for them: by era, team, brand, and scene.
      </p>
      <p>
        <Link to="/contact">Contact</Link>
      </p>
    </main>
  );
}