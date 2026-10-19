import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminGoogleButton } from "@/components/admin-google";
import { TrafficMap } from "@/components/traffic-map";
import { isAdminEmail } from "@/lib/admin-email";
import { getAdminDashboard, type VisitRange } from "@/lib/admin.functions";
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

const SCREEN_CLASS: Record<string, string> = {
  "/": "Landing",
  "/skate": "Skate",
  "/bmx": "BMX",
  "/blades": "Blades",
  "/scoot": "Scoot",
  "/cookies": "Cookies",
};

function screenClass(path: string) {
  return SCREEN_CLASS[path] ?? "Page";
}

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
  const [range, setRange] = useState<VisitRange>("28");

  useEffect(() => {
    if (isPending || !user || admin) return;
    if (hasGateSessionMarker()) return;
    void signOut("/login?refused=1").catch(() => {});
  }, [admin, isPending, user]);

  useEffect(() => {
    if (!admin || !user) return;
    let cancel = false;
    setFailed(false);
    getAdminDashboard({ data: range })
      .then((next) => {
        if (!cancel) setData(next);
      })
      .catch(() => {
        if (!cancel) setFailed(true);
      });
    return () => {
      cancel = true;
    };
  }, [admin, range, user?.id]);

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
  const visits =
    HIT_KEYS.reduce((sum, key) => sum + (key === "play" || key === "search" ? 0 : (hits.get(key) ?? 0)), 0) +
    (data?.report.views ?? 0);
  const pages = data?.report.pages ?? [];
  const maxPage = Math.max(1, ...pages.map((row) => row.hits));
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
              <h2>Audience</h2>
              <p className="admin-note">Counted on this site, the same reports as Analytics. Older Google numbers are not included.</p>
              <div className="range" role="group" aria-label="Date range">
                {(
                  [
                    ["7", "7 days"],
                    ["28", "28 days"],
                    ["all", "All time"],
                  ] as const
                ).map(([value, label]) => (
                  <button key={value} type="button" className={range === value ? "is-on" : ""} onClick={() => setRange(value)}>
                    {label}
                  </button>
                ))}
              </div>
              <section className="stat-grid" aria-label="Audience totals">
                <Stat label="Users" value={data.report.users} />
                <Stat label="New users" value={data.report.newUsers} />
                <Stat label="Sessions" value={data.report.sessions} />
                <Stat label="Views" value={data.report.views} />
              </section>
              <h3>Page path and screen class</h3>
              <MetricList rows={pages} max={maxPage} screen />
              <h3>Session source</h3>
              <MetricList rows={data.report.sources} />
              <h3>Country</h3>
              <MetricList rows={data.report.countries} />
              <h3>Device</h3>
              <MetricList rows={data.report.devices} />
              <h3>Browser</h3>
              <MetricList rows={data.report.browsers} />
              <h3>Language</h3>
              <MetricList rows={data.report.languages} />
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

function MetricList({ rows, max, screen = false }: { rows: { label: string; hits: number }[]; max?: number; screen?: boolean }) {
  const top = Math.max(1, max ?? Math.max(1, ...rows.map((row) => row.hits)));
  if (rows.length === 0) return <p className="admin-note">None yet.</p>;
  return (
    <ul className={screen ? "hit-list path-list" : "hit-list"}>
      {rows.map((row) => (
        <li key={row.label}>
          <span>{row.label}</span>
          {screen ? <span className="screen-class">{screenClass(row.label)}</span> : null}
          <span className="hit-track" aria-hidden="true">
            <span style={{ width: `${(row.hits / top) * 100}%` }} />
          </span>
          <strong>{row.hits.toLocaleString("en-US")}</strong>
        </li>
      ))}
    </ul>
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
