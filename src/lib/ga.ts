export const GA_ID = "G-83KS7WNY4P";

type Gtag = (...args: unknown[]) => void;

function gtag(...args: unknown[]) {
  const w = window as Window & { gtag?: Gtag; dataLayer?: unknown[] };
  w.dataLayer = w.dataLayer ?? [];
  if (!w.gtag) {
    w.gtag = function gtagQueue() {
      w.dataLayer?.push(arguments);
    };
  }
  w.gtag(...args);
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
