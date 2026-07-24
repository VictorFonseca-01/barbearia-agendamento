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
  Loader2
} from 'lucide-react';

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

  // Filtros
  const [filterBarbeiro, setFilterBarbeiro] = useState<string>('todos');
  const [filterStatus, setFilterStatus] = useState<string>('todos');

  // Inicializa data como Hoje
  useEffect(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    setSelectedDate(`${y}-${m}-${d}`);
  }, []);

  // Busca barbeiros para os filtros
  useEffect(() => {
    async function fetchBarbeiros() {
      const { data } = await supabase.from('barbeiros').select('*').order('nome');
      if (data) setBarbeiros(data);
    }
    fetchBarbeiros();
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

  // Atualiza status do agendamento no Supabase
  const handleUpdateStatus = async (id: string, newStatus: StatusAgendamento) => {
    setUpdatingId(id);
    try {
      const { error } = await supabase
        .from('agendamentos')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;

      // Atualiza estado local instantaneamente
      setAgendamentos((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item))
      );
    } catch (err) {
      console.error('Erro ao atualizar status:', err);
      alert('Erro ao atualizar o status do agendamento.');
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
      if (filterStatus !== 'todos' && item.status !== filterStatus) {
        return false;
      }
      return true;
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
              <Home size={15} /> Ver Site do Cliente
            </a>
            <button
              onClick={() => fetchAgendamentos()}
              className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition"
              title="Atualizar dados"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </header>

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
                              onClick={() => handleUpdateStatus(item.id, 'cancelado')}
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
    </main>
  );
}
