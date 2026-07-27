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
  Loader2,
  PlusCircle,
  Coffee
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

// 1. ALERTA SONORO (Web Audio API sintetizado sem arquivos mp3 externos)
const playNewBookingChime = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1174.66, now + 0.05); // D6

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now + 0.05);
    osc1.stop(now + 0.4);
    osc2.stop(now + 0.4);
  } catch (err) {
    console.error('Erro ao emitir sinal sonoro:', err);
  }
};

export default function AdminPage() {
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [agendamentos, setAgendamentos] = useState<AgendamentoCompleto[]>([]);
  const [barbeiros, setBarbeiros] = useState<Barbeiro[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
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

  // Modal Agendamento de Balcão / Pausa / Encaixe
  const [showBalcaoModal, setShowBalcaoModal] = useState<boolean>(false);
  const [isPausaAlmoco, setIsPausaAlmoco] = useState<boolean>(false);
  const [balcaoBarbeiroId, setBalcaoBarbeiroId] = useState<string>('');
  const [balcaoServicoId, setBalcaoServicoId] = useState<string>('');
  const [balcaoHorario, setBalcaoHorario] = useState<string>('09:00');
  const [balcaoClienteNome, setBalcaoClienteNome] = useState<string>('');
  const [balcaoClienteTelefone, setBalcaoClienteTelefone] = useState<string>('');
  const [savingBalcao, setSavingBalcao] = useState<boolean>(false);

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
        message: 'WhatsApp da barbearia atualizado no Supabase!'
      });
      setShowConfigModal(false);
    } catch (err) {
      console.error('Erro ao salvar configuração:', err);
      setToast({ id: Date.now().toString(), type: 'error', message: 'Erro ao salvar o número do WhatsApp.' });
    } finally {
      setSavingConfig(false);
    }
  };

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

  // SUPABASE REALTIME EM TEMPO REAL COM ALERTA SONORO WEB AUDIO API
  useEffect(() => {
    const channel = supabase
      .channel('realtime_admin_agendamentos')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agendamentos' },
        (payload: any) => {
          if (payload.eventType === 'INSERT') {
            playNewBookingChime(); // ALERTA SONORO SINTETIZADO
            setToast({
              id: Date.now().toString(),
              type: 'success',
              message: '✨ NOVO AGENDAMENTO: Um novo cliente agendou pelo site!'
            });
          } else if (payload.eventType === 'UPDATE' && payload.new.status === 'cancelado') {
            setToast({
              id: Date.now().toString(),
              type: 'warning',
              message: '⚠️ ATENÇÃO: Um agendamento foi CANCELADO pelo cliente!'
            });
          }
          fetchAgendamentos();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAgendamentos]);

  // Carrega barbeiros e serviços
  useEffect(() => {
    async function fetchAuxData() {
      const [barbeirosRes, servicosRes] = await Promise.all([
        supabase.from('barbeiros').select('*').order('nome'),
        supabase.from('servicos').select('*').order('preco')
      ]);
      if (barbeirosRes.data) {
        setBarbeiros(barbeirosRes.data);
        if (barbeirosRes.data.length > 0) setBalcaoBarbeiroId(barbeirosRes.data[0].id);
      }
      if (servicosRes.data) {
        setServicos(servicosRes.data);
        if (servicosRes.data.length > 0) setBalcaoServicoId(servicosRes.data[0].id);
      }
    }
    fetchAuxData();
  }, []);

  // Mensagem WhatsApp para o cliente quando cancelado pelo admin
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

  // Validação 30 minutos de antecedência
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

  // 4. UI OTIMISTA: Atualiza o estado local instantaneamente antes da resposta do Supabase
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

    // SNAPSHOT PARA ROLLBACK CASO A REQUISIÇÃO FALHE
    const previousAgendamentos = [...agendamentos];

    // ATUALIZAÇÃO OTIMISTA IMEDIATA DA UI
    setAgendamentos((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item))
    );

    setUpdatingId(id);

    try {
      const { error } = await supabase
        .from('agendamentos')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;

      if (newStatus === 'cancelado') {
        const itemCancelled = previousAgendamentos.find((a) => a.id === id);
        if (itemCancelled && itemCancelled.cliente_telefone !== '00000000000') {
          const waUrl = getClientCancellationWhatsAppLink(itemCancelled);
          setToast({
            id: Date.now().toString(),
            type: 'info',
            message: `Agendamento cancelado. Abrindo WhatsApp para avisar ${itemCancelled.cliente_nome}...`
          });
          setTimeout(() => {
            window.open(waUrl, '_blank');
          }, 600);
        }
      } else {
        setToast({
          id: Date.now().toString(),
          type: 'success',
          message: `Status atualizado para ${newStatus.toUpperCase()}`
        });
      }
    } catch (err) {
      console.error('Erro na atualização:', err);
      // REVERTE A UI EM CASO DE ERRO (ROLLBACK)
      setAgendamentos(previousAgendamentos);
      setToast({
        id: Date.now().toString(),
        type: 'error',
        message: 'Erro ao atualizar o status. Revertendo alteração.'
      });
    } finally {
      setUpdatingId(null);
    }
  };

  // 2 & 3. SUBMISSÃO DE AGENDAMENTO DE BALCÃO / ENCAIXE / PAUSA ALMOÇO
  const handleSaveBalcaoAgendamento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!balcaoBarbeiroId || (!isPausaAlmoco && !balcaoServicoId)) {
      setToast({ id: Date.now().toString(), type: 'warning', message: 'Selecione barbeiro e serviço.' });
      return;
    }

    setSavingBalcao(true);

    try {
      const targetServicoId = balcaoServicoId || (servicos.length > 0 ? servicos[0].id : '');
      const nomeFinal = isPausaAlmoco ? '☕ PAUSA / ALMOÇO' : (balcaoClienteNome.trim() || 'Cliente Balcão');
      const telefoneFinal = isPausaAlmoco ? '00000000000' : (balcaoClienteTelefone.trim() || '00000000000');
      const dataHoraISO = `${selectedDate}T${balcaoHorario}:00`;

      const { data: inserted, error } = await supabase.from('agendamentos').insert([
        {
          barbeiro_id: balcaoBarbeiroId,
          servico_id: targetServicoId,
          cliente_nome: nomeFinal,
          cliente_telefone: telefoneFinal,
          data_hora: dataHoraISO,
          status: 'confirmado'
        }
      ]).select(`
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
      `);

      if (error) throw error;

      if (inserted && inserted.length > 0) {
        setAgendamentos((prev) => [...prev, inserted[0] as unknown as AgendamentoCompleto].sort((a, b) => a.data_hora.localeCompare(b.data_hora)));
      }

      setToast({
        id: Date.now().toString(),
        type: 'success',
        message: isPausaAlmoco ? 'Horário bloqueado para Pausa/Almoço!' : 'Agendamento de balcão registrado!'
      });

      setShowBalcaoModal(false);
      setBalcaoClienteNome('');
      setBalcaoClienteTelefone('');
      setIsPausaAlmoco(false);
    } catch (err: any) {
      console.error('Erro ao criar balcão:', err);
      setToast({ id: Date.now().toString(), type: 'error', message: err.message || 'Erro ao registrar agendamento.' });
    } finally {
      setSavingBalcao(false);
    }
  };

  // Navegação de datas
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

  // Métricas do Painel
  const metrics = useMemo(() => {
    const totalClientes = agendamentos.length;
    const concluidos = agendamentos.filter((a) => a.status === 'concluido').length;
    const pendentes = agendamentos.filter((a) => a.status === 'pendente').length;
    const confirmados = agendamentos.filter((a) => a.status === 'confirmado').length;
    const cancelados = agendamentos.filter((a) => a.status === 'cancelado').length;

    const faturamentoEstimado = agendamentos
      .filter((a) => a.status !== 'cancelado')
      .reduce((acc, a) => acc + Number(a.servicos?.preco || 0), 0);

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
      if (filterBarbeiro !== 'todos' && item.barbeiro_id !== filterBarbeiro) return false;
      if (filterStatus !== 'todos' && item.status !== filterStatus) return false;
      return true;
    });
  }, [agendamentos, filterBarbeiro, filterStatus]);

  const timeSlots = useMemo(() => {
    const slots = [];
    for (let h = 9; h < 19; h++) {
      for (let m of [0, 30]) {
        slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      }
    }
    return slots;
  }, []);

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
                maxLength={16}
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

          <div className="flex items-center gap-2 flex-wrap">
            {/* BOTÃO + NOVO AGENDAMENTO / BALCÃO */}
            <button
              onClick={() => {
                setIsPausaAlmoco(false);
                setShowBalcaoModal(true);
              }}
              className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-black rounded-xl flex items-center gap-1.5 transition shadow-lg shadow-amber-500/10"
            >
              <PlusCircle size={16} /> + Novo / Balcão
            </button>

            <button
              onClick={() => setShowConfigModal(true)}
              className="px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition"
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
            >
              Sair
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

        {/* MÉTRICAS & CARDS DE RESUMO DO DIA */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-zinc-900/80 border border-zinc-800/90 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-xs font-medium">Total de Clientes</span>
              <User size={18} className="text-amber-400" />
            </div>
            <p className="text-2xl font-extrabold text-zinc-100">{metrics.totalClientes}</p>
            <p className="text-[11px] text-zinc-500">Agendamentos hoje</p>
          </div>

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
                const isPausa = item.cliente_nome.includes('PAUSA');

                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                      isPausa
                        ? 'bg-amber-950/20 border-amber-500/40'
                        : item.status === 'concluido'
                        ? 'bg-zinc-900/40 border-zinc-800/60 opacity-90'
                        : item.status === 'cancelado'
                        ? 'bg-zinc-950 border-rose-950/40 opacity-60'
                        : 'bg-zinc-900/90 border-zinc-800/90 shadow-md shadow-black/20'
                    }`}
                  >
                    <div className="flex items-start gap-4 flex-1">
                      <div className="w-16 h-14 bg-amber-500/10 border border-amber-500/30 rounded-xl flex flex-col items-center justify-center flex-shrink-0">
                        <span className="text-base font-extrabold text-amber-400">{timeStr}</span>
                        <span className="text-[10px] text-zinc-400">{item.servicos?.duracao_minutos || 30} min</span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h4 className="font-bold text-zinc-100 text-base flex items-center gap-1.5">
                            {isPausa && <Coffee size={16} className="text-amber-400" />}
                            {item.cliente_nome}
                          </h4>
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

                        {!isPausa && (
                          <p className="text-xs text-zinc-500 flex items-center gap-1">
                            <Phone size={12} /> {item.cliente_telefone}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto justify-end border-t md:border-t-0 border-zinc-800 pt-3 md:pt-0">
                      {!isPausa && (
                        <a
                          href={getWhatsAppLink(item)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
                          title="Enviar mensagem WhatsApp"
                        >
                          <MessageCircle size={15} /> WhatsApp
                        </a>
                      )}

                      {/* Botões de Alteração Otimista de Status */}
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

      {/* 2 & 3. MODAL DE AGENDAMENTO DE BALCÃO / ENCAIXE / BLOQUEIO DE PAUSA */}
      {showBalcaoModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="font-bold text-lg text-zinc-100 flex items-center gap-2">
                <PlusCircle className="text-amber-500" size={20} />
                Novo Agendamento / Balcão
              </h3>
              <button
                onClick={() => setShowBalcaoModal(false)}
                className="text-zinc-400 hover:text-zinc-100 text-xl font-bold p-1"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveBalcaoAgendamento} className="space-y-4">
              {/* Opção Bloqueio de Pausa/Almoço */}
              <div
                onClick={() => setIsPausaAlmoco(!isPausaAlmoco)}
                className={`p-3.5 rounded-2xl border cursor-pointer flex items-center justify-between transition ${
                  isPausaAlmoco
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center gap-2 text-xs">
                  <Coffee size={18} className="text-amber-400" />
                  <span>Bloquear Horário (Pausa / Almoço)</span>
                </div>
                <input
                  type="checkbox"
                  checked={isPausaAlmoco}
                  onChange={() => {}}
                  className="w-4 h-4 accent-amber-500 cursor-pointer"
                />
              </div>

              {/* Barbeiro */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-400">Barbeiro</label>
                <select
                  value={balcaoBarbeiroId}
                  onChange={(e) => setBalcaoBarbeiroId(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs rounded-xl p-3 outline-none focus:border-amber-500"
                >
                  {barbeiros.map((b) => (
                    <option key={b.id} value={b.id}>{b.nome}</option>
                  ))}
                </select>
              </div>

              {/* Serviço */}
              {!isPausaAlmoco && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-400">Serviço</label>
                  <select
                    value={balcaoServicoId}
                    onChange={(e) => setBalcaoServicoId(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs rounded-xl p-3 outline-none focus:border-amber-500"
                  >
                    {servicos.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nome} ({s.duracao_minutos} min - R$ {Number(s.preco).toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Horário */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-400">Horário</label>
                <select
                  value={balcaoHorario}
                  onChange={(e) => setBalcaoHorario(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs rounded-xl p-3 outline-none focus:border-amber-500"
                >
                  {timeSlots.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* Nome e Telefone do Cliente Balcão */}
              {!isPausaAlmoco && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-400">Nome do Cliente</label>
                    <input
                      type="text"
                      placeholder="Ex: Pedro Balcão"
                      value={balcaoClienteNome}
                      onChange={(e) => setBalcaoClienteNome(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs rounded-xl p-3 outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-400">Telefone (Opcional)</label>
                    <input
                      type="tel"
                      placeholder="(62) 99999-9999"
                      value={balcaoClienteTelefone}
                      onChange={(e) => setBalcaoClienteTelefone(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs rounded-xl p-3 outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowBalcaoModal(false)}
                  className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold rounded-xl text-xs transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingBalcao}
                  className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-bold rounded-xl text-xs transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-1.5"
                >
                  {savingBalcao ? <Loader2 size={16} className="animate-spin" /> : 'Confirmar Reserva'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
