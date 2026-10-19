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

export type MapPin = {
  ip: string;
  hits: number;
  lat: number | null;
  lng: number | null;
  place: string | null;
};

function floorRows(live: Metric[], floor: Metric[]) {
  const map = new Map<string, number>();
  for (const row of floor) map.set(row.label, row.hits);
  for (const row of live) map.set(row.label, Math.max(map.get(row.label) ?? 0, row.hits));
  return [...map.entries()]
    .map(([label, hits]) => ({ label, hits }))
    .sort((a, b) => b.hits - a.hits || a.label.localeCompare(b.label));
}

export function floorWeek(
  live: {
    users: number;
    newUsers: number;
    views: number;
    events: number;
    engagement: string | null;
    pages: Metric[];
    countries: Metric[];
    sources: Metric[];
    devices: Metric[];
    browsers: Metric[];
    languages: Metric[];
  } | null,
) {
  const week = ANALYTICS_WEEK;
  if (!live) {
    return {
      users: week.users,
      newUsers: week.newUsers,
      views: week.views,
      events: week.events,
      engagement: week.engagement as string | null,
      pages: week.pages,
      countries: week.countries,
      sources: [] as Metric[],
      devices: [] as Metric[],
      browsers: [] as Metric[],
      languages: [] as Metric[],
    };
  }
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

export function weekMapPins(pins: MapPin[]): MapPin[] {
  const cities = new Set(Object.values(PLACES).map((spot) => spot.city));
  const addresses = pins.filter((pin) => !cities.has(pin.ip));
  return pinsWithWeek(addresses, ANALYTICS_WEEK.countries);
}
