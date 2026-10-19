import { Link } from "@tanstack/react-router";
import { Check, ChevronLeft, ChevronRight, Menu, Play, Plus, Search, X } from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { Catalog, CatalogView, Film, RowShelf, Shelf, Watch } from "@/data/types";
import { track } from "@/lib/track";
import { trackEvent } from "@/lib/ga";

const PAGE = 48;

function tone(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 33 + id.charCodeAt(i)) >>> 0;
  return hash % 6;
}

function filmsFrom(ids: string[], films: Record<string, Film>) {
  return ids.map((id) => films[id]).filter((film): film is Film => Boolean(film));
}

const INLINE = 56;
const ROW_CAP = 32;

type ShelfGroup = { id: string; title: string; films: Film[] };

function pushGroup(map: Map<string, Film[]>, key: string, film: Film) {
  const list = map.get(key);
  if (list) list.push(film);
  else map.set(key, [film]);
}

function splitShelf(films: Film[]): ShelfGroup[] {
  const one = [{ id: "all", title: "All", films }];
  if (films.length <= INLINE) return one;

  const byYear = new Map<number, Film[]>();
  for (const film of films) {
    const year = film.year >= 1900 ? film.year : 0;
    const list = byYear.get(year);
    if (list) list.push(film);
    else byYear.set(year, [film]);
  }
  const undated = byYear.get(0);
  const years = [...byYear.entries()].filter(([year]) => year > 0).sort((a, b) => b[0] - a[0]);
  const withUndated = (groups: ShelfGroup[]) => {
    if (undated?.length) groups.push({ id: "undated", title: "Undated", films: undated });
    return groups;
  };

  if (years.length >= 2 && years.length <= 50) {
    const datedCount = films.length - (undated?.length ?? 0);
    if (datedCount / years.length >= 10) {
      return withUndated(years.map(([year, list]) => ({ id: String(year), title: String(year), films: list })));
    }
  }

  if (years.length >= 2) {
    const byDecade = new Map<number, Film[]>();
    for (const [year, list] of years) {
      const decade = Math.floor(year / 10) * 10;
      const bucket = byDecade.get(decade);
      if (bucket) bucket.push(...list);
      else byDecade.set(decade, [...list]);
    }
    const decades = [...byDecade.entries()].sort((a, b) => b[0] - a[0]);
    if (decades.length >= 2 && decades.length < years.length && (films.length - (undated?.length ?? 0)) / decades.length >= 16) {
      return withUndated(decades.map(([decade, list]) => ({ id: String(decade), title: `${decade}s`, films: list })));
    }
  }

  if (films.length > 180) {
    const byLetter = new Map<string, Film[]>();
    for (const film of films) {
      const ch = film.title.trim().charAt(0).toUpperCase();
      pushGroup(byLetter, /[A-Z]/.test(ch) ? ch : "#", film);
    }
    const letters = [...byLetter.entries()].sort((a, b) => {
      if (a[0] === "#") return 1;
      if (b[0] === "#") return -1;
      return a[0].localeCompare(b[0]);
    });
    if (letters.length >= 4) {
      return letters.map(([letter, list]) => ({ id: letter, title: letter, films: list }));
    }
  }

  return one;
}

function previewIds(shelf: { filmIds: string[]; previewIds?: string[] }) {
  const source = shelf.previewIds?.length ? shelf.previewIds : shelf.filmIds;
  return source.length > ROW_CAP ? source.slice(0, ROW_CAP) : source;
}

const DAY_MS = 86_400_000;

function dayNumber(now = Date.now()) {
  return Math.floor(now / DAY_MS);
}

function mixKey(day: number, shelfId: string, filmId: string) {
  let hash = Math.imul(day + 1, 374761393);
  const text = `${shelfId}\0${filmId}`;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return hash >>> 0;
}

function dailyHomeIds(shelf: { id: string; filmIds: string[] }, day: number) {
  const count = Math.min(9, shelf.filmIds.length);
  const ranked = [...shelf.filmIds].sort((a, b) => mixKey(day, shelf.id, a) - mixKey(day, shelf.id, b) || (a < b ? -1 : 1));
  return ranked.slice(0, count);
}

