import { useEffect, useId, useMemo, useRef, useState } from "react";

export type MapPin = {
  ip: string;
  hits: number;
  lat: number | null;
  lng: number | null;
  place: string | null;
};

const W = 960;
const H = 460;
const MAX_Z = 19;
const MIN_W = (3 * W) / 2 ** MAX_Z;
const WORLD = { x: 0, y: 0, w: W, h: H };
const Y_SHIFT = (W - H) / 2;

type View = { x: number; y: number; w: number; h: number };
type Point = { x: number; y: number };

function project(lat: number, lng: number) {
  const x = ((lng + 180) / 360) * W;
  const latRad = (Math.max(-85, Math.min(85, lat)) * Math.PI) / 180;
  const merc = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
  const y = H / 2 - (merc * W) / (2 * Math.PI);
  return { x, y };
}

function clampView(view: View): View {
  const aspect = W / H;
  let w = Math.min(W, Math.max(MIN_W, view.w));
  let h = w / aspect;
  if (h > H) {
    h = H;
    w = H * aspect;
  }
  return {
    x: Math.min(Math.max(0, view.x), W - w),
    y: Math.min(Math.max(0, view.y), H - h),
    w,
    h,
  };
}

function zoomAt(view: View, factor: number, cx: number, cy: number): View {
  const w = view.w / factor;
  const h = view.h / factor;
  const rx = (cx - view.x) / view.w;
  const ry = (cy - view.y) / view.h;
  return clampView({ x: cx - rx * w, y: cy - ry * h, w, h });
}

function fitPoints(points: Point[]): View {
  if (points.length === 0) return WORLD;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  const street = W / 2 ** 15;
  const span = Math.max(maxX - minX, (maxY - minY) * (W / H), points.length === 1 ? street : W / 48);
  const w = Math.min(W, Math.max(MIN_W, span * 1.8));
  const h = w / (W / H);
  return clampView({ x: (minX + maxX) / 2 - w / 2, y: (minY + maxY) / 2 - h / 2, w, h });
}

