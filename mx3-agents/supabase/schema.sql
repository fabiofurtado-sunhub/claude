-- ============================================================
-- MX3 Aceleradora Comercial — Multi-Agent WhatsApp Schema
-- ============================================================

-- Ativa pgvector
create extension if not exists vector;

-- ============================================================
-- LEADS
-- ============================================================
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  phone text unique not null,
  name text,
  company text,
  monthly_revenue text,
  stage text default 'NOVO' check (
    stage in ('NOVO', 'EM_QUALIFICACAO', 'QUALIFICADO', 'EM_NEGOCIACAO', 'INATIVO', 'DESCARTADO')
  ),
  main_pain text,
  urgency_level text check (
    urgency_level is null or urgency_level in ('ALTA', 'MEDIA', 'BAIXA', 'NAO_IDENTIFICADA')
  ),
  meeting_scheduled_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Trigger para atualizar updated_at automaticamente
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger leads_updated_at
  before update on leads
  for each row execute function update_updated_at_column();

-- ============================================================
-- MENSAGENS
-- ============================================================
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  role text not null check (role in ('lead', 'agent')),
  content text not null,
  agent_used text,
  created_at timestamptz default now()
);

create index if not exists messages_lead_id_idx on messages(lead_id);
create index if not exists messages_created_at_idx on messages(created_at desc);

-- ============================================================
-- EMBEDDINGS (RAG com pgvector)
-- ============================================================
create table if not exists embeddings (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  embedding vector(1536),
  source_type text check (
    source_type in ('playbook', 'conversa', 'case', 'objecao')
  ),
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

-- Índice para busca vetorial (cosine similarity)
create index if not exists embeddings_vector_idx
  on embeddings
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- ============================================================
-- INTERAÇÕES COMPLETAS
-- ============================================================
create table if not exists interactions (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  incoming_message text not null,
  sdr_contribution jsonb,
  bdr_contribution jsonb,
  copywriter_contribution jsonb,
  followup_contribution jsonb,
  coordinator_output jsonb,
  final_message_sent text,
  lead_context_snapshot jsonb,
  created_at timestamptz default now()
);

create index if not exists interactions_lead_id_idx on interactions(lead_id);
create index if not exists interactions_created_at_idx on interactions(created_at desc);

-- ============================================================
-- PERFORMANCE DOS AGENTES (Learning Loop)
-- ============================================================
create table if not exists agent_performance (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  interaction_id uuid references interactions(id) on delete cascade,
  agent_name text not null check (
    agent_name in ('sdr', 'bdr', 'copywriter', 'followup')
  ),
  contribution jsonb not null,
  was_primary boolean default false,
  lead_replied boolean,
  reply_time_minutes integer,
  conversion_outcome text check (
    conversion_outcome is null or
    conversion_outcome in ('REUNIAO_AGENDADA', 'QUALIFICADO', 'PERDIDO', 'SEM_RESPOSTA')
  ),
  weight_score float default 1.0,
  created_at timestamptz default now()
);

create index if not exists agent_performance_lead_id_idx on agent_performance(lead_id);
create index if not exists agent_performance_interaction_id_idx on agent_performance(interaction_id);
create index if not exists agent_performance_agent_name_idx on agent_performance(agent_name);

-- ============================================================
-- FUNÇÃO: Busca vetorial por similaridade
-- ============================================================
create or replace function match_embeddings(
  query_embedding vector(1536),
  match_threshold float default 0.7,
  match_count int default 5
)
returns table (
  id uuid,
  content text,
  source_type text,
  metadata jsonb,
  similarity float
)
language sql stable
as $$
  select
    e.id,
    e.content,
    e.source_type,
    e.metadata,
    1 - (e.embedding <=> query_embedding) as similarity
  from embeddings e
  where 1 - (e.embedding <=> query_embedding) > match_threshold
  order by e.embedding <=> query_embedding
  limit match_count;
$$;

-- ============================================================
-- FUNÇÃO: Buscar pesos dos agentes para um lead
-- ============================================================
create or replace function get_agent_weights(p_lead_id uuid)
returns jsonb
language sql stable
as $$
  select jsonb_build_object(
    'sdr', coalesce(avg(case when agent_name = 'sdr' then weight_score end), 1.0),
    'bdr', coalesce(avg(case when agent_name = 'bdr' then weight_score end), 1.0),
    'copywriter', coalesce(avg(case when agent_name = 'copywriter' then weight_score end), 1.0),
    'followup', coalesce(avg(case when agent_name = 'followup' then weight_score end), 1.0)
  )
  from agent_performance
  where lead_id = p_lead_id;
$$;

-- ============================================================
-- ROW LEVEL SECURITY (opcional — habilitar em produção)
-- ============================================================
-- alter table leads enable row level security;
-- alter table messages enable row level security;
-- alter table embeddings enable row level security;
-- alter table interactions enable row level security;
-- alter table agent_performance enable row level security;

-- ============================================================
-- DADOS INICIAIS: Embeddings de playbook MX3
-- (Adicionar via script de seed após configurar ANTHROPIC_API_KEY)
-- ============================================================
-- insert into embeddings (content, source_type, metadata) values
-- ('MX3 atende empresas com faturamento acima de R$100k/mês', 'playbook', '{"category": "qualificacao"}'),
-- ('Principal dor: time comercial desorganizado e receita imprevisível', 'playbook', '{"category": "dores"}'),
-- ('Objeção comum: já tentei consultoria antes e não funcionou', 'objecao', '{"category": "objecoes"}');
