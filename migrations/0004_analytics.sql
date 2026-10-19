create table if not exists analytics_stat (
  day date not null,
  kind text not null,
  label text not null,
  hits integer not null default 0,
  primary key (day, kind, label)
);

create table if not exists analytics_visitor (
  day date not null,
  visitor text not null,
  primary key (day, visitor)
);

create table if not exists analytics_user (
  visitor text primary key,
  first_day date not null
);

create table if not exists analytics_session (
  day date not null,
  session text not null,
  primary key (day, session)
);
