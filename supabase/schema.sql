-- アートボード モックアップ用スキーマ
-- Supabase SQL Editor で実行してください

create table posts (
  id uuid primary key default gen_random_uuid(),
  cell_number integer not null unique check (cell_number >= 0 and cell_number <= 24),
  text text not null,
  author_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now()
);

create table comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  text text not null,
  author_name text not null default '',
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
create policy "comments_delete" on comments for delete using (true);

alter publication supabase_realtime add table posts;
alter publication supabase_realtime add table comments;

-- ニックネーム機能追加（既にテーブルが存在する場合の追記分）
alter table posts add column if not exists author_name text not null default '';
alter table comments add column if not exists author_name text not null default '';

-- コメント個別削除機能追加（既にテーブルが存在する場合の追記分）
drop policy if exists "comments_delete" on comments;
create policy "comments_delete" on comments for delete using (true);

-- DELETEイベントのpayload.oldにcell_number/post_id等の全カラムを含めるために必要
-- (デフォルトはprimary keyのみのため、削除時にセルやコメントがUIから消えない)
alter table posts replica identity full;
alter table comments replica identity full;

-- コメント投稿時にposts.last_activity_atを更新できるようにする（既にテーブルが存在する場合の追記分）
drop policy if exists "posts_update" on posts;
create policy "posts_update" on posts for update using (true) with check (true);

-- 24時間活動のない投稿を自動削除
-- Supabase ダッシュボード「Database > Extensions」で pg_cron を有効化してから実行してください

create extension if not exists pg_cron with schema extensions;

create or replace function delete_stale_posts()
returns void
language sql
security definer
set search_path = public
as $$
  delete from posts where last_activity_at < now() - interval '24 hours';
$$;

select cron.schedule(
  'delete-stale-posts',
  '*/10 * * * *',
  $$select delete_stale_posts()$$
);
