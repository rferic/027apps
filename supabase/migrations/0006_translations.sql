-- Sprint-05 task-05: translations table
-- ADRs: 0004, 0007, 0008. Spec: docs/superpowers/specs/2026-10-26-i18n-operativa.md
-- Model: English text is the key; 9 locales (en es ca it fr de pt gl eu); source priority: manual > import > code > module

create table public.translations (
  locale text not null
    check (locale in ('en', 'es', 'ca', 'it', 'fr', 'de', 'pt', 'gl', 'eu')),
  text_hash text not null,
  text_en text not null,
  translated_text text not null
    check (length(translated_text) <= 2000),
  source text not null default 'code'
    check (source in ('code', 'module', 'import', 'manual')),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  primary key (locale, text_hash)
);

-- RLS: select for authenticated users; no writes through RLS (service_role only)
alter table public.translations enable row level security;

grant select on public.translations to anon, authenticated;
grant all on public.translations to service_role;

create policy "translations_select" on public.translations
  for select to authenticated
  using (true);

-- Index for faster lookups by locale
create index translations_locale_idx on public.translations (locale);

-- Index for faster lookups by text_en (when syncing)
create index translations_text_en_idx on public.translations (text_en);
