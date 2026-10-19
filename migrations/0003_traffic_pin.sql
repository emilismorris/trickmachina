create table if not exists traffic_pin (
  ip text primary key,
  hits integer not null default 1,
  lat double precision,
  lng double precision,
  place text,
  updated_at timestamptz not null default now()
);
