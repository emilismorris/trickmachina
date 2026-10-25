create table if not exists favorite (
  user_id text not null,
  discipline text not null,
  film_id text not null,
  title text not null,
  year int not null default 0,
  company text not null default '',
  thumb text not null default '',
  created_at timestamptz not null default now(),
  primary key (user_id, discipline, film_id)
);
