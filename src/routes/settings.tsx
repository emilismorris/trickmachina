import { createFileRoute, useRouter } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { startAnalytics } from "@/lib/ga";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/settings")({
  head: () => pageHead("Settings — Trick Machina", "Settings for Trick Machina.", "/settings"),
  component: Settings,
});

function readChoice(): "yes" | "no" | null {
  const match = document.cookie.match(/(?:^|; )tm-consent=(yes|no)(?:;|$)/);
  return match?.[1] === "yes" || match?.[1] === "no" ? match[1] : null;
}

function Settings() {
  const router = useRouter();
  const [choice, setChoice] = useState<"yes" | "no" | null>(null);

  useEffect(() => {
    setChoice(readChoice());
  }, []);

  const choose = (value: "yes" | "no") => {
    document.cookie = `tm-consent=${value}; Max-Age=15552000; Path=/; SameSite=Lax`;
    setChoice(value);
    if (value === "yes") startAnalytics();
  };

  return (
    <main className="cookies">
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
      <h1>Settings</h1>
      <p>Trick Machina uses Google Analytics only, to count visits. We don’t set advertising cookies.</p>
      <p className="settings-choice">
        <button type="button" className={choice === "no" ? "is-on" : ""} onClick={() => choose("no")}>
          Reject
        </button>
        <button type="button" className={choice === "yes" ? "is-on" : ""} onClick={() => choose("yes")}>
          Accept
        </button>
      </p>
    </main>
  );
}
