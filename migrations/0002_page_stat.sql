create table if not exists page_stat (
  key text primary key,
  hits integer not null default 0,
  updated_at timestamptz not null default now()
);
