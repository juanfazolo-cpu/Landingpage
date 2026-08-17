-- Taldo Studio 3D — base de clientes / leads
-- Rode no SQL Editor do Supabase (ou via CLI: supabase db push)

create extension if not exists "pgcrypto";

-- Cliente único (e-mail é a chave de identidade comercial)
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  phone text,
  source text not null default 'landing',
  consent_email boolean not null default false,
  consent_at timestamptz,
  tags text[] not null default '{}',
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_email_unique unique (email),
  constraint customers_email_format check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

create index if not exists customers_created_at_idx
  on public.customers (created_at desc);

create index if not exists customers_tags_gin
  on public.customers using gin (tags);

-- Histórico de eventos (cadastro, WhatsApp, campanhas futuras)
create table if not exists public.lead_events (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers (id) on delete set null,
  event_type text not null,
  source text,
  page_url text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists lead_events_customer_id_idx
  on public.lead_events (customer_id);

create index if not exists lead_events_created_at_idx
  on public.lead_events (created_at desc);

create index if not exists lead_events_type_idx
  on public.lead_events (event_type);

-- updated_at automático
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at
  before update on public.customers
  for each row
  execute function public.set_updated_at();

-- Segurança: sem acesso público direto; a API Vercel usa service role
alter table public.customers enable row level security;
alter table public.lead_events enable row level security;

-- Nenhuma policy para anon/authenticated = só service role lê/escreve
-- (policies futuras: painel admin com auth.users)

comment on table public.customers is 'Cadastro de clientes/leads para e-mail marketing e CRM';
comment on table public.lead_events is 'Eventos de aquisição e engajamento ligados ao cliente';
