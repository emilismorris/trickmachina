import { createFileRoute, useRouter } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { authClient, rememberSessionToken, signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { currentAccount, listFavorites, toggleFavorite, type SavedFilm } from "@/lib/list.functions";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/account")({
  head: () => pageHead("Log in — Trick Machina", "Sign in and keep a list of films.", "/account"),
  loader: () => currentAccount(),
  component: Account,
});

const PENDING = "tm-pending-favorite";
const NAMES: Record<string, string> = { skate: "Skate", bmx: "BMX", blades: "Blades", scoot: "Scoot" };

function Account() {
  const router = useRouter();
  const { email: serverEmail } = Route.useLoaderData();
  const { user, isPending } = useCurrentUserState();
  const clientUser = Boolean(user && !user.isDevFallback);
  const signedIn = Boolean(serverEmail || clientUser);
  const email = user?.primaryEmail || serverEmail;
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
    if (!signedIn || (isPending && !serverEmail)) return;
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
  }, [isPending, serverEmail, signedIn]);

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
      {isPending && !signedIn ? null : signedIn ? (
        <>
          <p>Signed in as {user?.displayName || email}. Films you mark My list stay on this account.</p>
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
          <p>Use email and a password. A new address creates the account, and your list of films stays on it.</p>
          <EmailSignIn />
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
    try {
      const signed = await authClient.signIn.email({ email: address, password });
      if (!signed.error) {
        if (signed.data?.token) rememberSessionToken(signed.data.token);
        window.location.assign("/account");
        return;
      }
      const created = await authClient.signUp.email({
        email: address,
        password,
        name: address.split("@")[0] || "Reader",
      });
      if (!created.error) {
        if (created.data?.token) rememberSessionToken(created.data.token);
        window.location.assign("/account");
        return;
      }
      const message = created.error.message ?? signed.error.message ?? "";
      setError(/exist/i.test(message) ? "That password doesn’t match this email." : message || "Sign-in didn’t finish.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sign-in didn’t finish.");
    }
    setBusy(false);
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
