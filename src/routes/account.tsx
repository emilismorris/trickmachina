import { createFileRoute, useRouter } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { authClient, rememberSessionToken, signIn, signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { listFavorites, toggleFavorite, type SavedFilm } from "@/lib/list.functions";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/account")({
  head: () => pageHead("Log in — Trick Machina", "Sign in with Google and keep a list of films.", "/account"),
  component: Account,
});

const PENDING = "tm-pending-favorite";
const NAMES: Record<string, string> = { skate: "Skate", bmx: "BMX", blades: "Blades", scoot: "Scoot" };

function Account() {
  const router = useRouter();
  const { user, isPending } = useCurrentUserState();
  const signedIn = Boolean(user && !user.isDevFallback);
  const [films, setFilms] = useState<SavedFilm[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("error");
    if (code && /redirect|callback/i.test(code)) {
      setError("Google and X can’t return to this site. Use email and a password — that creates the account.");
    }
  }, []);

  useEffect(() => {
    if (isPending || !signedIn) return;
    let stop = false;
    (async () => {
      try {
        const raw = sessionStorage.getItem(PENDING);
        if (raw) {
          const pending = JSON.parse(raw) as SavedFilm;
          sessionStorage.removeItem(PENDING);
          if (pending?.filmId && pending.title && pending.discipline) {
            await toggleFavorite({ data: { ...pending, on: true } });
          }
        }
        const rows = await listFavorites();
        if (!stop) setFilms(rows);
      } catch {
        if (!stop) setError("The list didn’t load.");
      }
    })();
    return () => {
      stop = true;
    };
  }, [isPending, signedIn]);

  return (
    <main className="cookies">
      <p>
        <button
          type="button"
          className="page-back"
          onClick={() => (window.history.length > 1 ? router.history.back() : router.navigate({ to: "/" }))}
        >
          <ChevronLeft aria-hidden="true" />
          Back
        </button>
      </p>
      <h1>{signedIn ? "Your list" : "Log in"}</h1>
      {isPending ? null : signedIn ? (
        <>
          <p>Signed in as {user?.displayName || user?.primaryEmail}. Films you mark My list stay on this account.</p>
          {films.length ? (
            <ul className="account-list">
              {films.map((film) => (
                <li key={`${film.discipline}:${film.filmId}`}>
                  <span>{NAMES[film.discipline] ?? film.discipline}</span>
                  <strong>{film.title}</strong>
                  <em>{[film.year > 0 ? film.year : null, film.company].filter(Boolean).join(" · ")}</em>
                </li>
              ))}
            </ul>
          ) : (
            <p>Nothing saved yet. Open a film and choose My list.</p>
          )}
          {error ? <p>{error}</p> : null}
          <p>
            <button type="button" className="cookies-clear" disabled={busy} onClick={() => { setBusy(true); void signOut("/account").catch(() => setBusy(false)); }}>
              Log out
            </button>
          </p>
        </>
      ) : (
        <>
          <p>Sign in with Google, X, or an email and password. An account is created for you, and your list of films is kept on it.</p>
          <button
            type="button"
            className="btn-google"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              setError("");
              void signIn("grok-google", { callbackURL: "/account", errorCallbackURL: "/account" }).catch((reason: unknown) => {
                setBusy(false);
                setError(signInError(reason));
              });
            }}
          >
            <GoogleMark />
            {busy ? "Opening…" : "Sign in with Google"}
          </button>
          <button
            type="button"
            className="btn-google"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              setError("");
              void signIn("grok-x", { callbackURL: "/account", errorCallbackURL: "/account" }).catch((reason: unknown) => {
                setBusy(false);
                setError(signInError(reason));
              });
            }}
          >
            <XMark />
            {busy ? "Opening…" : "Sign in with X"}
          </button>
          <EmailSignIn />
          {error ? <p>{error}</p> : null}
        </>
      )}
    </main>
  );
}

function EmailSignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const address = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) || password.length < 8) {
      setError("Use an email and a password of at least 8 characters.");
      return;
    }
    setBusy(true);
    setError("");
    const signed = await authClient.signIn.email({ email: address, password, callbackURL: "/account" });
    if (!signed.error) {
      if (signed.data?.token) rememberSessionToken(signed.data.token);
      window.location.assign("/account");
      return;
    }
    const created = await authClient.signUp.email({
      email: address,
      password,
      name: address.split("@")[0] || "Reader",
      callbackURL: "/account",
    });
    if (!created.error) {
      if (created.data?.token) rememberSessionToken(created.data.token);
      window.location.assign("/account");
      return;
    }
    setBusy(false);
    const message = created.error.message ?? "";
    setError(/exist/i.test(message) ? "That password doesn’t match this email." : message || "Sign-in didn’t finish.");
  }

  return (
    <form className="account-form" onSubmit={submit}>
      <label>
        Email
        <input type="email" name="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
      </label>
      <label>
        Password
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      <button className="cookies-clear" type="submit" disabled={busy}>
        {busy ? "Signing in…" : "Sign in with email"}
      </button>
      {error ? <p>{error}</p> : null}
    </form>
  );
}

function XMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.727-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function signInError(reason: unknown) {
  const message = reason instanceof Error ? reason.message : "Sign-in didn’t finish.";
  if (/redirect|callback/i.test(message)) return "Google and X can’t return to this site. Use email and a password — that creates the account.";
  return message;
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
    </svg>
  );
}
