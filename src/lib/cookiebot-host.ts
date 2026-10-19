const COOKIEBOT_HOSTS = new Set(["trickmachina.com", "www.trickmachina.com", "alphatrickmachina.grok.me"]);

/** Cookiebot only allows these domains. Preview hosts must not load it. */
export function cookiebotAllowed(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/:\d+$/, "");
  return COOKIEBOT_HOSTS.has(host);
}
