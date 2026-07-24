-- Allow reading all agendamentos (including cancelled) for admin management
DROP POLICY IF EXISTS "Permitir leitura pública de agendamentos ativos para verificar" ON public.agendamentos;
DROP POLICY IF EXISTS "Permitir leitura pública de agendamentos ativos para verificar horários" ON public.agendamentos;

CREATE POLICY "Permitir leitura completa de agendamentos" 
    ON public.agendamentos 
    FOR SELECT 
    USING (true);

-- Allow updating agendamentos status
CREATE POLICY "Permitir atualização de status dos agendamentos" 
    ON public.agendamentos 
    FOR UPDATE 
    USING (true)
    WITH CHECK (true);
