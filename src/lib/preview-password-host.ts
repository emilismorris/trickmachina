/** Hosts whose admin password is local to that address, not trickmachina.com. */
export function previewPasswordHostName(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/:\d+$/, "");
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "[::1]" ||
    host === "grok.me" ||
    host.endsWith(".grok.me") ||
    host === "grok-sandbox.com" ||
    host.endsWith(".grok-sandbox.com")
  );
}
