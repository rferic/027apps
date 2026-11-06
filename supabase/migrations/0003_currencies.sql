-- Sprint-05 task-01: currencies (full ISO 4217 enabled as the initial seed)
-- Spec: docs/superpowers/specs/2026-10-26-instance-config.md §6 (decision O)

create table public.currencies (
  code text primary key check (code ~ '^[A-Z]{3}$'),  -- ISO 4217 three-letter alphabetic code (ADR 0008)
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()  -- set by the application layer; shared trigger in task-04
);

-- Initial seed: the ISO 4217 list of circulating currencies (precious metals
-- XAU/XAG/XPT/XPD, the SDR XDR and the test code XTS are excluded). All enabled:
-- disabling is an admin decision, not a seed decision.
insert into public.currencies (code) values
  ('AED'), ('AFN'), ('ALL'), ('AMD'), ('ANG'), ('AOA'), ('ARS'), ('AUD'), ('AWG'), ('AZN'),
  ('BAM'), ('BBD'), ('BDT'), ('BGN'), ('BHD'), ('BIF'), ('BMD'), ('BND'), ('BOB'), ('BRL'),
  ('BSD'), ('BTN'), ('BWP'), ('BYN'), ('BZD'), ('CAD'), ('CDF'), ('CHF'), ('CLP'), ('CNY'),
  ('COP'), ('CRC'), ('CUP'), ('CVE'), ('CZK'), ('DJF'), ('DKK'), ('DOP'), ('DZD'), ('EGP'),
  ('ERN'), ('ETB'), ('EUR'), ('FJD'), ('FKP'), ('GBP'), ('GEL'), ('GHS'), ('GIP'), ('GMD'),
  ('GNF'), ('GTQ'), ('GYD'), ('HKD'), ('HNL'), ('HTG'), ('HUF'), ('IDR'), ('ILS'), ('INR'),
  ('IQD'), ('IRR'), ('ISK'), ('JMD'), ('JOD'), ('JPY'), ('KES'), ('KGS'), ('KHR'), ('KMF'),
  ('KPW'), ('KRW'), ('KWD'), ('KYD'), ('KZT'), ('LAK'), ('LBP'), ('LKR'), ('LRD'), ('LSL'),
  ('LYD'), ('MAD'), ('MDL'), ('MGA'), ('MKD'), ('MMK'), ('MNT'), ('MOP'), ('MRU'), ('MUR'),
  ('MVR'), ('MWK'), ('MXN'), ('MYR'), ('MZN'), ('NAD'), ('NGN'), ('NIO'), ('NOK'), ('NPR'),
  ('NZD'), ('OMR'), ('PAB'), ('PEN'), ('PGK'), ('PHP'), ('PKR'), ('PLN'), ('PYG'), ('QAR'),
  ('RON'), ('RSD'), ('RUB'), ('RWF'), ('SAR'), ('SBD'), ('SCR'), ('SDG'), ('SEK'), ('SGD'),
  ('SHP'), ('SLE'), ('SOS'), ('SRD'), ('SSP'), ('STN'), ('SYP'), ('SZL'), ('THB'), ('TJS'),
  ('TMT'), ('TND'), ('TOP'), ('TRY'), ('TTD'), ('TWD'), ('TZS'), ('UAH'), ('UGX'), ('USD'),
  ('UYU'), ('UYW'), ('UZS'), ('VES'), ('VND'), ('VUV'), ('WST'), ('XAF'), ('XCD'), ('XOF'),
  ('XPF'), ('YER'), ('ZAR'), ('ZMW'), ('ZWG');

-- RLS: read access for authenticated users (anon sees nothing), write access for admins only.
-- The UPDATE uses `using (true)` so a user failure is an explicit WITH CHECK error
-- ("new row violates row-level security") instead of a silent 0-row update.
alter table public.currencies enable row level security;

grant select on public.currencies to anon, authenticated;
grant update on public.currencies to authenticated;
grant all on public.currencies to service_role;

create policy "currencies_select_authenticated" on public.currencies
  for select using (auth.uid() is not null);

create policy "currencies_update_admin" on public.currencies
  for update using (true) with check (core_is_admin());
