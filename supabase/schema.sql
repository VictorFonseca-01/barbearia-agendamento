-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: barbeiros
CREATE TABLE IF NOT EXISTS public.barbeiros (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    foto_url TEXT,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table: servicos
CREATE TABLE IF NOT EXISTS public.servicos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    preco NUMERIC(10, 2) NOT NULL,
    duracao_minutos INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table: agendamentos
CREATE TABLE IF NOT EXISTS public.agendamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    barbeiro_id UUID NOT NULL REFERENCES public.barbeiros(id) ON DELETE CASCADE,
    servico_id UUID NOT NULL REFERENCES public.servicos(id) ON DELETE CASCADE,
    cliente_nome TEXT NOT NULL,
    cliente_telefone TEXT NOT NULL,
    data_hora TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'confirmado', 'cancelado', 'concluido')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_agendamentos_barbeiro_data ON public.agendamentos(barbeiro_id, data_hora);
CREATE INDEX IF NOT EXISTS idx_agendamentos_data_hora ON public.agendamentos(data_hora);

-- Row Level Security (RLS)
ALTER TABLE public.barbeiros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;

-- Policies: Barbeiros & Servicos (Leitura pública)
CREATE POLICY "Permitir leitura pública de barbeiros ativos" 
    ON public.barbeiros FOR SELECT USING (ativo = true);

CREATE POLICY "Permitir leitura pública de serviços" 
    ON public.servicos FOR SELECT USING (true);

-- Policies: Agendamentos (Criação pública e leitura para verificação)
CREATE POLICY "Permitir clientes criarem agendamentos" 
    ON public.agendamentos FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir leitura de agendamentos por barbeiro e data" 
    ON public.agendamentos FOR SELECT USING (true);
