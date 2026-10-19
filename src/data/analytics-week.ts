export type Metric = { label: string; hits: number };

export const ANALYTICS_WEEK = {
  users: 48,
  newUsers: 48,
  views: 325,
  events: 1002,
  engagement: "2m 41s",
  pages: [
    { label: "/", hits: 156 },
    { label: "/bmx", hits: 81 },
    { label: "/skate", hits: 52 },
    { label: "/blades", hits: 26 },
    { label: "/scoot", hits: 8 },
    { label: "/cookies", hits: 2 },
  ] as Metric[],
  countries: [
    { label: "Estonia", hits: 22 },
    { label: "United States", hits: 14 },
    { label: "Germany", hits: 3 },
    { label: "Latvia", hits: 3 },
    { label: "Netherlands", hits: 2 },
    { label: "Poland", hits: 2 },
    { label: "Italy", hits: 1 },
    { label: "Finland", hits: 1 },
  ] as Metric[],
};

const PLACES: Record<string, { city: string; lat: number; lng: number }> = {
  Estonia: { city: "Tallinn", lat: 59.437, lng: 24.7536 },
  "United States": { city: "Washington", lat: 38.9072, lng: -77.0369 },
  Germany: { city: "Berlin", lat: 52.52, lng: 13.405 },
  Latvia: { city: "Riga", lat: 56.9496, lng: 24.1052 },
  Netherlands: { city: "Amsterdam", lat: 52.3676, lng: 4.9041 },
  Poland: { city: "Warsaw", lat: 52.2297, lng: 21.0122 },
  Italy: { city: "Rome", lat: 41.9028, lng: 12.4964 },
  Finland: { city: "Helsinki", lat: 60.1699, lng: 24.9384 },
};

/** Cities from the Analytics realtime view that are not the country stand-in. */
const EXTRA_CITIES: MapPin[] = [
  { ip: "San Jose", hits: 0, lat: 37.3382, lng: -121.8863, place: "San Jose, United States", counted: false },
  { ip: "Ashburn", hits: 0, lat: 39.0438, lng: -77.4874, place: "Ashburn, United States", counted: false },
  { ip: "Seattle", hits: 0, lat: 47.6062, lng: -122.3321, place: "Seattle, United States", counted: false },
  { ip: "Boardman", hits: 0, lat: 45.8399, lng: -119.7006, place: "Boardman, United States", counted: false },
  { ip: "Vilnius", hits: 0, lat: 54.6872, lng: 25.2797, place: "Vilnius, Lithuania", counted: false },
  { ip: "Stockholm", hits: 0, lat: 59.3293, lng: 18.0686, place: "Stockholm, Sweden", counted: false },
  { ip: "Frankfurt", hits: 0, lat: 50.1109, lng: 8.6821, place: "Frankfurt, Germany", counted: false },
  { ip: "Frankfurt am Main", hits: 0, lat: 50.1155, lng: 8.6842, place: "Frankfurt am Main, Germany", counted: false },
];

export type MapPin = {
  ip: string;
  hits: number;
  lat: number | null;
  lng: number | null;
  place: string | null;
  /** False when the place was seen, but Analytics did not give a count. */
  counted?: boolean;
};

function floorRows(live: Metric[], floor: Metric[]) {
  const map = new Map<string, number>();
  for (const row of floor) map.set(row.label, row.hits);
  for (const row of live) map.set(row.label, Math.max(map.get(row.label) ?? 0, row.hits));
  return [...map.entries()]
    .map(([label, hits]) => ({ label, hits }))
    .sort((a, b) => b.hits - a.hits || a.label.localeCompare(b.label));
}

function rangeIncludesSnapshot(range: "7" | "28" | "all") {
  if (range === "all") return true;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (Number(range) - 1));
  return start.getTime() <= new Date(2026, 9, 19).getTime();
}

function sumRows(base: Metric[], extra: Metric[]) {
  const map = new Map<string, number>();
  for (const row of base) map.set(row.label, (map.get(row.label) ?? 0) + row.hits);
  for (const row of extra) map.set(row.label, (map.get(row.label) ?? 0) + row.hits);
  return [...map.entries()]
    .map(([label, hits]) => ({ label, hits }))
    .sort((a, b) => b.hits - a.hits || a.label.localeCompare(b.label));
}

