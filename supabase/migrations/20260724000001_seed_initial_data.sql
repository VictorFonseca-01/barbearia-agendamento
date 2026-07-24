-- Seed initial data for Barbeiros and Servicos

INSERT INTO public.barbeiros (nome, foto_url, ativo) VALUES
('Carlos Silva', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80', true),
('Diego Oliveira', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80', true),
('Rafael Santos', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80', true)
ON CONFLICT DO NOTHING;

INSERT INTO public.servicos (nome, preco, duracao_minutos) VALUES
('Corte de Cabelo', 45.00, 30),
('Barba Completa', 35.00, 30),
('Combo: Corte + Barba', 70.00, 50),
('Pezinho / Acabamento', 20.00, 15),
('Sobrancelha Navalhada', 15.00, 15)
ON CONFLICT DO NOTHING;
