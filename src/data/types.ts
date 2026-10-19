export type Watch =
  | { host: "youtube"; id: string; credit?: string }
  | { host: "youtube-list"; id: string }
  | { host: "parts"; credit?: string; parts: { id: string; title: string }[] }
  | { host: "vimeo"; id: string }
  | { host: "archive"; id: string }
  | { host: "wawax"; id: string }
  | { host: "link"; url: string }
  | { host: "none" };

export type Film = {
  id: string;
  title: string;
  year: number;
  company: string;
  blurb: string;
  thumb: string;
  watch: Watch;
};

export type Shelf = {
  id: string;
  title: string;
  note?: string;
  previewIds: string[];
  filmIds: string[];
  count?: number;
};

export type RowShelf = {
  id: string;
  title: string;
  note?: string;
  section?: string;
  filmIds: string[];
  previewIds?: string[];
  shelves?: RowShelf[];
};

export type CatalogView = {
  title: string;
  note?: string;
  mode: "grid" | "rows";
  filmIds?: string[];
  shelves?: RowShelf[];
};

export type Catalog = {
  id: string;
  name: string;
  kicker: string;
  shape: "portrait" | "wide";
  filmCount: number;
  featuredId: string;
  heroIds: string[];
  nav: { id: string; label: string }[];
  home: Shelf[];
  views: Record<string, CatalogView>;
  films: Record<string, Film>;
};
