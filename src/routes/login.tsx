import { createFileRoute, Link, Navigate, stripSearchParams } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { isAdminEmail } from "@/lib/admin-email";
import { authClient, rememberSessionToken, signOut } from "@/lib/auth/client";
import { previewPasswordHostName } from "@/lib/preview-password-host";
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

function previewPasswordHost() {
  if (typeof window === "undefined") return false;
  return previewPasswordHostName(window.location.hostname);
}

function keepSession(result: { data?: { token?: string | null } | null }) {
  const token = result.data?.token;
  if (token) rememberSessionToken(token);
}

function PasswordSignIn() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const email = "emil@trickmachina.com";
    const signed = await authClient.signIn.email({ email, password, callbackURL: "/admin" });
    if (!signed.error) {
      keepSession(signed);
      window.location.assign("/admin");
      return;
    }
    if (previewPasswordHost()) {
      const saved = await fetch("/api/auth/admin-password", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (saved.ok) {
        const again = await authClient.signIn.email({ email, password, callbackURL: "/admin" });
        if (!again.error) {
          keepSession(again);
          window.location.assign("/admin");
          return;
        }
      } else if (saved.status !== 404) {
        const body = (await saved.json().catch(() => null)) as { message?: string } | null;
        setBusy(false);
        setError(body?.message || "Sign-in didn’t finish. Try that password again.");
        return;
      }
    }
    const created = await authClient.signUp.email({ email, password, name: "Admin", callbackURL: "/admin" });
    if (!created.error) {
      keepSession(created);
      window.location.assign("/admin");
      return;
    }
    setBusy(false);
    const message = created.error.message ?? "";
    setError(
      /exist/i.test(message)
        ? "That password doesn’t match this address yet. Type it once more."
        : message || signed.error.message || "Sign-in didn’t finish.",
    );
  }

  return (
    <form onSubmit={submit}>
      <style>{`.admin-pass{width:100%;min-height:2.75rem;margin-top:1rem;color:inherit;background:transparent;border:1px solid #3a342e;font:inherit;padding:0 .8rem}`}</style>
      <input
        className="admin-pass"
        type="password"
        name="password"
        autoComplete="current-password"
        required
        minLength={8}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        aria-label="Password"
      />
      <button className="btn-google" type="submit" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
      {error ? <p className="admin-warn">{error}</p> : null}
    </form>
  );
}

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
        <p className="admin-note">
          Google can’t return here. The password is saved on this address only — trickmachina.com and the preview each have their own.
        </p>
        {refused ? <p className="admin-warn">That account isn’t the admin. It was signed out.</p> : null}
        {user && !admin ? <p className="admin-warn">This account isn’t the admin. Switch accounts.</p> : null}
        <PasswordSignIn />
      </section>
    </main>
  );
}
