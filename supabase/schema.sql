-- アートボード モックアップ用スキーマ
-- Supabase SQL Editor で実行してください

create table posts (
  id uuid primary key default gen_random_uuid(),
  cell_number integer not null unique check (cell_number >= 0 and cell_number <= 24),
  text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now()
);

create table comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

create index comments_post_id_idx on comments(post_id);

alter table posts enable row level security;
alter table comments enable row level security;

create policy "posts_select" on posts for select using (true);
create policy "posts_insert" on posts for insert with check (true);
create policy "posts_delete" on posts for delete using (true);

create policy "comments_select" on comments for select using (true);
create policy "comments_insert" on comments for insert with check (true);

alter publication supabase_realtime add table posts;
alter publication supabase_realtime add table comments;
