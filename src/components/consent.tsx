import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { startAnalytics } from "@/lib/ga";

const KEY = "tm-consent";

function readChoice(): "yes" | "no" | null {
  const match = document.cookie.match(/(?:^|; )tm-consent=(yes|no)(?:;|$)/);
  return match?.[1] === "yes" || match?.[1] === "no" ? match[1] : null;
}

function writeChoice(value: "yes" | "no") {
  document.cookie = `${KEY}=${value}; Max-Age=15552000; Path=/; SameSite=Lax`;
}

export function ConsentBanner() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!readChoice()) setOpen(true);
  }, []);

  if (!open) return null;

  const choose = (value: "yes" | "no") => {
    writeChoice(value);
    setOpen(false);
    if (value === "yes") startAnalytics();
  };

  return (
    <div className="consent" role="dialog" aria-label="Cookies">
      <p>Trick Machina uses Google Analytics only, to count visits. We don’t set advertising cookies.</p>
      <div className="consent-actions">
        <button type="button" onClick={() => choose("no")}>
          Reject
        </button>
        <button type="button" onClick={() => choose("yes")}>
          Accept
        </button>
        <Link to="/cookies">Cookies</Link>
      </div>
    </div>
  );
}