function embedSrc(watch: Watch, part = 0) {
  if (watch.host === "youtube") return `https://www.youtube-nocookie.com/embed/${watch.id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;
  if (watch.host === "youtube-list") return `https://www.youtube-nocookie.com/embed/videoseries?list=${watch.id}&autoplay=1&rel=0`;
  if (watch.host === "parts") {
    const id = watch.parts[part]?.id ?? watch.parts[0]?.id;
    return id ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1` : null;
  }
  if (watch.host === "vimeo") return `https://player.vimeo.com/video/${watch.id}?autoplay=1`;
  if (watch.host === "archive") return `https://archive.org/embed/${watch.id}`;
  if (watch.host === "wawax") return `https://videoarchive.wawax.info/videos/embed/${watch.id}?autoplay=1`;
  return null;
}

function canPlay(watch: Watch) {
  return watch.host !== "none" && watch.host !== "link";
}

function useSaved(discipline: string) {
  const key = `tm-list:${discipline}`;
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      if (Array.isArray(parsed)) setIds(parsed.filter((id) => typeof id === "string"));
    } catch {
      setIds([]);
    }
  }, [key]);
  const toggle = (id: string) => {
    setIds((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [id, ...current].slice(0, 40);
      localStorage.setItem(key, JSON.stringify(next));
      return next;
    });
  };
  return { ids, toggle };
}

function Card({ film, shape, onOpen }: { film: Film; shape: Catalog["shape"]; onOpen: (film: Film) => void }) {
  return (
    <button type="button" className={`card card-${shape}`} onClick={() => onOpen(film)}>
      <span className={`card-art tone-${tone(film.id)}`}>
        <span className="card-fallback">{film.company || film.title}</span>
        {film.thumb ? <img src={film.thumb} alt="" loading="lazy" decoding="async" onError={(event) => (event.currentTarget.style.display = "none")} /> : null}
      </span>
      <span className="card-meta">{[film.year > 0 ? film.year : null, film.company].filter(Boolean).join(" · ")}</span>
      <span className="card-title">{film.title}</span>
    </button>
  );
}

