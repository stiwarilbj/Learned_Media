-- Learned Media persistence layer.
-- Run this in the Supabase SQL editor after enabling Google provider in Auth.
-- Raw Gemini keys belong in Supabase Vault. user_api_credentials stores only a reference.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_mode text not null default 'picture-text',
  sentence_length numeric not null default 2,
  obscurity_level smallint not null default 10 check (obscurity_level between 1 and 10),
  surprise_me boolean not null default true,
  theme text not null default 'light',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.custom_topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  parent_id uuid references public.custom_topics(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, name, parent_id)
);

create table if not exists public.topic_selections (
  user_id uuid not null references auth.users(id) on delete cascade,
  topic_id text not null,
  selected boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key(user_id, topic_id)
);

create table if not exists public.topic_weights (
  user_id uuid not null references auth.users(id) on delete cascade,
  topic_id text not null,
  weight numeric not null default 10 check (weight >= 0 and weight <= 100),
  updated_at timestamptz not null default now(),
  primary key(user_id, topic_id)
);

create table if not exists public.feed_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active',
  settings jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create table if not exists public.knowledge_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feed_session_id uuid references public.feed_sessions(id) on delete set null,
  title text not null,
  body text not null,
  topic_path text[] not null default '{}',
  fact_fingerprint text not null,
  obscurity_score smallint not null default 5 check (obscurity_score between 1 and 10),
  image_url text,
  created_at timestamptz not null default now(),
  unique(user_id, fact_fingerprint)
);

create table if not exists public.card_sources (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.knowledge_cards(id) on delete cascade,
  source_title text not null,
  source_url text not null,
  position smallint not null default 1
);

create table if not exists public.card_interactions (
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null references public.knowledge_cards(id) on delete cascade,
  liked boolean not null default false,
  saved boolean not null default false,
  more_like boolean not null default false,
  less_like boolean not null default false,
  already_knew boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key(user_id, card_id)
);

create table if not exists public.view_history (
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null references public.knowledge_cards(id) on delete cascade,
  first_viewed_at timestamptz not null default now(),
  last_viewed_at timestamptz not null default now(),
  primary key(user_id, card_id)
);

create table if not exists public.user_api_credentials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  vault_secret_id uuid not null,
  key_last_four text,
  validated boolean not null default false,
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists knowledge_cards_user_created_idx on public.knowledge_cards(user_id, created_at desc);
create index if not exists knowledge_cards_user_fingerprint_idx on public.knowledge_cards(user_id, fact_fingerprint);
create index if not exists view_history_user_viewed_idx on public.view_history(user_id, last_viewed_at desc);
create index if not exists card_interactions_user_liked_idx on public.card_interactions(user_id, liked);
create index if not exists card_interactions_user_saved_idx on public.card_interactions(user_id, saved);

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.custom_topics enable row level security;
alter table public.topic_selections enable row level security;
alter table public.topic_weights enable row level security;
alter table public.feed_sessions enable row level security;
alter table public.knowledge_cards enable row level security;
alter table public.card_sources enable row level security;
alter table public.card_interactions enable row level security;
alter table public.view_history enable row level security;
alter table public.user_api_credentials enable row level security;

create policy "users own profiles" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "users own settings" on public.user_settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own custom topics" on public.custom_topics for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own selections" on public.topic_selections for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own weights" on public.topic_weights for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own feed sessions" on public.feed_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own cards" on public.knowledge_cards for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own card sources" on public.card_sources for all using (exists (select 1 from public.knowledge_cards c where c.id = card_id and c.user_id = auth.uid())) with check (exists (select 1 from public.knowledge_cards c where c.id = card_id and c.user_id = auth.uid()));
create policy "users own interactions" on public.card_interactions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own history" on public.view_history for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own credentials" on public.user_api_credentials for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
