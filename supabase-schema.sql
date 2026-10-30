-- =====================================================================
--  SKORPION — Estrutura do banco (Supabase / PostgreSQL)
--  Como usar: Supabase → SQL Editor → New query → cole tudo → Run.
--  Pode rodar mais de uma vez (é idempotente).
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. TABELAS
-- ---------------------------------------------------------------------

-- Categorias do catálogo de revenda
create table if not exists public.categorias (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  slug        text not null unique,
  descricao   text,
  ordem       integer not null default 0,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Produtos do catálogo de revenda (sem preço — venda por cotação)
create table if not exists public.produtos (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null,
  slug           text unique,
  descricao      text,
  categoria_id   uuid references public.categorias(id) on delete set null,
  unidade_venda  text,                                   -- ex.: "Caixa com 12 un."
  pedido_minimo  text,                                   -- ex.: "10 caixas"
  fotos          jsonb not null default '[]'::jsonb,     -- ["https://.../foto1.jpg", ...]
  ativo          boolean not null default true,
  destaque       boolean not null default false,
  ordem          integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists produtos_categoria_idx on public.produtos (categoria_id);
create index if not exists produtos_ativo_idx     on public.produtos (ativo);

-- Solicitações vindas do formulário de importação (trading)
create table if not exists public.solicitacoes_importacao (
  id                uuid primary key default gen_random_uuid(),
  empresa           text not null,
  cnpj              text not null,
  contato_nome      text not null,
  contato_email     text,
  contato_telefone  text,
  produto           text not null,
  pais_origem       text,
  volume_estimado   text,
  frequencia        text,   -- 'unica' | 'mensal' | 'trimestral' | 'semestral' | 'anual'
  possui_radar      text,   -- 'sim' | 'nao' | 'nao_sei'
  mensagem          text,
  status            text not null default 'novo',
  observacoes_internas text,
  origem            text default 'site',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint solicitacoes_importacao_status_check
    check (status in ('novo','em_atendimento','fechado','perdido'))
);

-- Solicitações vindas do carrinho de cotação (revenda / atacado)
create table if not exists public.solicitacoes_revenda (
  id                uuid primary key default gen_random_uuid(),
  razao_social      text not null,
  cnpj              text not null,
  cidade            text,
  uf                text,
  contato_nome      text not null,
  contato_email     text,
  contato_telefone  text,
  observacoes       text,
  itens             jsonb not null default '[]'::jsonb,  -- [{produto_id, nome, unidade_venda, quantidade}]
  status            text not null default 'novo',
  observacoes_internas text,
  origem            text default 'site',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint solicitacoes_revenda_status_check
    check (status in ('novo','em_atendimento','fechado','perdido'))
);

create index if not exists sol_imp_status_idx on public.solicitacoes_importacao (status, created_at desc);
create index if not exists sol_rev_status_idx on public.solicitacoes_revenda   (status, created_at desc);

-- ---------------------------------------------------------------------
-- 2. updated_at automático
-- ---------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  -- No insert, a data de criação vem do servidor, nunca do cliente.
  if tg_op = 'INSERT' then
    new.created_at = now();
  end if;
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_categorias_updated  on public.categorias;
drop trigger if exists trg_produtos_updated    on public.produtos;
drop trigger if exists trg_sol_imp_updated     on public.solicitacoes_importacao;
drop trigger if exists trg_sol_rev_updated     on public.solicitacoes_revenda;

create trigger trg_categorias_updated before update on public.categorias
  for each row execute function public.set_updated_at();
create trigger trg_produtos_updated   before update on public.produtos
  for each row execute function public.set_updated_at();
create trigger trg_sol_imp_updated    before insert or update on public.solicitacoes_importacao
  for each row execute function public.set_updated_at();
create trigger trg_sol_rev_updated    before insert or update on public.solicitacoes_revenda
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY
--    Público (anon):  lê apenas categorias/produtos ATIVOS;
--                     insere solicitações; NÃO lê nenhuma solicitação.
--    Autenticado:     acesso total (é o painel /admin.html).
-- ---------------------------------------------------------------------

alter table public.categorias              enable row level security;
alter table public.produtos                enable row level security;
alter table public.solicitacoes_importacao enable row level security;
alter table public.solicitacoes_revenda    enable row level security;

-- (re)criação limpa das policies
drop policy if exists categorias_leitura_publica   on public.categorias;
drop policy if exists categorias_admin             on public.categorias;
drop policy if exists produtos_leitura_publica     on public.produtos;
drop policy if exists produtos_admin               on public.produtos;
drop policy if exists sol_imp_insert_publico       on public.solicitacoes_importacao;
drop policy if exists sol_imp_admin                on public.solicitacoes_importacao;
drop policy if exists sol_rev_insert_publico       on public.solicitacoes_revenda;
drop policy if exists sol_rev_admin                on public.solicitacoes_revenda;

-- CATEGORIAS ------------------------------------------------------------
create policy categorias_leitura_publica
  on public.categorias for select
  to anon
  using (ativo = true);

create policy categorias_admin
  on public.categorias for all
  to authenticated
  using (true) with check (true);

-- PRODUTOS --------------------------------------------------------------
create policy produtos_leitura_publica
  on public.produtos for select
  to anon
  using (ativo = true);

create policy produtos_admin
  on public.produtos for all
  to authenticated
  using (true) with check (true);

-- SOLICITAÇÕES DE IMPORTAÇÃO -------------------------------------------
-- insert liberado para o site; nenhuma policy de select para anon => ninguém lê.
-- O público não escolhe status nem anotação interna (a chave anon é pública).
create policy sol_imp_insert_publico
  on public.solicitacoes_importacao for insert
  to anon
  with check (status = 'novo' and observacoes_internas is null);

create policy sol_imp_admin
  on public.solicitacoes_importacao for all
  to authenticated
  using (true) with check (true);

-- SOLICITAÇÕES DE REVENDA ----------------------------------------------
create policy sol_rev_insert_publico
  on public.solicitacoes_revenda for insert
  to anon
  with check (status = 'novo' and observacoes_internas is null);

create policy sol_rev_admin
  on public.solicitacoes_revenda for all
  to authenticated
  using (true) with check (true);

-- Garantia extra: o papel anônimo não recebe SELECT nas solicitações
revoke select on public.solicitacoes_importacao from anon;
revoke select on public.solicitacoes_revenda    from anon;

-- ---------------------------------------------------------------------
-- 4. STORAGE — bucket das fotos dos produtos
--    Leitura pública (as fotos aparecem no site), escrita só autenticada.
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('produtos', 'produtos', true)
on conflict (id) do update set public = true;

drop policy if exists produtos_fotos_leitura  on storage.objects;
drop policy if exists produtos_fotos_escrita  on storage.objects;

create policy produtos_fotos_leitura
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'produtos');

create policy produtos_fotos_escrita
  on storage.objects for all
  to authenticated
  using (bucket_id = 'produtos')
  with check (bucket_id = 'produtos');

-- ---------------------------------------------------------------------
-- 5. DADOS DE EXEMPLO (opcional — apague se não quiser)
-- ---------------------------------------------------------------------

insert into public.categorias (nome, slug, descricao, ordem) values
  ('Alimentos e bebidas', 'alimentos-e-bebidas', 'Linha de alimentos e bebidas para revenda.', 1),
  ('Embalagens',          'embalagens',          'Embalagens em geral para indústria e comércio.', 2),
  ('Higiene e limpeza',   'higiene-e-limpeza',   'Produtos de higiene pessoal e limpeza profissional.', 3),
  ('Utilidades',          'utilidades',          'Utilidades domésticas e bazar.', 4)
on conflict (slug) do nothing;