function streetTiles(view: View) {
  const z = Math.max(2, Math.min(MAX_Z, Math.round(Math.log2((5 * W) / view.w))));
  const tile = W / 2 ** z;
  const x0 = Math.max(0, Math.floor(view.x / tile) - 1);
  const x1 = Math.min(2 ** z - 1, Math.floor((view.x + view.w) / tile) + 1);
  const y0 = Math.max(0, Math.floor((view.y + Y_SHIFT) / tile) - 1);
  const y1 = Math.min(2 ** z - 1, Math.floor((view.y + view.h + Y_SHIFT) / tile) + 1);
  const tiles: { key: string; href: string; x: number; y: number; size: number }[] = [];
  for (let x = x0; x <= x1; x += 1) {
    for (let y = y0; y <= y1; y += 1) {
      tiles.push({
        key: `${z}/${x}/${y}`,
        href: `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
        x: x * tile,
        y: y * tile - Y_SHIFT,
        size: tile,
      });
    }
  }
  return tiles;
}

function clientToMap(svg: SVGSVGElement, clientX: number, clientY: number, view: View) {
  const rect = svg.getBoundingClientRect();
  return {
    x: view.x + ((clientX - rect.left) / rect.width) * view.w,
    y: view.y + ((clientY - rect.top) / rect.height) * view.h,
  };
}

function splitPlace(place: string | null) {
  const parts = (place ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return { city: "Unknown location", country: "Unknown location" };
  if (parts.length === 1) return { city: parts[0], country: parts[0] };
  return { city: parts.slice(0, -1).join(", "), country: parts[parts.length - 1] };
}

function placeId(kind: "country" | "city" | "ip", a: string, b = "") {
  return `${kind}:${encodeURIComponent(a)}:${encodeURIComponent(b)}`;
}

export function TrafficMap({ pins }: { pins: MapPin[] }) {
  const markerId = useId().replace(/:/g, "");
  const frame = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; view: View } | null>(null);
  const drag = useRef<{ id: number; x: number; y: number; view: View; moved: boolean } | null>(null);
  const dragged = useRef(false);
  const [land, setLand] = useState<string[] | null>(null);
  const [view, setView] = useState<View>(WORLD);
  const [focus, setFocus] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const placed = useMemo(
    () =>
      pins.flatMap((pin) => {
        if (pin.lat == null || pin.lng == null) return [];
        return [{ ...pin, hits: Number(pin.hits) || 0, ...project(pin.lat, pin.lng) }];
      }),
    [pins],
  );
  const quiet = pins.length - placed.length;
  const origins = useMemo(() => {
    const countries = new Map<
      string,
      {
        id: string;
        name: string;
        hits: number;
        points: Point[];
        cities: Map<string, { id: string; name: string; hits: number; points: Point[] }>;
      }
    >();
    for (const pin of pins) {
      const hits = Number(pin.hits) || 0;
      const { city, country } = splitPlace(pin.place);
      const point = pin.lat != null && pin.lng != null ? project(pin.lat, pin.lng) : null;
      let row = countries.get(country);
      if (!row) {
        row = { id: placeId("country", country), name: country, hits: 0, points: [], cities: new Map() };
        countries.set(country, row);
      }
      row.hits += hits;
      if (point) row.points.push(point);
      let cityRow = row.cities.get(city);
      if (!cityRow) {
        cityRow = { id: placeId("city", country, city), name: city, hits: 0, points: [] };
        row.cities.set(city, cityRow);
      }
      cityRow.hits += hits;
      if (point) cityRow.points.push(point);
    }
    return [...countries.values()]
      .map((country) => ({
        ...country,
        cities: [...country.cities.values()].sort((a, b) => b.hits - a.hits || a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => b.hits - a.hits || a.name.localeCompare(b.name));
  }, [pins]);

  const scale = view.w / W;
  const detailed = view.w < W / 4;
  const tiles = useMemo(() => (detailed ? streetTiles(view) : []), [detailed, view]);
  const labels = useMemo(() => {
    const groups = new Map<string, { x: number; y: number; n: number; text: string }>();
    for (const pin of placed) {
      if (pin.x < view.x || pin.x > view.x + view.w || pin.y < view.y || pin.y > view.y + view.h) continue;
      const { city, country } = splitPlace(pin.place);
      const selected =
        !focus ||
        focus === placeId("ip", pin.ip) ||
        focus === placeId("country", country) ||
        focus === placeId("city", country, city);
      if (!selected) continue;
      const id = placeId("city", country, city);
      const row = groups.get(id) ?? { x: 0, y: 0, n: 0, text: city.split(",")[0] || city };
      row.x += pin.x;
      row.y += pin.y;
      row.n += 1;
      groups.set(id, row);
    }
    if (!focus && groups.size > 24) return [];
    const rows = [...groups.entries()].map(([id, row]) => ({ id, x: row.x / row.n, y: row.y / row.n, text: row.text }));
    rows.sort((a, b) => a.y - b.y || a.x - b.x);
    const gap = view.h * 0.065;
    for (let index = 1; index < rows.length; index += 1) {
      const prev = rows[index - 1];
      if (Math.abs(rows[index].x - prev.x) < view.w * 0.3 && Math.abs(rows[index].y - prev.y) < gap) {
        rows[index] = { ...rows[index], y: prev.y + gap };
      }
    }
    return rows;
  }, [focus, placed, view]);

  useEffect(() => {
    let cancel = false;
    fetch("/media/world.json")
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { land?: string[] } | null) => {
        if (!cancel && body?.land?.length) setLand(body.land);
      })
      .catch(() => {});
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    const node = frame.current;
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      const svg = node.querySelector("svg");
      if (!svg) return;
      event.preventDefault();
      setView((current) => {
        const at = clientToMap(svg, event.clientX, event.clientY, current);
        return zoomAt(current, event.deltaY < 0 ? 1.45 : 1 / 1.45, at.x, at.y);
      });
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, []);

  const go = (id: string, points: Point[]) => {
    if (points.length === 0) return;
    if (focus === id) {
      setFocus(null);
      setView(WORLD);
      return;
    }
    setFocus(id);
    setView(fitPoints(points));
  };

  const zoomCenter = (factor: number) => {
    setView((current) => zoomAt(current, factor, current.x + current.w / 2, current.y + current.h / 2));
  };

  return (
    <div className="traffic-map">
      <div
        className="map-frame"
        ref={frame}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "+" || event.key === "=") {
            event.preventDefault();
            zoomCenter(2);
          } else if (event.key === "-" || event.key === "_") {
            event.preventDefault();
            zoomCenter(1 / 2);
          } else if (event.key === "0") {
            event.preventDefault();
            setFocus(null);
            setView(WORLD);
          }
        }}
      >
        <svg
          viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
          className={dragging ? "is-drag" : undefined}
          role="application"
          aria-label="Traffic map. Scroll or pinch to zoom, drag to move."
          onClick={() => {
            dragged.current = false;
          }}
          onDoubleClick={(event) => {
            const at = clientToMap(event.currentTarget, event.clientX, event.clientY, view);
            setView(zoomAt(view, 2.2, at.x, at.y));
          }}
          onPointerDown={(event) => {
            const svg = event.currentTarget;
            svg.setPointerCapture(event.pointerId);
            pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
            setDragging(true);
            if (pointers.current.size >= 2) {
              const [a, b] = [...pointers.current.values()];
              pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, view };
              drag.current = null;
              return;
            }
            drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, view, moved: false };
          }}
          onPointerMove={(event) => {
            if (!pointers.current.has(event.pointerId)) return;
            pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
            const svg = event.currentTarget;
            if (pointers.current.size >= 2 && pinch.current) {
              const [a, b] = [...pointers.current.values()];
              const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
              const mid = clientToMap(svg, (a.x + b.x) / 2, (a.y + b.y) / 2, pinch.current.view);
              setView(zoomAt(pinch.current.view, dist / pinch.current.dist, mid.x, mid.y));
              return;
            }
            const pan = drag.current;
            if (!pan || pan.id !== event.pointerId) return;
            const rect = svg.getBoundingClientRect();
            const dx = ((event.clientX - pan.x) / rect.width) * pan.view.w;
            const dy = ((event.clientY - pan.y) / rect.height) * pan.view.h;
            if (Math.hypot(event.clientX - pan.x, event.clientY - pan.y) > 4) pan.moved = true;
            setView(clampView({ ...pan.view, x: pan.view.x - dx, y: pan.view.y - dy }));
          }}
          onPointerUp={(event) => {
            pointers.current.delete(event.pointerId);
            if (pointers.current.size < 2) pinch.current = null;
            if (drag.current?.id === event.pointerId) {
              if (drag.current.moved) dragged.current = true;
              drag.current = null;
            }
            if (pointers.current.size === 0) setDragging(false);
          }}
          onPointerCancel={(event) => {
            pointers.current.delete(event.pointerId);
            pinch.current = null;
            drag.current = null;
            setDragging(false);
          }}
        >
          <defs>
            <radialGradient id={`${markerId}-glow`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#f3eadc" stopOpacity="0.9" />
              <stop offset="70%" stopColor="#f3eadc" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#f3eadc" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width={W} height={H} className="map-sea" />
          {tiles.map((tile) => (
            <image key={tile.key} href={tile.href} x={tile.x} y={tile.y} width={tile.size} height={tile.size} className="map-tile" />
          ))}
          {land && !detailed
            ? land.map((d, index) => <path key={index} d={d} className="map-land" strokeWidth={0.45 * scale} />)
            : null}
          {!land
            ? Array.from({ length: 7 }, (_, index) => (
                <line key={index} x1={((index + 1) * W) / 8} y1="0" x2={((index + 1) * W) / 8} y2={H} className="map-grid" />
              ))
            : null}
          {!land
            ? Array.from({ length: 3 }, (_, index) => (
                <line key={`h${index}`} x1="0" y1={((index + 1) * H) / 4} x2={W} y2={((index + 1) * H) / 4} className="map-grid" />
              ))
            : null}
          {placed.map((pin) => {
            const { city, country } = splitPlace(pin.place);
            const on =
              focus === placeId("ip", pin.ip) || focus === placeId("country", country) || focus === placeId("city", country, city);
            return (
              <g
                key={pin.ip}
                className={on ? "map-pin is-on" : "map-pin"}
                onClick={(event) => {
                  event.stopPropagation();
                  if (dragged.current) {
                    dragged.current = false;
                    return;
                  }
                  go(placeId("ip", pin.ip), [{ x: pin.x, y: pin.y }]);
                }}
                onDoubleClick={(event) => event.stopPropagation()}
              >
                <title>{`${pin.place ?? pin.ip} · ${pin.ip} · ${pin.hits}`}</title>
                <circle cx={pin.x} cy={pin.y} r={14 * scale} fill={`url(#${markerId}-glow)`} />
                <circle cx={pin.x} cy={pin.y} r={(on ? 5 : 3.2) * scale} className="map-dot" />
              </g>
            );
          })}
          {labels.map((label) => {
            const right = label.x > view.x + view.w * 0.72;
            return (
              <text
                key={label.id}
                x={label.x + (right ? -7 : 7) * scale}
                y={label.y - 6 * scale}
                className="map-label"
                textAnchor={right ? "end" : "start"}
                fontSize={12.5 * scale}
                strokeWidth={3.2 * scale}
              >
                {label.text}
              </text>
            );
          })}
        </svg>
        <div className="map-zoom">
          <button type="button" aria-label="Zoom in" onClick={() => zoomCenter(2)}>
            +
          </button>
          <button type="button" aria-label="Zoom out" onClick={() => zoomCenter(1 / 2)}>
            −
          </button>
          <button
            type="button"
            aria-label="Show the whole map"
            onClick={() => {
              setFocus(null);
              setView(WORLD);
            }}
          >
            All
          </button>
        </div>
        {detailed ? (
          <p className="map-credit">
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
              © OpenStreetMap
            </a>
          </p>
        ) : null}
      </div>
      {origins.length ? (
        <ul className="origin-list" aria-label="Where they come from">
          {origins.map((country) => {
            const nested = country.cities.filter((city) => city.name !== country.name);
            return (
              <li key={country.id}>
                <button
                  type="button"
                  className={focus === country.id ? "is-on" : undefined}
                  aria-pressed={focus === country.id}
                  disabled={country.points.length === 0}
                  onClick={() => go(country.id, country.points)}
                >
                  <span>{country.name}</span>
                  <strong>{country.hits.toLocaleString("en-US")}</strong>
                </button>
                {nested.length ? (
                  <ul>
                    {nested.map((city) => (
                      <li key={city.id}>
                        <button
                          type="button"
                          className={focus === city.id ? "is-on" : undefined}
                          aria-pressed={focus === city.id}
                          disabled={city.points.length === 0}
                          onClick={() => go(city.id, city.points)}
                        >
                          <span>{city.name}</span>
                          <strong>{city.hits.toLocaleString("en-US")}</strong>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      <ul className="pin-list">
        {pins.length === 0 ? <li className="pin-empty">No visitors recorded yet.</li> : null}
        {pins.map((pin) => {
          const id = placeId("ip", pin.ip);
          return (
            <li key={pin.ip}>
              <button
                type="button"
                className={focus === id ? "is-on" : undefined}
                disabled={pin.lat == null || pin.lng == null}
                onClick={() => {
                  if (pin.lat == null || pin.lng == null) return;
                  const point = project(pin.lat, pin.lng);
                  go(id, [point]);
                }}
              >
                <span className="pin-ip">{pin.ip}</span>
                <span className="pin-place">{pin.place ?? (pin.lat == null ? "Location unknown" : "Unnamed")}</span>
                <strong>{(Number(pin.hits) || 0).toLocaleString("en-US")}</strong>
              </button>
            </li>
          );
        })}
        {quiet > 0 ? (
          <li className="pin-empty">
            {quiet.toLocaleString("en-US")} {quiet === 1 ? "address has" : "addresses have"} no public location, so {quiet === 1 ? "it isn’t" : "they aren’t"} pinned.
          </li>
        ) : null}
      </ul>
    </div>
  );
}
