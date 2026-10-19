import { createFileRoute } from "@tanstack/react-router";
import { ADMIN_EMAIL } from "@/lib/admin-email";
import { previewPrefixCookie, previewPrefixFrom, withPreviewAuthBase } from "@/lib/auth/preview-base.server";
import { auth } from "@/lib/auth/server";

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
  const prefix = previewPrefixFrom(request);
  const response = await withPreviewAuthBase(prefix, request, (next) => auth.handler(next));
  return prefix ? withPrefixCookie(response, prefix) : response;
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => handleAuth(request),
      POST: async ({ request }) => (await rejectOtherAdmins(request)) ?? handleAuth(request),
    },
  },
});