type LiveReport = {
  users: number;
  newUsers: number;
  views: number;
  events: number;
  engagement: string | null;
  importedUsers?: number;
  pages: Metric[];
  countries: Metric[];
  sources: Metric[];
  devices: Metric[];
  browsers: Metric[];
  languages: Metric[];
};

/** Live counts for the selected range. The Analytics week is the floor, not a second copy. */
export function deskStats(live: LiveReport | null, range: "7" | "28" | "all") {
  const week = rangeIncludesSnapshot(range) ? ANALYTICS_WEEK : null;
  const blank = {
    users: 0,
    newUsers: 0,
    views: 0,
    events: 0,
    engagement: null as string | null,
    pages: [] as Metric[],
    countries: [] as Metric[],
    sources: [] as Metric[],
    devices: [] as Metric[],
    browsers: [] as Metric[],
    languages: [] as Metric[],
  };
  if (!live) {
    if (!week) return blank;
    return { ...blank, ...week, engagement: week.engagement };
  }
  if (!week) return { ...blank, ...live, engagement: live.engagement };
  const seeded = (live.importedUsers ?? 0) >= 48;
  if (seeded) {
    return {
      users: Math.max(live.users, week.users),
      newUsers: Math.max(live.newUsers, week.newUsers),
      views: Math.max(live.views, week.views),
      events: Math.max(live.events, week.events),
      engagement: live.engagement ?? week.engagement,
      pages: floorRows(live.pages, week.pages),
      countries: floorRows(live.countries, week.countries),
      sources: live.sources,
      devices: live.devices,
      browsers: live.browsers,
      languages: live.languages,
    };
  }
  return {
    users: week.users + live.users,
    newUsers: week.newUsers + live.newUsers,
    views: week.views + live.views,
    events: week.events + live.events,
    engagement: live.engagement ?? week.engagement,
    pages: sumRows(week.pages, live.pages),
    countries: sumRows(week.countries, live.countries),
    sources: live.sources,
    devices: live.devices,
    browsers: live.browsers,
    languages: live.languages,
  };
}

export function pinsWithWeek(pins: MapPin[], countries: Metric[]): MapPin[] {
  const seen = new Set(pins.map((pin) => pin.place));
  const extra = countries.flatMap((country) => {
    const spot = PLACES[country.label];
    if (!spot) return [];
    const place = `${spot.city}, ${country.label}`;
    if (seen.has(place)) return [];
    return [{ ip: spot.city, hits: country.hits, lat: spot.lat, lng: spot.lng, place }];
  });
  return [...pins, ...extra].sort((a, b) => b.hits - a.hits || (a.place ?? "").localeCompare(b.place ?? ""));
}

export function weekMapPins(pins: MapPin[], countries: Metric[] = ANALYTICS_WEEK.countries): MapPin[] {
  const cities = new Set(Object.values(PLACES).map((spot) => spot.city));
  const addresses = pins.filter((pin) => !cities.has(pin.ip));
  const week = pinsWithWeek(addresses, countries);
  const seen = new Set(week.map((pin) => pin.place));
  const extra = EXTRA_CITIES.filter((pin) => !seen.has(pin.place));
  const taken = new Map<string, number>();
  for (const pin of extra) {
    if (pin.counted === false) continue;
    const country = pin.place?.split(", ").at(-1) ?? "";
    taken.set(country, (taken.get(country) ?? 0) + pin.hits);
  }
  const adjusted = week.map((pin) => {
    const parts = pin.place?.split(", ") ?? [];
    const country = parts.at(-1) ?? "";
    const standIn = PLACES[country]?.city;
    const used = taken.get(country) ?? 0;
    if (standIn && parts[0] === standIn && used > 0) return { ...pin, hits: Math.max(1, pin.hits - used) };
    return pin;
  });
  return [...adjusted, ...extra].sort((a, b) => b.hits - a.hits || (a.place ?? "").localeCompare(b.place ?? ""));
}