function ShelfRow({
  title,
  note,
  films,
  total,
  shape,
  onOpen,
  onTitle,
  hideHead,
}: {
  title: string;
  note?: string;
  films: Film[];
  total?: number;
  shape: Catalog["shape"];
  onOpen: (film: Film) => void;
  onTitle?: () => void;
  hideHead?: boolean;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const strideRef = useRef(0);
  const gapRef = useRef(0);
  const virtual = films.length > 24;
  const [span, setSpan] = useState({ start: 0, end: Math.min(films.length, virtual ? 10 : films.length) });
  const [stride, setStride] = useState(0);

  useEffect(() => {
    if (!virtual) return;
    const node = scroller.current;
    if (!node) return;
    let frame = 0;
    const update = () => {
      const cards = node.querySelectorAll<HTMLElement>(".card");
      if (cards.length >= 2) {
        const delta = Math.round(cards[1].getBoundingClientRect().left - cards[0].getBoundingClientRect().left);
        if (delta > 40 && delta !== strideRef.current) {
          strideRef.current = delta;
          gapRef.current = parseFloat(getComputedStyle(node).columnGap || "0") || 0;
          setStride(delta);
        }
      }
      const step = strideRef.current;
      if (!step) return;
      const start = Math.max(0, Math.floor(node.scrollLeft / step) - 3);
      const end = Math.min(films.length, start + 16);
      setSpan((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
    };
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    update();
    node.addEventListener("scroll", onScroll, { passive: true });
    const observer = new ResizeObserver(onScroll);
    observer.observe(node);
    return () => {
      cancelAnimationFrame(frame);
      node.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, [films.length, virtual]);

  if (!films.length) return null;
  const start = virtual ? span.start : 0;
  const end = virtual ? span.end : films.length;
  const gap = gapRef.current;
  const lead = virtual && start > 0 && stride ? Math.max(0, start * stride - gap) : 0;
  const tailCount = films.length - end;
  const tail = virtual && tailCount > 0 && stride ? Math.max(0, tailCount * stride - gap) : 0;
  const scroll = (direction: number) => {
    const node = scroller.current;
    if (!node) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollBy({ left: direction * Math.max(node.clientWidth * 0.82, 220), behavior: reduce ? "auto" : "smooth" });
  };
  const heading = (
    <>
      <h2>{title}</h2>
      {typeof total === "number" ? <span className="shelf-count">{total.toLocaleString("en-US")}</span> : null}
      {onTitle ? <span>See all</span> : null}
    </>
  );
  return (
    <section className="shelf" aria-label={title || "Films"}>
      {hideHead ? null : (
        <div className="shelf-head">
          {onTitle ? (
            <button type="button" className="shelf-title" onClick={onTitle}>
              {heading}
            </button>
          ) : (
            <div className="shelf-title">{heading}</div>
          )}
          {note ? <p>{note}</p> : null}
        </div>
      )}
      <div className="shelf-scroller">
        <button type="button" className="shelf-arrow prev" aria-label={`Scroll ${title || "films"} left`} onClick={() => scroll(-1)}>
          <ChevronLeft aria-hidden="true" />
        </button>
        <div className="shelf-row" ref={scroller}>
          {lead > 0 ? <span className="shelf-spacer" style={{ width: lead }} /> : null}
          {films.slice(start, end).map((film) => (
            <Card key={film.id} film={film} shape={shape} onOpen={onOpen} />
          ))}
          {tail > 0 ? <span className="shelf-spacer" style={{ width: tail }} /> : null}
        </div>
        <button type="button" className="shelf-arrow next" aria-label={`Scroll ${title || "films"} right`} onClick={() => scroll(1)}>
          <ChevronRight aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}

function GroupRows({
  films,
  shape,
  onOpen,
  onDrill,
}: {
  films: Film[];
  shape: Catalog["shape"];
  onOpen: (film: Film) => void;
  onDrill: (title: string, filmIds: string[]) => void;
}) {
  const rows = useMemo(() => {
    const groups = splitShelf(films);
    return groups.map((group) => {
      const drill = group.films.length > INLINE && splitShelf(group.films).length > 1;
      return {
        id: group.id,
        title: group.title,
        total: group.films.length,
        films: drill ? group.films.slice(0, 18) : group.films,
        drillIds: drill ? group.films.map((film) => film.id) : null,
      };
    });
  }, [films]);

  if (rows.length === 1 && rows[0]?.title === "All") {
    return <ShelfRow title="Films" hideHead films={rows[0].films} shape={shape} onOpen={onOpen} />;
  }
  return (
    <>
      {rows.map((row) => (
        <ShelfRow
          key={row.id}
          title={row.title}
          total={row.total}
          films={row.films}
          shape={shape}
          onOpen={onOpen}
          onTitle={
            row.drillIds
              ? () => {
                  const ids = row.drillIds;
                  if (ids) onDrill(row.title, ids);
                }
              : undefined
          }
        />
      ))}
    </>
  );
}

function Grid({ films, shape, onOpen, limit, onMore }: { films: Film[]; shape: Catalog["shape"]; onOpen: (film: Film) => void; limit: number; onMore: () => void }) {
  const shown = films.slice(0, limit);
  return (
    <>
      <div className={`result-grid shape-${shape}`}>
        {shown.map((film) => (
          <Card key={film.id} film={film} shape={shape} onOpen={onOpen} />
        ))}
      </div>
      {films.length > shown.length ? (
        <button type="button" className="btn-ghost more" onClick={onMore}>
          Show more ({films.length - shown.length} left)
        </button>
      ) : null}
    </>
  );
}

function Player({ film }: { film: Film }) {
  const [part, setPart] = useState(0);
  useEffect(() => setPart(0), [film.id]);
  const watch = film.watch;
  if (watch.host === "link") {
    return (
      <a className="btn-play external" href={watch.url} target="_blank" rel="noreferrer">
        Watch at the source
      </a>
    );
  }
  if (watch.host === "none") {
    const query = encodeURIComponent(`${film.company} ${film.title} ${film.year || ""}`.trim());
    return (
      <p className="quiet">
        No public upload in the archive.{" "}
        <a href={`https://www.youtube.com/results?search_query=${query}`} target="_blank" rel="noreferrer">
          Search YouTube
        </a>
      </p>
    );
  }
  const src = embedSrc(watch, part);
  return (
    <div className="player">
      {watch.host === "parts" ? (
        <div className="parts" role="tablist" aria-label="Parts">
          {watch.parts.map((item, index) => (
            <button key={item.id} type="button" role="tab" aria-selected={index === part} onClick={() => setPart(index)}>
              {item.title}
            </button>
          ))}
        </div>
      ) : null}
      {src ? <iframe className="player-frame" src={src} title={film.title} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /> : null}
      {"credit" in watch && watch.credit ? <p className="quiet">{watch.credit}</p> : null}
    </div>
  );
}

export function CatalogScreen({ catalog, onNeedMore }: { catalog: Catalog; onNeedMore?: () => void }) {
  const [view, setView] = useState("home");
  const [focus, setFocus] = useState<{ title: string; note?: string; parent?: string; filmIds: string[]; shelves?: RowShelf[] }[]>([]);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [menu, setMenu] = useState(false);
  const [solid, setSolid] = useState(false);
  const [active, setActive] = useState<Film | null>(null);
  const [playing, setPlaying] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [day, setDay] = useState(dayNumber);
  const searchRef = useRef<HTMLInputElement>(null);
  const saved = useSaved(catalog.id);
  const more = useRef<HTMLDivElement>(null);

  const heroId = catalog.heroIds.length ? catalog.heroIds[day % catalog.heroIds.length] : catalog.featuredId;
  const hero = catalog.films[heroId] ?? catalog.films[catalog.featuredId];

  useEffect(() => {
    const wait = DAY_MS - (Date.now() % DAY_MS) + 250;
    const timer = window.setTimeout(() => setDay(dayNumber()), wait);
    return () => window.clearTimeout(timer);
  }, [day]);

  useEffect(() => {
    const node = more.current;
    if (!node || !onNeedMore) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) onNeedMore();
    }, { rootMargin: "600px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [onNeedMore]);

  useEffect(() => {
    const onScroll = () => {
      const next = window.scrollY > 12;
      setSolid((current) => (current === next ? current : next));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActive(null);
        setPlaying(false);
      }
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [active]);

  useEffect(() => {
    if (searching) searchRef.current?.focus();
  }, [searching]);

  useEffect(() => {
    if (query.trim().length >= 2) {
      onNeedMore?.();
      track("search", query.trim().toLowerCase());
    }
  }, [query, onNeedMore]);

  useEffect(() => {
    if (playing && active) {
      track("play", active.id);
      trackEvent("play", { film_id: active.id, film_title: active.title, discipline: catalog.id });
    }
  }, [playing, active, catalog.id]);

  useEffect(() => {
    setLimit(PAGE);
  }, [view, focus, query]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return Object.values(catalog.films)
      .filter((film) => `${film.title} ${film.company} ${film.year} ${film.blurb}`.toLowerCase().includes(q))
      .sort((a, b) => a.year - b.year || a.title.localeCompare(b.title))
      .slice(0, 120);
  }, [catalog.films, query]);

  const openFilm = (film: Film) => {
    setActive(film);
    setPlaying(false);
    setMenu(false);
    trackEvent("film_open", { film_id: film.id, film_title: film.title, discipline: catalog.id });
  };

  const go = (id: string) => {
    if (id !== "home" && !catalog.views[id]) onNeedMore?.();
    setView(id);
    setFocus([]);
    setQuery("");
    setSearching(false);
    setMenu(false);
    window.scrollTo({ top: 0 });
  };

  const showShelf = (title: string, filmIds: string[], parent?: string, note?: string, shelves?: RowShelf[]) => {
    setFocus([{ title, note, parent, filmIds, shelves }]);
    setQuery("");
    setSearching(false);
    setMenu(false);
    window.scrollTo({ top: 0 });
  };

  const drillShelf = (title: string, filmIds: string[], parent?: string) => {
    setFocus((stack) => [...stack, { title, parent, filmIds }]);
    window.scrollTo({ top: 0 });
  };

  const openShelf = (shelf: Shelf | RowShelf) => {
    const known = catalog.views[shelf.id];
    if (known) {
      go(shelf.id);
      return;
    }
    showShelf(shelf.title, shelf.filmIds, undefined, shelf.note, "shelves" in shelf ? shelf.shelves : undefined);
  };

  const current: CatalogView | null = view !== "home" ? (catalog.views[view] ?? null) : null;
  const focusTop = focus[focus.length - 1] ?? null;
  const savedFilms = filmsFrom(saved.ids, catalog.films);
  const searchingNow = query.trim().length >= 2;
  const viewFilms = useMemo(
    () => (current?.mode === "grid" ? filmsFrom(current.filmIds ?? [], catalog.films) : []),
    [current, catalog.films],
  );
  const focusFilms = useMemo(() => (focusTop ? filmsFrom(focusTop.filmIds, catalog.films) : []), [focusTop, catalog.films]);

  return (
    <div className="catalog" data-id={catalog.id} data-shape={catalog.shape}>
      <header className={solid || view !== "home" ? "topnav is-solid" : "topnav"}>
        <Link to="/" className="wordmark" aria-label="Trick Machina home">
          <img src="/media/wordmark.webp" alt="Trick Machina" />
        </Link>
        <p className="discipline-name">{catalog.name}</p>
        <button type="button" className="icon-btn menu-btn" aria-label={menu ? "Close menu" : "Open menu"} aria-expanded={menu} onClick={() => setMenu((open) => !open)}>
          {menu ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
        <nav className={menu ? "nav-links is-open" : "nav-links"} aria-label="Browse">
          <Link to="/" className="nav-link nav-back" aria-label="Back to the archive" onClick={() => setMenu(false)}>
            <ChevronLeft aria-hidden="true" />
            Back
          </Link>
          {catalog.nav.map((item) => (
            <button key={item.id} type="button" className="nav-link" aria-pressed={view === item.id && !searchingNow} onClick={() => go(item.id)}>
              {item.label}
            </button>
          ))}
          <Link to="/contact" className="nav-link" onClick={() => setMenu(false)}>
            Contact
          </Link>
          <Link to="/about" className="nav-link" onClick={() => setMenu(false)}>
            About
          </Link>
          <Link to="/cookies" className="nav-link" onClick={() => setMenu(false)}>
            Cookies
          </Link>
        </nav>
        <div className={searching ? "nav-tools is-search" : "nav-tools"}>
          {searching ? (
            <label className="nav-search">
              <Search aria-hidden="true" />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Titles, brands"
                aria-label="Search films"
              />
              <button
                type="button"
                className="icon-btn"
                aria-label="Close search"
                onClick={() => {
                  setQuery("");
                  setSearching(false);
                }}
              >
                <X aria-hidden="true" />
              </button>
            </label>
          ) : (
            <button type="button" className="icon-btn" aria-label="Search" onClick={() => setSearching(true)}>
              <Search aria-hidden="true" />
            </button>
          )}
        </div>
      </header>
      <Link to="/admin" className="admin-chip">
        Admin
      </Link>

      {searchingNow ? (
        <main className="archive">
          <div className="browse-head">
            <h1>“{query.trim()}”</h1>
            <p>
              {results.length} {results.length === 1 ? "film" : "films"}
            </p>
          </div>
          {results.length ? (
            <Grid films={results} shape={catalog.shape} onOpen={openFilm} limit={limit} onMore={() => setLimit((n) => n + PAGE)} />
          ) : (
            <p className="empty-note">Nothing under that.</p>
          )}
        </main>
      ) : focusTop ? (
        <main className="shelf-page">
          <div className="browse-head">
            <button
              type="button"
              className="back-link"
              onClick={() => {
                setFocus((stack) => stack.slice(0, -1));
                window.scrollTo({ top: 0 });
              }}
            >
              Back
            </button>
            <h1>{focusTop.title}</h1>
            <p>
              {focusTop.parent ? `${focusTop.parent} · ` : ""}
              {(focusFilms.length + (focusTop.shelves?.reduce((sum, shelf) => sum + shelf.filmIds.length, 0) ?? 0)).toLocaleString("en-US")} films
              {focusTop.note ? ` · ${focusTop.note}` : ""}
            </p>
          </div>
          <div className="rows">
            {focusTop.shelves?.length ? (
              <>
                <ShelfRow title={focusTop.title} hideHead films={focusFilms} total={focusFilms.length} shape={catalog.shape} onOpen={openFilm} />
                {focusTop.shelves.map((shelf) => {
                  const shown = filmsFrom(shelf.previewIds?.length ? shelf.previewIds : shelf.filmIds, catalog.films);
                  return (
                    <ShelfRow
                      key={shelf.id}
                      title={shelf.title}
                      note={shelf.note}
                      total={shelf.filmIds.length}
                      films={shown}
                      shape={catalog.shape}
                      onOpen={openFilm}
                    />
                  );
                })}
              </>
            ) : (
              <GroupRows films={focusFilms} shape={catalog.shape} onOpen={openFilm} onDrill={(title, ids) => drillShelf(title, ids, focusTop.title)} />
            )}
          </div>
        </main>
      ) : current ? (
        <main className="shelf-page">
          <div className="browse-head">
            <h1>{current.title}</h1>
            <p>
              {(current.mode === "grid" ? current.filmIds?.length ?? 0 : current.shelves?.reduce((sum, shelf) => sum + shelf.filmIds.length, 0) ?? 0).toLocaleString("en-US")} films
              {current.note ? ` · ${current.note}` : ""}
            </p>
          </div>
          {current.mode === "rows" ? (
            <div className="rows">
              {(current.shelves ?? []).map((shelf, index, shelves) => {
                const section = shelf.section && shelf.section !== shelves[index - 1]?.section ? shelf.section : null;
                const shown = previewIds(shelf);
                return (
                  <Fragment key={shelf.id}>
                    {section ? <h2 className="shelf-section">{section}</h2> : null}
                    <ShelfRow
                      title={shelf.title}
                      note={shelf.note}
                      total={shelf.filmIds.length}
                      films={filmsFrom(shown, catalog.films)}
                      shape={catalog.shape}
                      onOpen={openFilm}
                      onTitle={shelf.filmIds.length > shown.length || shelf.shelves?.length ? () => openShelf(shelf) : undefined}
                    />
                  </Fragment>
                );
              })}
            </div>
          ) : (
            <div className="rows">
              <GroupRows films={viewFilms} shape={catalog.shape} onOpen={openFilm} onDrill={(title, ids) => drillShelf(title, ids, current.title)} />
            </div>
          )}
        </main>
      ) : (
        <>
          {hero ? (
            <section className="billboard">
              {hero.thumb ? <img className="billboard-art" src={hero.thumb} alt="" /> : null}
              <div className="billboard-copy">
                <p className="kicker">{[hero.company, hero.year > 0 ? hero.year : null].filter(Boolean).join(" · ") || catalog.kicker}</p>
                <h1>{hero.title}</h1>
                {hero.blurb ? <p className="blurb">{hero.blurb}</p> : null}
                <div className="actions">
                  <button
                    type="button"
                    className="btn-play"
                    onClick={() => {
                      setActive(hero);
                      setPlaying(canPlay(hero.watch) || hero.watch.host === "link");
                    }}
                  >
                    <Play aria-hidden="true" />
                    Play
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => openFilm(hero)}>
                    More info
                  </button>
                </div>
              </div>
            </section>
          ) : null}
          <p className="home-count">
            {catalog.filmCount.toLocaleString("en-US")} videos
            <span> · {catalog.kicker}</span>
          </p>
          <main className="rows">
            {savedFilms.length ? (
              <ShelfRow title="My List" films={savedFilms} total={savedFilms.length} shape={catalog.shape} onOpen={openFilm} />
            ) : null}
            {catalog.home.map((shelf) => {
              const shown = dailyHomeIds(shelf, day);
              return (
                <ShelfRow
                  key={`${shelf.id}-${day}`}
                  title={shelf.title}
                  note={shelf.note}
                  total={shelf.count ?? shelf.filmIds.length}
                  films={filmsFrom(shown, catalog.films)}
                  shape={catalog.shape}
                  onOpen={openFilm}
                  onTitle={shelf.filmIds.length > shown.length ? () => openShelf(shelf) : undefined}
                />
              );
            })}
            {onNeedMore ? <div ref={more} className="row-more" aria-hidden="true" /> : null}
          </main>
        </>
      )}

      {active ? (
        <div
          className="detail-layer"
          onClick={() => {
            setActive(null);
            setPlaying(false);
          }}
        >
          <article
            className="detail"
            role="dialog"
            aria-modal="true"
            aria-label={active.title}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="icon-btn detail-close"
              aria-label="Close"
              onClick={() => {
                setActive(null);
                setPlaying(false);
              }}
            >
              <X aria-hidden="true" />
            </button>
            {playing && canPlay(active.watch) ? (
              <Player film={active} />
            ) : (
              <div className={`detail-hero tone-${tone(active.id)}`}>
                {active.thumb ? <img src={active.thumb} alt="" /> : null}
              </div>
            )}
            <div className="detail-body">
              <p className="kicker">{[active.company, active.year > 0 ? active.year : null].filter(Boolean).join(" · ")}</p>
              <h2>{active.title}</h2>
              {active.blurb ? <p className="blurb">{active.blurb}</p> : null}
              <div className="actions">
                {canPlay(active.watch) ? (
                  <button type="button" className="btn-play" onClick={() => setPlaying(true)}>
                    <Play aria-hidden="true" />
                    Play
                  </button>
                ) : (
                  <Player film={active} />
                )}
                <button type="button" className="btn-ghost" onClick={() => saved.toggle(active.id)} aria-pressed={saved.ids.includes(active.id)}>
                  {saved.ids.includes(active.id) ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}
                  {saved.ids.includes(active.id) ? "In my list" : "My list"}
                </button>
              </div>
            </div>
          </article>
        </div>
      ) : null}
    </div>
  );
}
