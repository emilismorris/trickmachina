import { createFileRoute, Link, Navigate, stripSearchParams } from "@tanstack/react-router";
import { useEffect } from "react";
import { AdminGoogleButton } from "@/components/admin-google";
import { isAdminEmail } from "@/lib/admin-email";
import { signOut } from "@/lib/auth/client";
import { hasGateSessionMarker } from "@/lib/auth/gate-session-marker";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    refused: search.refused === "1" || search.refused === 1 || search.refused === true,
  }),
  search: {
    middlewares: [stripSearchParams({ refused: false })],
  },
  head: () => ({
    meta: [
      { title: "Admin sign in — Trick Machina" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Login,
});

function Login() {
  const { refused } = Route.useSearch();
  const { user, isPending } = useCurrentUserState();
  const admin = Boolean(user && isAdminEmail(user.primaryEmail));

  useEffect(() => {
    if (isPending || !user || admin) return;
    if (hasGateSessionMarker()) return;
    void signOut("/login?refused=1").catch(() => {});
  }, [admin, isPending, user]);

  if (isPending) {
    return (
      <main className="admin-auth">
        <p className="admin-note">Checking the session</p>
      </main>
    );
  }
  if (admin) return <Navigate to="/admin" />;

  return (
    <main className="admin-auth">
      <Link to="/" className="wordmark" aria-label="Trick Machina home">
        <img src="/media/wordmark.webp" alt="Trick Machina" />
      </Link>
      <section className="admin-card">
        <p className="kicker">Admin</p>
        <h1>Sign in</h1>
        <p className="admin-note">Sign in with the admin Google account.</p>
        {refused ? <p className="admin-warn">That Google account isn’t the admin. It was signed out.</p> : null}
        {user && !admin ? <p className="admin-warn">This Google account isn’t the admin. Switch accounts.</p> : null}
        <AdminGoogleButton />
      </section>
    </main>
  );
}
