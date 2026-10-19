import { createFileRoute } from "@tanstack/react-router";
import { hashPassword } from "better-auth/crypto";
import { ADMIN_EMAIL } from "@/lib/admin-email";
import { previewPrefixCookie, previewPrefixFrom, withPreviewAuthBase } from "@/lib/auth/preview-base.server";
import { auth } from "@/lib/auth/server";
import { getSql } from "@/lib/db";
import { previewPasswordHostName } from "@/lib/preview-password-host";

function hostName(value: string | null): string {
  const raw = value?.split(",")[0]?.trim() ?? "";
  if (!raw) return "";
  try {
    if (raw.includes("://")) return new URL(raw).hostname.toLowerCase();
  } catch {
    /* not a URL */
  }
  return raw.replace(/:\d+$/, "").toLowerCase();
}

/** The preview keeps its own admin password, separate from trickmachina.com. */
function canReplaceAdminPassword(request: Request): boolean {
  return [request.headers.get("x-forwarded-host"), request.headers.get("host"), request.headers.get("origin"), request.headers.get("referer")].some(
    (value) => previewPasswordHostName(hostName(value)),
  );
}

async function replacePreviewPassword(request: Request): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  if (request.method !== "POST" || !path.endsWith("/admin-password")) return null;
  if (!canReplaceAdminPassword(request)) {
    return Response.json({ message: "This address keeps its saved password." }, { status: 403 });
  }
  let password = "";
  try {
    const body = (await request.json()) as { password?: unknown };
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    password = "";
  }
  if (password.length < 8 || password.length > 128) {
    return Response.json({ message: "Use at least 8 characters." }, { status: 400 });
  }
  const sql = await getSql();
  const users = await sql<{ id: string }>`select id from "user" where lower(email) = ${ADMIN_EMAIL} limit 1`;
  const user = users[0];
  if (!user) return Response.json({ message: "No admin yet." }, { status: 404 });
  const hash = await hashPassword(password);
  const accounts = await sql<{ id: string }>`
    select id from "account" where "userId" = ${user.id} and "providerId" = 'credential' limit 1
  `;
  if (accounts[0]) {
    await sql`update "account" set password = ${hash}, "updatedAt" = now() where id = ${accounts[0].id}`;
  } else {
    const id = crypto.randomUUID();
    await sql`
      insert into "account" ("id", "accountId", "providerId", "userId", "password", "createdAt", "updatedAt")
      values (${id}, ${user.id}, 'credential', ${user.id}, ${hash}, now(), now())
    `;
  }
  return Response.json({ ok: true });
}

async function rejectOtherAdmins(request: Request) {
  if (request.method !== "POST") return null;
  const path = new URL(request.url).pathname;
  const watched = path.endsWith("/sign-in/email") || path.endsWith("/sign-up/email");
  if (!watched) return null;
  let email = "";
  try {
    const body = (await request.clone().json()) as { email?: unknown };
    email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  } catch {
    email = "";
  }
  if (email === ADMIN_EMAIL) return null;
  return new Response(JSON.stringify({ message: "Only the admin can sign in." }), {
    status: 403,
    headers: { "content-type": "application/json" },
  });
}

function withPrefixCookie(response: Response, prefix: string): Response {
  const headers = new Headers();
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") return;
    headers.set(key, value);
  });
  for (const cookie of response.headers.getSetCookie()) headers.append("set-cookie", cookie);
  headers.append("set-cookie", previewPrefixCookie(prefix));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function handleAuth(request: Request): Promise<Response> {
  try {
    const replaced = await replacePreviewPassword(request);
    if (replaced) return replaced;
    const prefix = previewPrefixFrom(request);
    const response = await withPreviewAuthBase(prefix, request, (next) => auth.handler(next));
    return prefix ? withPrefixCookie(response, prefix) : response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sign-in failed";
    return new Response(JSON.stringify({ message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => handleAuth(request),
      POST: async ({ request }) => (await rejectOtherAdmins(request)) ?? handleAuth(request),
    },
  },
});
