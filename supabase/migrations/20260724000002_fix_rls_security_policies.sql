-- Fix RLS Policy Always True security advisory on agendamentos

-- Remove previous permissive policies
DROP POLICY IF EXISTS "Permitir clientes criarem agendamentos" ON public.agendamentos;
DROP POLICY IF EXISTS "Permitir leitura de agendamentos por barbeiro e data" ON public.agendamentos;

-- New INSERT Policy with explicit checks (valid name, phone, and default status 'pendente')
CREATE POLICY "Permitir inserção de agendamentos válidos" 
    ON public.agendamentos 
    FOR INSERT 
    WITH CHECK (
        length(trim(cliente_nome)) > 0 AND 
        length(trim(cliente_telefone)) > 0 AND 
        status = 'pendente'
    );

-- New SELECT Policy for checking busy time slots (non-cancelled appointments)
CREATE POLICY "Permitir leitura pública de agendamentos ativos para verificar horários" 
    ON public.agendamentos 
    FOR SELECT 
    USING (status != 'cancelado');
