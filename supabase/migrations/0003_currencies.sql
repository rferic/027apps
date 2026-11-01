-- Sprint-05 task-01: divisas (ISO 4217 completo habilitado como seed inicial)
-- Spec: docs/superpowers/specs/2026-10-26-instance-config.md §6 (decisión O)

create table public.currencies (
  code text primary key,          -- ISO 4217 alfabético de 3 letras (ADR 0008)
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Seed inicial: la lista ISO 4217 de divisas en circulación (se excluyen los metales
-- preciosos XAU/XAG/XPT/XPD, el SDR XDR y el código de pruebas XTS). Todas habilitadas:
-- deshabilitar es una decisión del admin, no del seed.
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

-- RLS: lectura para autenticados (anon no ve nada), escritura solo admins.
-- El UPDATE usa `using (true)` para que el fallo del usuario sea un error de WITH CHECK
-- ("new row violates row-level security") y no un update silencioso de 0 filas.
alter table public.currencies enable row level security;

grant select on public.currencies to anon, authenticated;
grant update on public.currencies to authenticated;
grant all on public.currencies to service_role;

create policy "currencies_select_authenticated" on public.currencies
  for select using (auth.uid() is not null);

create policy "currencies_update_admin" on public.currencies
  for update using (true) with check (core_is_admin());
