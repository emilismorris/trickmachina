import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminGoogleButton } from "@/components/admin-google";
import { TrafficMap } from "@/components/traffic-map";
import { isAdminEmail } from "@/lib/admin-email";
import { getAdminDashboard } from "@/lib/admin.functions";
import { signOut } from "@/lib/auth/client";
import { hasGateSessionMarker } from "@/lib/auth/gate-session-marker";
import { RedirectToSignIn, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { HIT_KEYS } from "@/lib/hits";

type Dashboard = Awaited<ReturnType<typeof getAdminDashboard>>;

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Trick Machina" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminPage,
});

const HIT_LABELS: Record<(typeof HIT_KEYS)[number], string> = {
  landing: "Landing",
  skate: "Skate opens",
  bmx: "BMX opens",
  blades: "Blades opens",
  scoot: "Scoot opens",
  play: "Plays",
  search: "Searches",
};

function AdminPage() {
  const { user, isPending } = useCurrentUserState();
  const admin = Boolean(user && isAdminEmail(user.primaryEmail));
  const [data, setData] = useState<Dashboard | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (isPending || !user || admin) return;
    if (hasGateSessionMarker()) return;
    void signOut("/login?refused=1").catch(() => {});
  }, [admin, isPending, user]);

  useEffect(() => {
    if (!admin || !user) return;
    let cancel = false;
    getAdminDashboard()
      .then((next) => {
        if (!cancel) setData(next);
      })
      .catch(() => {
        if (!cancel) setFailed(true);
      });
    return () => {
      cancel = true;
    };
  }, [admin, user?.id]);

  if (isPending) {
    return (
      <main className="admin">
        <p className="admin-note">Checking the session</p>
      </main>
    );
  }
  if (!user) return <RedirectToSignIn />;
  if (!admin) {
    return (
      <main className="admin-auth">
        <section className="admin-card">
          <p className="kicker">Admin</p>
          <h1>Closed</h1>
          <p className="admin-note">This Google account isn’t the admin.</p>
          <AdminGoogleButton />
          <Link to="/" className="btn-ghost admin-back">
            Back to the floor
          </Link>
        </section>
      </main>
    );
  }

  const hits = new Map((data?.traffic ?? []).map((row) => [row.key, row.hits]));
  const visits = HIT_KEYS.reduce((sum, key) => sum + (key === "play" || key === "search" ? 0 : (hits.get(key) ?? 0)), 0);
  const maxHit = Math.max(1, ...HIT_KEYS.map((key) => hits.get(key) ?? 0));

  return (
    <main className="admin">
      <header className="admin-bar">
        <Link to="/" className="wordmark" aria-label="Trick Machina home">
          <img src="/media/wordmark.webp" alt="Trick Machina" />
        </Link>
        <p className="discipline-name">Admin</p>
        <UserButton />
      </header>
      <div className="admin-wrap">
        <p className="kicker">{data?.email ?? user.primaryEmail}</p>
        <h1>Desk</h1>
        <p className="admin-note">Who came through, and what’s on the floor.</p>
        {failed ? <p className="admin-warn">The numbers didn’t load.</p> : null}
        {!data && !failed ? <p className="admin-note">Counting the archive</p> : null}
        {data ? (
          <>
            <section className="stat-grid" aria-label="Totals">
              <Stat label="Films" value={data.archive.films} />
              <Stat label="Playable" value={data.archive.playable} />
              <Stat label="Visits" value={visits} />
              <Stat label="Plays" value={hits.get("play") ?? 0} />
            </section>
            <section className="admin-block">
              <h2>Where they come from</h2>
              <p className="admin-note map-note">
                {data.pins.length.toLocaleString("en-US")} {data.pins.length === 1 ? "address" : "addresses"}. Zoom the map, or choose a place.
              </p>
              <TrafficMap pins={data.pins} />
            </section>
            <section className="admin-block">
              <h2>Traffic</h2>
              <ul className="hit-list">
                {HIT_KEYS.map((key) => {
                  const count = hits.get(key) ?? 0;
                  return (
                    <li key={key}>
                      <span>{HIT_LABELS[key]}</span>
                      <span className="hit-track" aria-hidden="true">
                        <span style={{ width: `${(count / maxHit) * 100}%` }} />
                      </span>
                      <strong>{count.toLocaleString("en-US")}</strong>
                    </li>
                  );
                })}
              </ul>
            </section>
            <section className="admin-block">
              <h2>Disciplines</h2>
              <div className="discipline-grid">
                {data.archive.disciplines.map((item) => (
                  <article key={item.id} className="discipline-card">
                    <p className="kicker">{item.yearMin && item.yearMax ? `${item.yearMin}–${item.yearMax}` : "Archive"}</p>
                    <h3>{item.name}</h3>
                    <p className="discipline-count">
                      {item.films.toLocaleString("en-US")} films
                      <span>
                        {item.playable.toLocaleString("en-US")} playable · {item.shelves} shelves
                      </span>
                    </p>
                    <h4>Companies</h4>
                    <ul>
                      {item.companies.map((company) => (
                        <li key={company.name}>
                          <span>{company.name}</span>
                          <span>{company.count.toLocaleString("en-US")}</span>
                        </li>
                      ))}
                    </ul>
                    <h4>Largest shelves</h4>
                    <ul>
                      {item.largestShelves.map((shelf) => (
                        <li key={shelf.title}>
                          <span>{shelf.title}</span>
                          <span>{shelf.count.toLocaleString("en-US")}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <article className="stat">
      <p>{label}</p>
      <strong>{value.toLocaleString("en-US")}</strong>
    </article>
  );
}
