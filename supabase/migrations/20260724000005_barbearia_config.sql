-- Tabela de Configurações da Barbearia (WhatsApp, Nome, etc.)
CREATE TABLE IF NOT EXISTS public.barbearia_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chave TEXT UNIQUE NOT NULL,
    valor TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Inserir WhatsApp padrão caso não exista
INSERT INTO public.barbearia_config (chave, valor)
VALUES ('whatsapp_barbearia', '5562999999999')
ON CONFLICT (chave) DO NOTHING;

-- Políticas de RLS
ALTER TABLE public.barbearia_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura publica de configuracoes" ON public.barbearia_config;
CREATE POLICY "Permitir leitura publica de configuracoes" ON public.barbearia_config FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir atualizacao de configuracoes" ON public.barbearia_config;
CREATE POLICY "Permitir atualizacao de configuracoes" ON public.barbearia_config FOR ALL USING (true) WITH CHECK (true);
