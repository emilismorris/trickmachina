import { createFileRoute, Link } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/cookies")({
  head: () => pageHead("Cookies", "Cookies used on Trick Machina.", "/cookies"),
  component: Cookies,
});

function Cookies() {
  return (
    <main className="cookies">
      <p>
        <Link to="/">The Archive</Link>
      </p>
      <h1>Cookies</h1>
      <p>Trick Machina uses Google Analytics only, to count visits. We don’t set advertising cookies.</p>
      <p>
        Questions: <a href="mailto:emil@trickmachina.com">emil@trickmachina.com</a>.
      </p>
    </main>
  );
}
