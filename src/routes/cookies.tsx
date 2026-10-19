import { useEffect, useRef } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo";
import { cookiebotAllowed } from "@/lib/cookiebot-host";

const DECLARATION = "https://consent.cookiebot.com/e272238f-eb34-48f3-9ade-9622ba6dd921/cd.js";

export const Route = createFileRoute("/cookies")({
  head: () => pageHead("Cookies", "Cookies used on Trick Machina.", "/cookies"),
  component: Cookies,
});

function Cookies() {
  const slot = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = slot.current;
    if (!root || !cookiebotAllowed(window.location.hostname) || root.querySelector("#CookieDeclaration")) return;
    const script = document.createElement("script");
    script.id = "CookieDeclaration";
    script.src = DECLARATION;
    script.async = true;
    script.type = "text/javascript";
    root.appendChild(script);
  }, []);

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
      <div ref={slot} />
    </main>
  );
}
