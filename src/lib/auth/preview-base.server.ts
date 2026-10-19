/**
 * Path-based previews (`preview.grokgsac.com/hds-…/`) strip the port prefix
 * before the request reaches this process. Better Auth then builds the Google
 * callback as `https://preview…/api/auth/…`, which the gateway cannot route
 * back here and rejects as "Invalid origin".
 *
 * While an auth request runs, point Better Auth's base path at the public
 * prefix so `redirect_uri` round-trips through the same sandbox.
 */
import { auth, rememberAuthHost } from "./server";

const PREFIX_RE = /^\/hds-[a-z0-9]+-\d+-[a-z0-9]+$/i;
const COOKIE = "grok_preview_prefix";

type AuthOptions = { basePath?: string };

export function sanitizePreviewPrefix(value: string | null | undefined): string {
  if (!value) return "";
  let text = value.trim();
  try {
    text = decodeURIComponent(text);
  } catch {
    /* keep the raw value */
  }
  return PREFIX_RE.test(text) ? text : "";
}

export function previewPrefixFrom(request: Request): string {
  const header = sanitizePreviewPrefix(request.headers.get("x-grok-preview-prefix"));
  if (header) return header;
  const query = sanitizePreviewPrefix(new URL(request.url).searchParams.get("prefix"));
  if (query) return query;
  const cookie = request.headers.get("cookie") ?? "";
  for (const part of cookie.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    if (trimmed.slice(0, eq) !== COOKIE) continue;
    return sanitizePreviewPrefix(trimmed.slice(eq + 1));
  }
  return "";
}

export function previewPrefixCookie(prefix: string): string {
  return `${COOKIE}=${encodeURIComponent(prefix)}; Path=/; Secure; SameSite=Lax; Max-Age=600`;
}

let tail: Promise<void> = Promise.resolve();

async function authOptions(): Promise<AuthOptions> {
  const ctx = await (auth as unknown as { $context: Promise<{ options: AuthOptions }> }).$context;
  return ctx.options;
}

/** Run `fn` with Better Auth's base path (and this request URL) prefixed. */
export async function withPreviewAuthBase<T>(prefix: string, request: Request, fn: (request: Request) => Promise<T>): Promise<T> {
  const run = tail.then(async () => {
    const options = await authOptions();
    const previous = options.basePath;
    rememberAuthHost(request);
    try {
      if (prefix) {
        options.basePath = `${prefix}/api/auth`;
        const url = new URL(request.url);
        if (!url.pathname.startsWith(`${prefix}/`)) url.pathname = `${prefix}${url.pathname}`;
        request = new Request(url, request);
      }
      return await fn(request);
    } finally {
      options.basePath = previous;
    }
  });
  tail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
