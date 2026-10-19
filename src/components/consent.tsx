import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { cookiebotAllowed } from "@/lib/cookiebot-host";

const KEY = "tm-consent";

function readChoice(): "yes" | "no" | null {
  const match = document.cookie.match(/(?:^|; )tm-consent=(yes|no)(?:;|$)/);
  return match?.[1] === "yes" || match?.[1] === "no" ? match[1] : null;
}

function writeChoice(value: "yes" | "no") {
  document.cookie = `${KEY}=${value}; Max-Age=15552000; Path=/; SameSite=Lax`;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* a hard reset should follow the cookie, not an old saved choice */
  }
}

function dropUnauthorizedCookiebot() {
  if (cookiebotAllowed(window.location.hostname)) return;
  document.getElementById("Cookiebot")?.remove();
  document.getElementById("CookieDeclaration")?.remove();
  document
    .querySelectorAll("#CybotCookiebotDialog, #CybotCookiebotDialogBodyUnderlay, #CookiebotWidget")
    .forEach((node) => node.remove());
  document.querySelectorAll("div, p, span").forEach((node) => {
    const text = node.textContent ?? "";
    if (text.length > 700 || node.closest("main, .consent")) return;
    if (/not authorized to show the cookie declaration/i.test(text)) node.remove();
  });
}

function patchCookiebot() {
  dropUnauthorizedCookiebot();
  document.querySelectorAll<HTMLAnchorElement>("a[href*='DSR_FORM_URL'], a[href*='%23DSR_FORM_URL%23']").forEach((link) => {
    link.href = "mailto:emil@trickmachina.com";
    link.textContent = "Email us";
  });
  const dialog = document.getElementById("CybotCookiebotDialogBodyContentText") ?? document.getElementById("CybotCookiebotDialogBodyContent");
  if (dialog && /DSR_FORM_URL|advertising|marketing cookies/i.test(dialog.textContent ?? "")) {
    dialog.textContent = "Trick Machina uses Google Analytics only, to count visits. No advertising cookies.";
  }
}

export function ConsentBanner() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    patchCookiebot();
    const observer = new MutationObserver(patchCookiebot);
    observer.observe(document.body, { childList: true, subtree: true });
    if (!readChoice()) setOpen(true);
    return () => observer.disconnect();
  }, []);

  if (!open) return null;

  const choose = (value: "yes" | "no") => {
    writeChoice(value);
    setOpen(false);
  };

  return (
    <div className="consent" role="dialog" aria-label="Cookies">
      <p>Trick Machina uses Google Analytics only, to count visits. No advertising cookies.</p>
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