'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Barbeiro, Servico, StatusAgendamento } from '@/types/database';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  User, 
  Scissors, 
  DollarSign, 
  TrendingUp, 
  CheckCircle2, 
  XCircle, 
  Clock3, 
  MessageCircle, 
  ChevronLeft, 
  ChevronRight, 
  Filter, 
  RefreshCw, 
  Sparkles,
  Phone,
  Home,
  Check,
  Ban,
  Settings,
  Loader2
} from 'lucide-react';
import { NotificationToast, CustomConfirmModal, ToastData } from '@/components/NotificationToast';

interface AgendamentoCompleto {
  id: string;
  barbeiro_id: string;
  servico_id: string;
  cliente_nome: string;
  cliente_telefone: string;
  data_hora: string;
  status: StatusAgendamento;
  created_at: string;
  barbeiros?: Barbeiro;
  servicos?: Servico;
}

export default function AdminPage() {
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [agendamentos, setAgendamentos] = useState<AgendamentoCompleto[]>([]);
  const [barbeiros, setBarbeiros] = useState<Barbeiro[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Autenticação por PIN
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');

  const ADMIN_PIN = process.env.NEXT_PUBLIC_ADMIN_PIN || '1234';

  useEffect(() => {
    const authStatus = sessionStorage.getItem('barbearia_admin_auth');
    if (authStatus === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLoginPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === ADMIN_PIN) {
      sessionStorage.setItem('barbearia_admin_auth', 'true');
      setIsAuthenticated(true);
      setPinError('');
    } else {
      setPinError('PIN incorreto. Tente novamente.');
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('barbearia_admin_auth');
    setIsAuthenticated(false);
    setPinInput('');
  };

  // Configurações da Barbearia (WhatsApp)
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [barbeariaWhatsApp, setBarbeariaWhatsApp] = useState<string>(process.env.NEXT_PUBLIC_WHATSAPP_BARBEARIA || '5562999999999');
  const [savingConfig, setSavingConfig] = useState<boolean>(false);

  useEffect(() => {
    async function loadConfig() {
      try {
        const { data } = await supabase
          .from('barbearia_config')
          .select('valor')
          .eq('chave', 'whatsapp_barbearia')
          .single();
        if (data && data.valor) {
          setBarbeariaWhatsApp(data.valor);
        }
      } catch (err) {
        console.error('Erro ao carregar configurações:', err);
      }
    }
    loadConfig();
  }, []);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      const cleanPhone = barbeariaWhatsApp.replace(/\D/g, '');
      const { error } = await supabase
        .from('barbearia_config')
        .upsert({ chave: 'whatsapp_barbearia', valor: cleanPhone, updated_at: new Date().toISOString() }, { onConflict: 'chave' });

      if (error) throw error;

      setToast({
        id: Date.now().toString(),
        type: 'success',
        message: 'Número do WhatsApp da barbearia atualizado com sucesso no Supabase!'
      });
      setShowConfigModal(false);
    } catch (err) {
      console.error('Erro ao salvar configuração:', err);
      setToast({
        id: Date.now().toString(),
        type: 'error',
        message: 'Erro ao salvar o número do WhatsApp.'
      });
    } finally {
      setSavingConfig(false);
    }
  };

  // Filtros
  const [filterBarbeiro, setFilterBarbeiro] = useState<string>('todos');
  const [filterStatus, setFilterStatus] = useState<string>('todos');

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Inicializa data como Hoje
  useEffect(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    setSelectedDate(`${y}-${m}-${d}`);
  }, []);

  // Busca agendamentos da data selecionada
  const fetchAgendamentos = useCallback(async () => {
    if (!selectedDate) return;
    setLoading(true);

    try {
      const startOfDay = `${selectedDate}T00:00:00`;
      const endOfDay = `${selectedDate}T23:59:59`;

      const { data, error } = await supabase
        .from('agendamentos')
        .select(`
          id,
          barbeiro_id,
          servico_id,
          cliente_nome,
          cliente_telefone,
          data_hora,
          status,
          created_at,
          barbeiros (id, nome, foto_url),
          servicos (id, nome, preco, duracao_minutos)
        `)
        .gte('data_hora', startOfDay)
        .lte('data_hora', endOfDay)
        .order('data_hora', { ascending: true });

      if (error) throw error;

      if (data) {
        setAgendamentos(data as unknown as AgendamentoCompleto[]);
      }
    } catch (err) {
      console.error('Erro ao carregar agendamentos:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchAgendamentos();
  }, [fetchAgendamentos]);

  // Escuta alterações em tempo real via Supabase Realtime
  useEffect(() => {
    const channel = supabase
      .channel('realtime_admin_agendamentos')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agendamentos' },
        (payload: any) => {
          console.log('Realtime event:', payload);
          if (payload.eventType === 'UPDATE' && payload.new.status === 'cancelado') {
            setToastMessage(`⚠️ ATENÇÃO: Um agendamento foi CANCELADO pelo cliente ou sistema!`);
          } else if (payload.eventType === 'INSERT') {
            setToastMessage(`✨ NOVO AGENDAMENTO: Um novo cliente agendou pelo site!`);
          }
          fetchAgendamentos();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAgendamentos]);

  // Busca barbeiros para os filtros
  useEffect(() => {
    async function fetchBarbeiros() {
      const { data } = await supabase.from('barbeiros').select('*').order('nome');
      if (data) setBarbeiros(data);
    }
    fetchBarbeiros();
  }, []);

  // Mensagem WhatsApp para o cliente quando o barbeiro/admin cancela
  const getClientCancellationWhatsAppLink = (item: AgendamentoCompleto) => {
    const phone = item.cliente_telefone.replace(/\D/g, '');
    const formattedPhone = phone.startsWith('55') ? phone : `55${phone}`;
    
    const timePart = item.data_hora.includes('T') ? item.data_hora.split('T')[1] : item.data_hora;
    const timeStr = timePart.substring(0, 5);
    const dateParts = selectedDate.split('-');
    const dateFormatted = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;

    const msg = encodeURIComponent(
      `Olá ${item.cliente_nome}! 💈\n\n` +
      `Informamos que o seu agendamento na *Barbearia VIP* para *${item.servicos?.nome || 'Serviço'}* no dia *${dateFormatted} às ${timeStr}* com o barbeiro *${item.barbeiros?.nome || 'Profissional'}* precisou ser *CANCELADO*.\n\n` +
      `Pedimos desculpas pelo inconveniente. Caso deseje remarcar para outro horário, acesse nosso site ou nos envie uma mensagem por aqui!`
    );

    return `https://wa.me/${formattedPhone}?text=${msg}`;
  };

  // Validação: Cancelamentos só são permitidos com pelo menos 30 minutos de antecedência
  const canCancelAppointment = (dataHoraISO: string): { allowed: boolean; reason?: string } => {
    const timePart = dataHoraISO.includes('T') ? dataHoraISO.split('T')[1] : dataHoraISO;
    const datePart = dataHoraISO.includes('T') ? dataHoraISO.split('T')[0] : selectedDate;
    
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes] = timePart.substring(0, 5).split(':').map(Number);

    const appointmentTime = new Date(year, month - 1, day, hours, minutes);
    const now = new Date();

    const diffMs = appointmentTime.getTime() - now.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes < 30) {
      return {
        allowed: false,
        reason: '⚠️ Não é possível cancelar este agendamento. Cancelamentos só são permitidos com pelo menos 30 minutos de antecedência do horário agendado.'
      };
    }

    return { allowed: true };
  };

  const [toast, setToast] = useState<ToastData | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    action?: () => void;
  }>({
    isOpen: false,
    title: '',
    message: ''
  });

  // Atualiza status do agendamento no Supabase
  const handleUpdateStatus = async (id: string, newStatus: StatusAgendamento, dataHoraISO?: string) => {
    if (newStatus === 'cancelado' && dataHoraISO) {
      const check = canCancelAppointment(dataHoraISO);
      if (!check.allowed) {
        setToast({
          id: Date.now().toString(),
          type: 'warning',
          message: check.reason || 'Cancelamento não permitido com menos de 30 min de antecedência.'
        });
        return;
      }
    }

    setUpdatingId(id);
    try {
      const { error } = await supabase
        .from('agendamentos')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;

      // Se for cancelamento feito pelo barbeiro/admin, abre o WhatsApp para notificar o cliente!
      if (newStatus === 'cancelado') {
        const itemCancelled = agendamentos.find((a) => a.id === id);
        if (itemCancelled) {
          const waUrl = getClientCancellationWhatsAppLink(itemCancelled);
          setToast({
            id: Date.now().toString(),
            type: 'info',
            message: `Agendamento de ${itemCancelled.cliente_nome} cancelado. Abrindo WhatsApp para avisar o cliente...`
          });
          setTimeout(() => {
            window.open(waUrl, '_blank');
          }, 600);
        }
      } else {
        setToast({
          id: Date.now().toString(),
          type: 'success',
          message: `Status do agendamento alterado para ${newStatus.toUpperCase()}.`
        });
      }

      setAgendamentos((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item))
      );
    } catch (err) {
      console.error('Erro ao atualizar status:', err);
      setToast({
        id: Date.now().toString(),
        type: 'error',
        message: 'Erro ao atualizar o status do agendamento.'
      });
    } finally {
      setUpdatingId(null);
    }
  };

  // Navegação de datas (Hoje, Anterior, Próximo)
  const handleDateChange = (offsetDays: number) => {
    if (!selectedDate) return;
    const parts = selectedDate.split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    d.setDate(d.getDate() + offsetDays);

    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dayStr = String(d.getDate()).padStart(2, '0');
    setSelectedDate(`${y}-${m}-${dayStr}`);
  };

  const handleSetToday = () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    setSelectedDate(`${y}-${m}-${d}`);
  };

  // Métricas do Painel Resumo
  const metrics = useMemo(() => {
    const totalClientes = agendamentos.length;
    const concluidos = agendamentos.filter((a) => a.status === 'concluido').length;
    const pendentes = agendamentos.filter((a) => a.status === 'pendente').length;
    const confirmados = agendamentos.filter((a) => a.status === 'confirmado').length;
    const cancelados = agendamentos.filter((a) => a.status === 'cancelado').length;

    // Faturamento Estimado (sem cancelados)
    const faturamentoEstimado = agendamentos
      .filter((a) => a.status !== 'cancelado')
      .reduce((acc, a) => acc + Number(a.servicos?.preco || 0), 0);

    // Faturamento Realizado (somente concluídos)
    const faturamentoRealizado = agendamentos
      .filter((a) => a.status === 'concluido')
      .reduce((acc, a) => acc + Number(a.servicos?.preco || 0), 0);

    return {
      totalClientes,
      concluidos,
      pendentes,
      confirmados,
      cancelados,
      faturamentoEstimado,
      faturamentoRealizado
    };
  }, [agendamentos]);

  // Lista filtrada
  const filteredAgendamentos = useMemo(() => {
    return agendamentos.filter((item) => {
      // Filtro de Barbeiro
      if (filterBarbeiro !== 'todos' && item.barbeiro_id !== filterBarbeiro) {
        return false;
      }
      // Filtro de Status
      if (filterStatus === 'todos') {
        // Por padrão, oculta agendamentos cancelados da aba geral
        return item.status !== 'cancelado';
      }
      return item.status === filterStatus;
    });
  }, [agendamentos, filterBarbeiro, filterStatus]);

  // Gera link do WhatsApp com mensagem de lembrete/confirmação
  const getWhatsAppLink = (item: AgendamentoCompleto) => {
    const phone = item.cliente_telefone.replace(/\D/g, '');
    const formattedPhone = phone.startsWith('55') ? phone : `55${phone}`;
    
    const timePart = item.data_hora.includes('T') ? item.data_hora.split('T')[1] : item.data_hora;
    const timeStr = timePart.substring(0, 5);
    const dateParts = selectedDate.split('-');
    const dateFormatted = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;

    const msg = encodeURIComponent(
      `Olá ${item.cliente_nome}! 💈\n\n` +
      `Confirmando seu agendamento na *Barbearia VIP*:\n` +
      `✂️ *Serviço:* ${item.servicos?.nome || 'Serviço'}\n` +
      `💈 *Barbeiro:* ${item.barbeiros?.nome || 'Barbeiro'}\n` +
      `📅 *Data:* ${dateFormatted} às ${timeStr}\n\n` +
      `Te esperamos lá! Qualquer dúvida estamos à disposição.`
    );

    return `https://wa.me/${formattedPhone}?text=${msg}`;
  };

  // Badge de Status
  const renderStatusBadge = (status: StatusAgendamento) => {
    switch (status) {
      case 'pendente':
        return (
          <span className="px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-full text-xs font-semibold flex items-center gap-1">
            <Clock3 size={13} /> Pendente
          </span>
        );
      case 'confirmado':
        return (
          <span className="px-2.5 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded-full text-xs font-semibold flex items-center gap-1">
            <CheckCircle2 size={13} /> Confirmado
          </span>
        );
      case 'concluido':
        return (
          <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full text-xs font-semibold flex items-center gap-1">
            <Check size={13} /> Concluído
          </span>
        );
      case 'cancelado':
        return (
          <span className="px-2.5 py-1 bg-rose-500/10 text-rose-400 border border-rose-500/30 rounded-full text-xs font-semibold flex items-center gap-1">
            <XCircle size={13} /> Cancelado
          </span>
        );
      default:
        return null;
    }
  };

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-6 text-center space-y-6 shadow-2xl shadow-amber-500/10">
          <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/30 text-amber-500 rounded-2xl flex items-center justify-center mx-auto">
            <Scissors size={32} />
          </div>

          <div>
            <h2 className="text-xl font-bold text-zinc-100 flex items-center justify-center gap-2">
              Painel Administrativo
              <Sparkles size={16} className="text-amber-400 fill-amber-400" />
            </h2>
            <p className="text-zinc-400 text-xs mt-1">Digite o PIN de acesso para continuar</p>
          </div>

          <form onSubmit={handleLoginPin} className="space-y-4">
            <div className="space-y-1 text-left">
              <label className="text-xs font-semibold text-zinc-400">PIN de Segurança (Padrão: 1234)</label>
              <input
                type="password"
                maxLength={8}
                required
                autoFocus
                placeholder="****"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl py-3 px-4 text-center text-xl font-extrabold text-amber-400 tracking-widest outline-none transition"
              />
            </div>

            {pinError && (
              <p className="text-rose-400 text-xs font-medium text-center animate-in fade-in">{pinError}</p>
            )}

            <button
              type="submit"
              className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl transition shadow-lg shadow-amber-500/20 text-sm"
            >
              Entrar no Painel
            </button>
          </form>

          <a href="/" className="inline-block text-xs text-zinc-500 hover:text-zinc-300 transition">
            &larr; Voltar para a página do cliente
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 pb-16">
      {/* Header Fixo do Painel */}
      <header className="bg-zinc-900/90 backdrop-blur-md border-b border-zinc-800 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/30 text-amber-500 rounded-xl flex items-center justify-center">
              <Scissors size={22} />
            </div>
            <div>
              <h1 className="font-bold text-lg text-zinc-100 flex items-center gap-2">
                Painel Administrativo
                <Sparkles size={16} className="text-amber-400 fill-amber-400" />
              </h1>
              <p className="text-xs text-zinc-400">Gestão de Agendamentos & Faturamento</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="/"
              className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition"
            >
              <Home size={15} /> Ver Site
            </a>
            <button
              onClick={() => setShowConfigModal(true)}
              className="px-3.5 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition"
              title="Configurações da Barbearia"
            >
              <Settings size={15} /> Configurações
            </button>
            <button
              onClick={() => fetchAgendamentos()}
              className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition"
              title="Atualizar dados"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={handleLogout}
              className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold rounded-xl transition"
              title="Bloquear Painel"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      {toastMessage && (
        <div className="bg-amber-500/20 border-b border-amber-500/40 px-4 py-3 text-amber-200 text-xs font-semibold flex items-center justify-between animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-amber-400 animate-pulse" />
            <span>{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="p-1 px-2.5 bg-amber-500/20 hover:bg-amber-500/30 rounded-lg text-amber-300 transition font-bold"
          >
            Fechar
          </button>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 pt-6 space-y-6">
        
        {/* Barra de Navegação de Datas */}
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-lg shadow-black/40">
          <div className="flex items-center gap-2">
            <CalendarIcon size={20} className="text-amber-500" />
            <h2 className="font-bold text-base text-zinc-100">
              Data: {selectedDate ? selectedDate.split('-').reverse().join('/') : ''}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleDateChange(-1)}
              className="p-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl transition flex items-center gap-1 text-xs font-medium"
            >
              <ChevronLeft size={16} /> Anterior
            </button>

            <button
              onClick={handleSetToday}
              className="px-3.5 py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-xl transition text-xs font-bold shadow-md shadow-amber-500/10"
            >
              Hoje
            </button>

            <button
              onClick={() => handleDateChange(1)}
              className="p-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl transition flex items-center gap-1 text-xs font-medium"
            >
              Próximo <ChevronRight size={16} />
            </button>

            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs rounded-xl px-3 py-2 outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* MTRICAS & CARDS DE RESUMO DO DIA */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Card 1: Total Clientes */}
          <div className="bg-zinc-900/80 border border-zinc-800/90 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-xs font-medium">Total de Clientes</span>
              <User size={18} className="text-amber-400" />
            </div>
            <p className="text-2xl font-extrabold text-zinc-100">{metrics.totalClientes}</p>
            <p className="text-[11px] text-zinc-500">Agendamentos hoje</p>
          </div>

          {/* Card 2: Concluídos */}
          <div className="bg-zinc-900/80 border border-zinc-800/90 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-xs font-medium">Concluídos</span>
              <CheckCircle2 size={18} className="text-emerald-400" />
            </div>
            <p className="text-2xl font-extrabold text-emerald-400">{metrics.concluidos}</p>
            <p className="text-[11px] text-zinc-500">
              {metrics.totalClientes > 0 
                ? `${Math.round((metrics.concluidos / metrics.totalClientes) * 100)}% atendidos` 
                : '0% atendidos'}
            </p>
          </div>

          {/* Card 3: Faturamento Estimado */}
          <div className="bg-zinc-900/80 border border-zinc-800/90 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-xs font-medium">Fat. Estimado</span>
              <TrendingUp size={18} className="text-amber-400" />
            </div>
            <p className="text-2xl font-extrabold text-amber-400">
              R$ {metrics.faturamentoEstimado.toFixed(2).replace('.', ',')}
            </p>
            <p className="text-[11px] text-zinc-500">Se todos atenderem</p>
          </div>

          {/* Card 4: Faturamento Realizado */}
          <div className="bg-zinc-900/80 border border-zinc-800/90 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-xs font-medium">Fat. Realizado</span>
              <DollarSign size={18} className="text-emerald-400" />
            </div>
            <p className="text-2xl font-extrabold text-emerald-400">
              R$ {metrics.faturamentoRealizado.toFixed(2).replace('.', ',')}
            </p>
            <p className="text-[11px] text-zinc-500">Somente atendidos</p>
          </div>
        </div>

        {/* FILTROS (BARBEIRO & STATUS) */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-zinc-300 uppercase tracking-wider">
            <Filter size={14} className="text-amber-500" /> Filtros de Visualização
          </div>

          <div className="flex flex-wrap gap-4 items-center justify-between">
            {/* Filtro Barbeiro */}
            <div className="space-y-1.5 flex-1 min-w-[200px]">
              <label className="text-xs font-medium text-zinc-400">Por Barbeiro:</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setFilterBarbeiro('todos')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                    filterBarbeiro === 'todos'
                      ? 'bg-amber-500 text-zinc-950 font-bold shadow-md shadow-amber-500/10'
                      : 'bg-zinc-950 border border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  Ver Todos
                </button>
                {barbeiros.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setFilterBarbeiro(b.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                      filterBarbeiro === b.id
                        ? 'bg-amber-500 text-zinc-950 font-bold shadow-md shadow-amber-500/10'
                        : 'bg-zinc-950 border border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    {b.nome}
                  </button>
                ))}
              </div>
            </div>

            {/* Filtro Status */}
            <div className="space-y-1.5 flex-1 min-w-[240px]">
              <label className="text-xs font-medium text-zinc-400">Por Status:</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'todos', label: 'Todos' },
                  { id: 'pendente', label: 'Pendente' },
                  { id: 'confirmado', label: 'Confirmado' },
                  { id: 'concluido', label: 'Concluído' },
                  { id: 'cancelado', label: 'Cancelado' },
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setFilterStatus(s.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                      filterStatus === s.id
                        ? 'bg-amber-500 text-zinc-950 font-bold shadow-md shadow-amber-500/10'
                        : 'bg-zinc-950 border border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* LISTA DE AGENDAMENTOS DO DIA */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base text-zinc-100 flex items-center gap-2">
              <Clock size={18} className="text-amber-500" />
              Agendamentos do Dia ({filteredAgendamentos.length})
            </h3>
          </div>

          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-3 text-zinc-400">
              <Loader2 size={32} className="animate-spin text-amber-500" />
              <p className="text-sm">Buscando agendamentos no Supabase...</p>
            </div>
          ) : filteredAgendamentos.length === 0 ? (
            <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-12 text-center space-y-3">
              <Scissors size={36} className="text-zinc-600 mx-auto" />
              <p className="text-zinc-400 text-sm font-medium">Nenhum agendamento encontrado para este dia/filtro.</p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {filteredAgendamentos.map((item) => {
                const timePart = item.data_hora.includes('T') ? item.data_hora.split('T')[1] : item.data_hora;
                const timeStr = timePart.substring(0, 5);
                const isUpdating = updatingId === item.id;

                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                      item.status === 'concluido'
                        ? 'bg-zinc-900/40 border-zinc-800/60 opacity-90'
                        : item.status === 'cancelado'
                        ? 'bg-zinc-950 border-rose-950/40 opacity-60'
                        : 'bg-zinc-900/90 border-zinc-800/90 shadow-md shadow-black/20'
                    }`}
                  >
                    {/* Informações Principais */}
                    <div className="flex items-start gap-4 flex-1">
                      {/* Horário Badge */}
                      <div className="w-16 h-14 bg-amber-500/10 border border-amber-500/30 rounded-xl flex flex-col items-center justify-center flex-shrink-0">
                        <span className="text-base font-extrabold text-amber-400">{timeStr}</span>
                        <span className="text-[10px] text-zinc-400">{item.servicos?.duracao_minutos || 30} min</span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h4 className="font-bold text-zinc-100 text-base">{item.cliente_nome}</h4>
                          {renderStatusBadge(item.status)}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-zinc-400 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Scissors size={13} className="text-amber-500" />
                            <strong className="text-zinc-200">{item.servicos?.nome}</strong> (R$ {Number(item.servicos?.preco || 0).toFixed(2)})
                          </span>
                          <span className="text-zinc-600">&bull;</span>
                          <span className="flex items-center gap-1">
                            <User size={13} className="text-zinc-400" />
                            {item.barbeiros?.nome || 'Qualquer Barbeiro'}
                          </span>
                        </div>

                        <p className="text-xs text-zinc-500 flex items-center gap-1">
                          <Phone size={12} /> {item.cliente_telefone}
                        </p>
                      </div>
                    </div>

                    {/* Ações Rápidas (Mudar Status + WhatsApp) */}
                    <div className="flex items-center gap-2 w-full md:w-auto justify-end border-t md:border-t-0 border-zinc-800 pt-3 md:pt-0">
                      {/* Botão WhatsApp */}
                      <a
                        href={getWhatsAppLink(item)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
                        title="Enviar mensagem WhatsApp"
                      >
                        <MessageCircle size={15} /> WhatsApp
                      </a>

                      {/* Botões de Alteração de Status */}
                      {isUpdating ? (
                        <div className="px-4 py-2 text-zinc-400 text-xs flex items-center gap-2">
                          <Loader2 size={16} className="animate-spin text-amber-500" /> Salvando...
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          {item.status !== 'confirmado' && item.status !== 'concluido' && (
                            <button
                              onClick={() => handleUpdateStatus(item.id, 'confirmado')}
                              className="px-2.5 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-xl text-xs font-semibold transition"
                              title="Marcar como Confirmado"
                            >
                              Confirmar
                            </button>
                          )}

                          {item.status !== 'concluido' && (
                            <button
                              onClick={() => handleUpdateStatus(item.id, 'concluido')}
                              className="px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-semibold transition"
                              title="Marcar como Concluído"
                            >
                              Concluir
                            </button>
                          )}

                          {item.status !== 'cancelado' && (
                            <button
                              onClick={() => handleUpdateStatus(item.id, 'cancelado', item.data_hora)}
                              className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-semibold transition"
                              title="Cancelar Agendamento"
                            >
                              Cancelar
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Configurações da Barbearia */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="font-bold text-lg text-zinc-100 flex items-center gap-2">
                <Settings className="text-amber-500" size={20} />
                Configurações da Barbearia
              </h3>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-zinc-400 hover:text-zinc-100 text-xl font-bold p-1"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">
                  Número do WhatsApp da Barbearia (com DDD)
                </label>
                <p className="text-[11px] text-zinc-500">
                  É para este número que os clientes enviarão a mensagem automática de agendamento.
                </p>
                <div className="relative pt-1">
                  <Phone size={18} className="absolute left-3.5 top-4.5 text-zinc-500" />
                  <input
                    type="tel"
                    required
                    placeholder="5562999999999 ou (62) 99999-9999"
                    value={barbeariaWhatsApp}
                    onChange={(e) => setBarbeariaWhatsApp(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl py-3 pl-10 pr-4 text-sm text-zinc-100 outline-none transition"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold rounded-xl text-xs transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingConfig || !barbeariaWhatsApp}
                  className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-bold rounded-xl text-xs transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-1.5"
                >
                  {savingConfig ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Salvando...
                    </>
                  ) : (
                    <>Salvar Configuração</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Componentes de Notificação Customizados */}
      <NotificationToast toast={toast} onClose={() => setToast(null)} />

      <CustomConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText="Confirmar"
        cancelText="Voltar"
        onConfirm={() => {
          if (confirmModal.action) confirmModal.action();
          setConfirmModal({ isOpen: false, title: '', message: '' });
        }}
        onCancel={() => setConfirmModal({ isOpen: false, title: '', message: '' })}
      />
    </main>
  );
}
