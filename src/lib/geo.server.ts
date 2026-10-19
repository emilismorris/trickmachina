import { getRequest } from "@tanstack/react-start/server";

const PRIVATE =
  /^(127\.|10\.|192\.168\.|169\.254\.|0\.|::1$|fc|fd|fe80|localhost)/i;

export function clientIp(): string | null {
  const request = getRequest();
  if (!request) return null;
  const forwarded =
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-vercel-forwarded-for") ||
    request.headers.get("x-real-ip") ||
    "";
  const raw = forwarded.split(",")[0]?.trim() || "";
  const ip = raw.replace(/^::ffff:/, "");
  if (!ip || ip.length > 64) return null;
  return ip;
}

export function isPublicIp(ip: string) {
  return !PRIVATE.test(ip);
}

type Geo = { lat: number; lng: number; place: string };

export async function locateIp(ip: string): Promise<Geo | null> {
  if (!isPublicIp(ip)) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!response.ok) return null;
    const body = (await response.json()) as {
      success?: boolean;
      latitude?: number;
      longitude?: number;
      city?: string;
      region?: string;
      country?: string;
    };
    if (body.success === false) return null;
    if (typeof body.latitude !== "number" || typeof body.longitude !== "number") return null;
    if (body.latitude < -90 || body.latitude > 90 || body.longitude < -180 || body.longitude > 180) return null;
    const place = [body.city, body.region, body.country].filter(Boolean).join(", ");
    return { lat: body.latitude, lng: body.longitude, place };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
