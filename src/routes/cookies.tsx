import { createFileRoute, Link } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/cookies")({
  head: () => pageHead("Cookies", "Cookies used on Trick Machina.", "/cookies"),
  component: Cookies,
});

function clearSiteCookies() {
  const names = document.cookie
    .split(";")
    .map((part) => part.split("=")[0]?.trim() ?? "")
    .filter(Boolean);
  const host = window.location.hostname;
  const domains = ["", host];
  const bits = host.split(".");
  if (bits.length > 1) domains.push(`.${bits.slice(-2).join(".")}`);
  for (const name of new Set([...names, "tm-consent", "_ga", "_gid", "_gat"])) {
    for (const domain of domains) {
      document.cookie = `${name}=; Max-Age=0; Path=/${domain ? `; Domain=${domain}` : ""}`;
    }
  }
}

function Cookies() {
  return (
    <main className="cookies">
      <p>
        <Link to="/">The Archive</Link>
      </p>
      <h1>Cookies</h1>
      <p>Trick Machina uses Google Analytics only, to count visits. We don’t set advertising cookies.</p>
      <p>
        <button
          type="button"
          className="cookies-clear"
          onClick={() => {
            clearSiteCookies();
            window.location.reload();
          }}
        >
          Clear cookies
        </button>
      </p>
      <p>
        <Link to="/contact">Questions</Link>
      </p>
    </main>
  );
}
