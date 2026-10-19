import { recordVisit } from "@/lib/admin.functions";

const VISITOR = "tm-visitor";
const SESSION = "tm-session";
const SOURCE = "tm-source";

function stored(storage: Storage, key: string) {
  const current = storage.getItem(key);
  if (current && /^[a-z0-9-]{8,64}$/i.test(current)) return current;
  const next = crypto.randomUUID();
  storage.setItem(key, next);
  return next;
}

function device() {
  const ua = navigator.userAgent;
  if (/iPad|Tablet/i.test(ua)) return "tablet";
  if (/Mobi|Android/i.test(ua)) return "mobile";
  return "desktop";
}

function browser() {
  const ua = navigator.userAgent;
  if (ua.includes("Edg/")) return "Edge";
  if (ua.includes("Chrome/") || ua.includes("CriOS/")) return "Chrome";
  if (ua.includes("Firefox/") || ua.includes("FxiOS/")) return "Firefox";
  if (ua.includes("Safari/")) return "Safari";
  return "Other";
}

function source() {
  const saved = sessionStorage.getItem(SOURCE);
  if (saved) return saved;
  let host = "(direct)";
  try {
    if (document.referrer) {
      const name = new URL(document.referrer).hostname.replace(/^www\./, "");
      if (name && name !== window.location.hostname) host = name;
    }
  } catch {
    host = "(direct)";
  }
  sessionStorage.setItem(SOURCE, host);
  return host;
}

export function collectVisit(path: string) {
  const clean = path.split("?")[0]?.split("#")[0] ?? "/";
  if (clean.startsWith("/admin") || clean.startsWith("/login")) return;
  void recordVisit({
    data: {
      path: clean,
      source: source(),
      device: device(),
      browser: browser(),
      language: (navigator.language || "unknown").slice(0, 16),
      visitor: stored(localStorage, VISITOR),
      session: stored(sessionStorage, SESSION),
    },
  }).catch(() => {});
}
