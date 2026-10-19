export const GA_ID = "G-83KS7WNY4P";

type Gtag = (...args: unknown[]) => void;

function allowed() {
  return typeof document !== "undefined" && /(?:^|; )tm-consent=yes(?:;|$)/.test(document.cookie);
}

let started = false;

export function startAnalytics() {
  if (!allowed() || started) return;
  started = true;
  const w = window as Window & { gtag?: Gtag; dataLayer?: unknown[] };
  w.dataLayer = w.dataLayer ?? [];
  w.gtag = function gtagQueue() {
    w.dataLayer?.push(arguments);
  };
  w.gtag("js", new Date());
  w.gtag("config", GA_ID);
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script);
}

function gtag(...args: unknown[]) {
  if (!allowed()) return;
  startAnalytics();
  const w = window as Window & { gtag?: Gtag };
  w.gtag?.(...args);
}

export function trackPage(path: string) {
  if (path.startsWith("/admin") || path.startsWith("/login")) return;
  gtag("event", "page_view", {
    send_to: GA_ID,
    page_path: path,
    page_location: `${window.location.origin}${path}`,
  });
}

export function trackEvent(name: "film_open" | "play", params: { film_id: string; film_title: string; discipline: string }) {
  gtag("event", name, { send_to: GA_ID, ...params });
}
