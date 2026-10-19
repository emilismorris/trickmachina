import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminGoogleButton } from "@/components/admin-google";
import { TrafficMap } from "@/components/traffic-map";
import { ANALYTICS_WEEK, deskStats, weekMapPins } from "@/data/analytics-week";
import { isAdminEmail } from "@/lib/admin-email";
import { getAdminDashboard, type VisitRange } from "@/lib/admin.functions";
import { signOut } from "@/lib/auth/client";
import { hasGateSessionMarker } from "@/lib/auth/gate-session-marker";
import { RedirectToSignIn, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

type Dashboard = Awaited<ReturnType<typeof getAdminDashboard>>;

export const Route = createFileRoute("/admin")({
  headers: () => ({
    "X-Robots-Tag": "noindex, nofollow",
  }),
  head: () => ({
    meta: [
      { title: "Admin — Trick Machina" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminPage,
});

const PAGES: Record<string, { title: string; screen: string }> = {
  "/": { title: "Trick Machina", screen: "Landing" },
  "/skate": { title: "Skate — Trick Machina", screen: "Skate" },
  "/bmx": { title: "BMX — Trick Machina", screen: "BMX" },
  "/blades": { title: "Blades — Trick Machina", screen: "Blades" },
  "/scoot": { title: "Scoot — Trick Machina", screen: "Scoot" },
  "/cookies": { title: "Cookies — Trick Machina", screen: "Cookies" },
};

function pageMeta(path: string) {
  return PAGES[path] ?? { title: path, screen: "Page" };
}

function sourceMedium(label: string) {
  if (label.includes(" / ")) return label;
  if (label === "(direct)") return "(direct) / (none)";
  return `${label} / referral`;
}

function AdminPage() {
  const { user, isPending } = useCurrentUserState();
  const admin = Boolean(user && isAdminEmail(user.primaryEmail));
  const [data, setData] = useState<Dashboard | null>(null);
  const [failed, setFailed] = useState(false);
  const [range, setRange] = useState<VisitRange>("7");

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

  const stats = deskStats(data?.report ?? null, range);
  const pages = stats.pages.map((row) => ({ ...row, ...pageMeta(row.label) }));
  const maxPage = Math.max(1, ...pages.map((row) => row.hits));
  const countries = stats.countries;
  const maxCountry = Math.max(1, ...countries.map((row) => row.hits));
  const sources = (stats.sources ?? []).map((row) => ({ ...row, label: sourceMedium(row.label) }));
  const pins = weekMapPins(data?.pins ?? [], countries);
  const rangeLabel = range === "7" ? "Last 7 days" : range === "28" ? "Last 28 days" : "All time";

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
        <p className="admin-note">
          {rangeLabel}. {stats.users.toLocaleString("en-US")} active users, {stats.views.toLocaleString("en-US")} visits.
        </p>
        {failed ? <p className="admin-warn">The live count didn’t load. This is the Analytics week.</p> : null}
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
        <section className="stat-grid" aria-label="Analytics">
          <Stat label="Active users" value={stats.users} />
          <Stat label="New users" value={stats.newUsers} />
          <Stat label="Visits" value={stats.views} />
          <Stat label="Events" value={stats.events} />
        </section>
        <p className="engage">
          Average engagement time <strong>{stats.engagement ?? ANALYTICS_WEEK.engagement}</strong>
        </p>
            <section className="admin-block">
              <div className="block-head">
                <h2>Views by page title and screen class</h2>
                <strong>{stats.views.toLocaleString("en-US")}</strong>
              </div>
              {pages.length === 0 ? (
                <p className="admin-note">None yet.</p>
              ) : (
              <ul className="hit-list path-list">
                {pages.map((row) => (
                  <li key={row.label}>
                    <span>{row.title}</span>
                    <span className="screen-class">{row.screen}</span>
                    <span className="hit-track" aria-hidden="true">
                      <span style={{ width: `${(row.hits / maxPage) * 100}%` }} />
                    </span>
                    <strong>{row.hits.toLocaleString("en-US")}</strong>
                  </li>
                ))}
              </ul>
              )}
              <h3>Active users by country</h3>
              {countries.length === 0 ? (
                <p className="admin-note">None yet.</p>
              ) : (
              <ul className="hit-list country-list">
                {countries.map((row) => {
                  const share = stats.users > 0 ? (row.hits / stats.users) * 100 : 0;
                  return (
                    <li key={row.label}>
                      <span>{row.label}</span>
                      <span className="share">{share.toFixed(1)}%</span>
                      <span className="hit-track" aria-hidden="true">
                        <span style={{ width: `${(row.hits / maxCountry) * 100}%` }} />
                      </span>
                      <strong>{row.hits.toLocaleString("en-US")}</strong>
                    </li>
                  );
                })}
              </ul>
              )}
              <h2 className="map-title">Where they come from</h2>
              <p className="admin-note map-note">
                {countries.length.toLocaleString("en-US")} {countries.length === 1 ? "country" : "countries"} in {rangeLabel.toLowerCase()}
                {pins.length > countries.length
                  ? `, plus ${(pins.length - countries.length).toLocaleString("en-US")} ${pins.length - countries.length === 1 ? "address" : "addresses"} counted here`
                  : ""}
                . Zoom the map, or choose a place.
              </p>
              <TrafficMap pins={pins} />
              <h3>Session source / medium</h3>
              {sources.length === 0 ? (
                <p className="admin-note">The export had no source table. New visits record source and medium here.</p>
              ) : (
                <MetricList rows={sources} />
              )}
              <h3>Device</h3>
              <MetricList rows={data?.report.devices ?? []} />
              <h3>Browser</h3>
              <MetricList rows={data?.report.browsers ?? []} />
              <h3>Language</h3>
              <MetricList rows={data?.report.languages ?? []} />
            </section>
            <section className="admin-block">
              <h2>Archive</h2>
              <section className="stat-grid" aria-label="Archive">
                <Stat label="Films" value={data?.archive.films ?? 0} />
                <Stat label="Playable" value={data?.archive.playable ?? 0} />
              </section>
            </section>
            {data ? (
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
            ) : null}
      </div>
    </main>
  );
}

function MetricList({ rows, max }: { rows: { label: string; hits: number }[]; max?: number }) {
  const top = Math.max(1, max ?? Math.max(1, ...rows.map((row) => row.hits)));
  if (rows.length === 0) return <p className="admin-note">None yet.</p>;
  return (
    <ul className="hit-list">
      {rows.map((row) => (
        <li key={row.label}>
          <span>{row.label}</span>
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
