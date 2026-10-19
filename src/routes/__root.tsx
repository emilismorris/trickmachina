import { useEffect, useRef } from "react";
import { createRootRoute, HeadContent, Link, Outlet, Scripts, useRouterState } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { ConsentBanner } from "@/components/consent";
import { startAnalytics, trackPage } from "@/lib/ga";
import { collectVisit } from "@/lib/visit";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#1a1612" },
    ],
    links: [
      { rel: "icon", href: "/favicon.ico", sizes: "32x32" },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
    ],
  }),
  notFoundComponent: NotFound,
  component: () => (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <NoPullRefresh />
        <Analytics />
        <PreviewHostBridge />
        <ConsentBanner />
        <AuthProvider>
          <Outlet />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});

function Analytics() {
  const href = useRouterState({ select: (state) => state.location.href });
  const first = useRef(true);
  useEffect(() => {
    collectVisit(href);
    startAnalytics();
    if (first.current) {
      first.current = false;
      return;
    }
    trackPage(href);
  }, [href]);
  return null;
}

function NotFound() {
  return (
    <main className="status-screen">
      <h1>That page isn’t in the archive.</h1>
      <Link to="/" className="btn-play">
        All disciplines
      </Link>
    </main>
  );
}

/** Block the downward overscroll that reloads the page. Normal scrolling stays. */
function NoPullRefresh() {
  useEffect(() => {
    let startX = 0;
    let startY = 0;
    const onStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      startX = event.touches[0].clientX;
      startY = event.touches[0].clientY;
    };
    const onMove = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      const dx = event.touches[0].clientX - startX;
      const dy = event.touches[0].clientY - startY;
      if (dy <= 0 || Math.abs(dx) > Math.abs(dy)) return;
      if (!atScrollTop(event.target)) return;
      event.preventDefault();
    };
    document.addEventListener("touchstart", onStart, { passive: true, capture: true });
    document.addEventListener("touchmove", onMove, { passive: false, capture: true });
    return () => {
      document.removeEventListener("touchstart", onStart, true);
      document.removeEventListener("touchmove", onMove, true);
    };
  }, []);
  return null;
}

function atScrollTop(target: EventTarget | null) {
  let el = target instanceof Element ? target : null;
  while (el) {
    const y = getComputedStyle(el).overflowY;
    if ((y === "auto" || y === "scroll" || y === "overlay") && el.scrollHeight > el.clientHeight + 1 && el.scrollTop > 0) {
      return false;
    }
    el = el.parentElement;
  }
  return window.scrollY <= 0;
}