import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { isHitKey, type HitKey } from "@/lib/hits";

export type VisitRange = "7" | "28" | "all";

export type VisitBeacon = {
  path: string;
  source: string;
  device: "mobile" | "desktop" | "tablet";
  browser: string;
  language: string;
  visitor: string;
  session: string;
};

function pagePath(value: string) {
  const clean = value.split("?")[0]?.split("#")[0]?.trim() ?? "";
  const normalized = clean.replace(/\/+$/, "") || "/";
  if (
    normalized.length > 120 ||
    !normalized.startsWith("/") ||
    normalized.startsWith("//") ||
    normalized.includes("..") ||
    !/^\/[a-z0-9/_$.-]*$/i.test(normalized) ||
    normalized.startsWith("/admin") ||
    normalized.startsWith("/login") ||
    normalized.startsWith("/api")
  ) {
    return null;
  }
  return normalized;
}

function label(value: unknown, max = 80) {
  if (typeof value !== "string") return null;
  const clean = value.trim().slice(0, max);
  if (!clean || /[\u0000-\u001f]/.test(clean)) return null;
  return clean;
}

export const recordHit = createServerFn({ method: "POST" })
  .validator((key: unknown): HitKey => {
    if (typeof key !== "string" || !isHitKey(key)) throw new Error("Unknown counter");
    return key;
  })
  .handler(async ({ data }) => {
    const { bumpHit } = await import("./admin.server");
    await bumpHit(data);
    return { ok: true as const };
  });

export const recordVisit = createServerFn({ method: "POST" })
  .validator((input: unknown): VisitBeacon => {
    if (!input || typeof input !== "object") throw new Error("Unknown visit");
    const body = input as Partial<VisitBeacon>;
    const path = pagePath(typeof body.path === "string" ? body.path : "");
    const source = label(body.source, 120);
    const browser = label(body.browser, 40);
    const language = label(body.language, 16);
    const visitor = label(body.visitor, 64);
    const session = label(body.session, 64);
    const device = body.device === "mobile" || body.device === "tablet" || body.device === "desktop" ? body.device : null;
    if (!path || !source || !browser || !language || !visitor || !session || !device) throw new Error("Unknown visit");
    return { path, source, device, browser, language, visitor, session };
  })
  .handler(async ({ data }) => {
    const { bumpVisit } = await import("./admin.server");
    await bumpVisit(data);
    return { ok: true as const };
  });

export const getAdminDashboard = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((range: unknown): VisitRange => (range === "7" || range === "all" ? range : "28"))
  .handler(async ({ data, context }) => {
    const { loadAdminDashboard } = await import("./admin.server");
    return loadAdminDashboard(context.userId, data);
  });
