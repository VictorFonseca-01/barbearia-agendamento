'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Barbeiro, Servico } from '@/types/database';
import { 
  Scissors, 
  User, 
  Calendar as CalendarIcon, 
  Clock, 
  CheckCircle2, 
  Phone, 
  Sparkles, 
  ChevronRight, 
  ChevronLeft, 
  Check, 
  Loader2,
  MapPin,
  Award,
  MessageCircle,
  AlertCircle
} from 'lucide-react';
import { NotificationToast, CustomConfirmModal, ToastData } from '@/components/NotificationToast';

const WHATSAPP_BARBEARIA = process.env.NEXT_PUBLIC_WHATSAPP_BARBEARIA || '5562999999999';

interface ExistingAppointment {
  id: string;
  barbeiro_id: string;
  startMinutes: number;
  endMinutes: number;
}

interface MyBookingItem {
  id: string;
  data_hora: string;
  cliente_nome: string;
  cliente_telefone: string;
  status: string;
  barbeiros?: { nome: string };
  servicos?: { nome: string; preco: number; duracao_minutos: number };
}

export default function Home() {
  const [step, setStep] = useState<number>(1);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [barbeiros, setBarbeiros] = useState<Barbeiro[]>([]);
  const [loadingData, setLoadingData] = useState<boolean>(true);

  // Seleções do formulário
  const [selectedServico, setSelectedServico] = useState<Servico | null>(null);
  const [selectedBarbeiro, setSelectedBarbeiro] = useState<Barbeiro | 'qualquer' | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [clienteNome, setClienteNome] = useState<string>('');
  const [clienteTelefone, setClienteTelefone] = useState<string>('');

  // Agendamentos ocupados no dia
  const [existingAppointments, setExistingAppointments] = useState<ExistingAppointment[]>([]);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [completed, setCompleted] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Estado dos agendamentos do cliente no aparelho (Zero-Friction Client Portal)
  const [myBookings, setMyBookings] = useState<MyBookingItem[]>([]);
  const [showMyBookingsModal, setShowMyBookingsModal] = useState<boolean>(false);
  const [searchPhoneInput, setSearchPhoneInput] = useState<string>('');
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Estado de Toasts e Confirmações
  const [toast, setToast] = useState<ToastData | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    item: MyBookingItem | null;
  }>({
    isOpen: false,
    title: '',
    message: '',
    item: null
  });

  // Busca agendamentos do aparelho do cliente
  const loadMyBookings = useCallback(async () => {
    try {
      const storedIds = JSON.parse(localStorage.getItem('barbearia_meus_ids') || '[]');
      if (!storedIds || storedIds.length === 0) return;

      const { data } = await supabase
        .from('agendamentos')
        .select('id, data_hora, cliente_nome, cliente_telefone, status, barbeiros(nome), servicos(nome, preco, duracao_minutos)')
        .in('id', storedIds)
        .neq('status', 'cancelado')
        .order('data_hora', { ascending: true });

      if (data) {
        setMyBookings(data as unknown as MyBookingItem[]);
      }
    } catch (err) {
      console.error('Erro ao carregar meus agendamentos:', err);
    }
  }, []);

  useEffect(() => {
    loadMyBookings();
  }, [loadMyBookings]);

  // Busca agendamentos digitando número de WhatsApp (caso tenha trocado de aparelho)
  const handleSearchByPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchPhoneInput.trim()) return;

    const cleanPhone = searchPhoneInput.replace(/\D/g, '');
    try {
      const { data, error } = await supabase
        .from('agendamentos')
        .select('id, data_hora, cliente_nome, cliente_telefone, status, barbeiros(nome), servicos(nome, preco, duracao_minutos)')
        .ilike('cliente_telefone', `%${cleanPhone}%`)
        .neq('status', 'cancelado')
        .order('data_hora', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        setMyBookings(data as unknown as MyBookingItem[]);
        const newIds = data.map((d: any) => d.id);
        localStorage.setItem('barbearia_meus_ids', JSON.stringify(newIds));
        setToast({ id: Date.now().toString(), type: 'success', message: 'Agendamentos localizados com sucesso!' });
      } else {
        setToast({ id: Date.now().toString(), type: 'warning', message: 'Nenhum agendamento ativo encontrado para este número de WhatsApp.' });
      }
    } catch (err) {
      console.error('Erro na busca por telefone:', err);
      setToast({ id: Date.now().toString(), type: 'error', message: 'Ocorreu um erro ao buscar seus agendamentos.' });
    }
  };

  // Abre a modal customizada de confirmação de cancelamento
  const promptClientCancelBooking = (item: MyBookingItem) => {
    const timePart = item.data_hora.includes('T') ? item.data_hora.split('T')[1] : item.data_hora;
    const datePart = item.data_hora.includes('T') ? item.data_hora.split('T')[0] : selectedDate;
    
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes] = timePart.substring(0, 5).split(':').map(Number);

    const appointmentTime = new Date(year, month - 1, day, hours, minutes);
    const now = new Date();
    const diffMs = appointmentTime.getTime() - now.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes < 30) {
      setToast({
        id: Date.now().toString(),
        type: 'warning',
        message: '⚠️ Cancelamentos só são permitidos com no mínimo 30 minutos de antecedência. Entre em contato direto com a barbearia pelo WhatsApp.'
      });
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Cancelar Agendamento',
      message: `Tem certeza que deseja cancelar seu agendamento de "${item.servicos?.nome}"? A vaga será liberada imediatamente.`,
      item
    });
  };

  // Executa a confirmação do cancelamento pelo cliente
  const executeClientCancelBooking = async () => {
    const item = confirmModal.item;
    if (!item) return;

    setConfirmModal({ isOpen: false, title: '', message: '', item: null });
    setCancellingId(item.id);

    try {
      const timePart = item.data_hora.includes('T') ? item.data_hora.split('T')[1] : item.data_hora;
      const datePart = item.data_hora.includes('T') ? item.data_hora.split('T')[0] : selectedDate;
      const [year, month, day] = datePart.split('-').map(Number);

      const { error } = await supabase
        .from('agendamentos')
        .update({ status: 'cancelado' })
        .eq('id', item.id);

      if (error) throw error;

      setMyBookings((prev) => prev.filter((b) => b.id !== item.id));

      const dateFormatted = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
      const msg = encodeURIComponent(
        `⚠️ *NOTIFICAÇÃO DE CANCELAMENTO PELO CLIENTE*\n\n` +
        `Olá! Sou *${item.cliente_nome}* (Tel: ${item.cliente_telefone}).\n` +
        `Cancelei meu agendamento de *${item.servicos?.nome}* com o barbeiro *${item.barbeiros?.nome}* marcado para *${dateFormatted} às ${timePart.substring(0, 5)}*.\n\n` +
        `A vaga foi liberada no sistema!`
      );

      setToast({ id: Date.now().toString(), type: 'success', message: 'Seu agendamento foi cancelado com sucesso. Vaga liberada!' });
      
      setTimeout(() => {
        window.open(`https://wa.me/${WHATSAPP_BARBEARIA}?text=${msg}`, '_blank');
      }, 800);
    } catch (err) {
      console.error('Erro ao cancelar agendamento:', err);
      setToast({ id: Date.now().toString(), type: 'error', message: 'Ocorreu um erro ao cancelar o agendamento.' });
    } finally {
      setCancellingId(null);
    }
  };

  // 1. Carrega serviços e barbeiros do Supabase
  useEffect(() => {
    async function fetchData() {
      setLoadingData(true);
      try {
        const [servicosRes, barbeirosRes] = await Promise.all([
          supabase.from('servicos').select('*').order('preco', { ascending: true }),
          supabase.from('barbeiros').select('*').eq('ativo', true).order('nome', { ascending: true })
        ]);

        if (servicosRes.data) setServicos(servicosRes.data);
        if (barbeirosRes.data) setBarbeiros(barbeirosRes.data);
      } catch (err) {
        console.error('Erro ao carregar dados:', err);
      } finally {
        setLoadingData(false);
      }
    }
    fetchData();

    // Data padrão: Hoje no formato YYYY-MM-DD local
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    setSelectedDate(`${year}-${month}-${day}`);
  }, []);

  // 2. Função recarregável para buscar agendamentos do dia
  const fetchDayAppointments = useCallback(async () => {
    if (!selectedDate) return;
    try {
      // Intervalo do dia local
      const startOfDay = `${selectedDate}T00:00:00`;
      const endOfDay = `${selectedDate}T23:59:59`;

      const { data, error } = await supabase
        .from('agendamentos')
        .select('id, barbeiro_id, data_hora, servicos(duracao_minutos)')
        .neq('status', 'cancelado')
        .gte('data_hora', startOfDay)
        .lte('data_hora', endOfDay);

      if (error) throw error;

      if (data) {
        const parsed: ExistingAppointment[] = data.map((item: any) => {
          const timePart = item.data_hora.includes('T') ? item.data_hora.split('T')[1] : item.data_hora;
          const [hStr, mStr] = timePart.split(':');
          const hours = parseInt(hStr, 10);
          const minutes = parseInt(mStr, 10);
          const startMinutes = hours * 60 + minutes;
          const duration = item.servicos?.duracao_minutos || 30;
          const endMinutes = startMinutes + duration;

          return {
            id: item.id,
            barbeiro_id: item.barbeiro_id,
            startMinutes,
            endMinutes
          };
        });

        setExistingAppointments(parsed);
      }
    } catch (err) {
      console.error('Erro ao buscar agendamentos:', err);
    }
  }, [selectedDate]);

  // Recarrega os agendamentos sempre que mudar a data, o passo (wizard) ou o barbeiro
  useEffect(() => {
    fetchDayAppointments();
  }, [fetchDayAppointments, step, selectedBarbeiro]);

  // Gera os próximos 7 dias no fuso horário local
  const datesList = useMemo(() => {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const dayNum = String(d.getDate()).padStart(2, '0');
      const iso = `${year}-${month}-${dayNum}`;

      const dayName = i === 0 ? 'Hoje' : d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
      const monthName = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');

      dates.push({ iso, dayName, dayNum: d.getDate(), monthName });
    }
    return dates;
  }, []);

  // Slots das 09:00 às 19:00 (intervalos de 30 min)
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let h = 9; h < 19; h++) {
      for (let m of [0, 30]) {
        slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      }
    }
    return slots;
  }, []);

  // Converte "HH:MM" para minutos a partir da meia-noite
  const timeToMinutes = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };

  // Verifica se um barbeiro específico está ocupado em um intervalo de tempo [start, end)
  const isBarberBusy = (barberId: string, slotStart: number, slotEnd: number) => {
    return existingAppointments.some((app) => {
      if (app.barbeiro_id !== barberId) return false;
      // Há sobreposição se max(start1, start2) < min(end1, end2)
      return Math.max(slotStart, app.startMinutes) < Math.min(slotEnd, app.endMinutes);
    });
  };

  // Determina se um horário está bloqueado para o serviço e barbeiro selecionados
  const isSlotDisabled = (timeStr: string) => {
    if (!selectedServico) return false;

    const slotStart = timeToMinutes(timeStr);
    const serviceDuration = selectedServico.duracao_minutos || 30;
    const slotEnd = slotStart + serviceDuration;

    // Se o serviço ultrapassa o horário de funcionamento da barbearia (19:00 = 1140 min)
    if (slotEnd > 1140) return true;

    // Se o cliente escolheu um barbeiro específico
    if (selectedBarbeiro && selectedBarbeiro !== 'qualquer') {
      return isBarberBusy(selectedBarbeiro.id, slotStart, slotEnd);
    }

    // Se escolheu "Qualquer Barbeiro": o horário só estará bloqueado se TODOS os barbeiros ativos estiverem ocupados
    if (barbeiros.length === 0) return true;
    const allBarbersBusy = barbeiros.every((barber) => isBarberBusy(barber.id, slotStart, slotEnd));
    return allBarbersBusy;
  };

  // Encontra um barbeiro disponível para o horário e serviço selecionados
  const getAvailableBarberForSlot = (timeStr: string): Barbeiro | null => {
    if (selectedBarbeiro && selectedBarbeiro !== 'qualquer') {
      return selectedBarbeiro;
    }

    const slotStart = timeToMinutes(timeStr);
    const serviceDuration = selectedServico?.duracao_minutos || 30;
    const slotEnd = slotStart + serviceDuration;

    // Encontra o primeiro barbeiro livre no horário
    const freeBarber = barbeiros.find((barber) => !isBarberBusy(barber.id, slotStart, slotEnd));
    return freeBarber || null;
  };

  // Submissão do formulário de agendamento
  const handleConfirmAgendamento = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!selectedServico || !selectedBarbeiro || !selectedDate || !selectedTime || !clienteNome || !clienteTelefone) {
      setErrorMessage('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    // Determina o barbeiro final
    const assignedBarber = getAvailableBarberForSlot(selectedTime);
    if (!assignedBarber) {
      setErrorMessage('Desculpe, o barbeiro selecionado não está mais disponível neste horário. Escolha outro horário.');
      return;
    }

    setSubmitting(true);

    try {
      // Re-validação anti-conflito no servidor antes de inserir
      const slotStart = timeToMinutes(selectedTime);
      const serviceDuration = selectedServico.duracao_minutos || 30;
      const slotEnd = slotStart + serviceDuration;

      if (isBarberBusy(assignedBarber.id, slotStart, slotEnd)) {
        throw new Error('Este horário já foi preenchido por outro cliente. Por favor, escolha outro horário.');
      }

      // Formata data e hora ISO
      const dataHoraISO = `${selectedDate}T${selectedTime}:00`;

      const { data: insertedData, error } = await supabase.from('agendamentos').insert([
        {
          barbeiro_id: assignedBarber.id,
          servico_id: selectedServico.id,
          cliente_nome: clienteNome.trim(),
          cliente_telefone: clienteTelefone.trim(),
          data_hora: dataHoraISO,
          status: 'pendente'
        }
      ]).select();

      if (error) throw error;

      // Salva ID no dispositivo do cliente
      if (insertedData && insertedData.length > 0) {
        try {
          const storedIds = JSON.parse(localStorage.getItem('barbearia_meus_ids') || '[]');
          storedIds.push(insertedData[0].id);
          localStorage.setItem('barbearia_meus_ids', JSON.stringify(storedIds));
        } catch (e) {
          console.error(e);
        }
      }

      // Recarrega agendamentos do dia e meus agendamentos
      await fetchDayAppointments();
      await loadMyBookings();

      setCompleted(true);

      // Prepara mensagem formatada do WhatsApp
      const dataParts = selectedDate.split('-');
      const dataFormatada = `${dataParts[2]}/${dataParts[1]}/${dataParts[0]}`;

      const mensagemWhatsApp = encodeURIComponent(
        `Olá! Fiz um agendamento pelo site online:\n\n` +
        `✂️ *Serviço:* ${selectedServico.nome} (${selectedServico.duracao_minutos} min - R$ ${Number(selectedServico.preco).toFixed(2)})\n` +
        `💈 *Barbeiro:* ${assignedBarber.nome}\n` +
        `📅 *Data:* ${dataFormatada}\n` +
        `⏰ *Horário:* ${selectedTime}\n` +
        `👤 *Cliente:* ${clienteNome.trim()}\n` +
        `📱 *Contato:* ${clienteTelefone.trim()}\n\n` +
        `Aguardando confirmação!`
      );

      const urlWhatsApp = `https://wa.me/${WHATSAPP_BARBEARIA}?text=${mensagemWhatsApp}`;

      setTimeout(() => {
        window.open(urlWhatsApp, '_blank');
      }, 600);

    } catch (err: any) {
      console.error('Erro ao salvar agendamento:', err);
      setErrorMessage(err.message || 'Ocorreu um erro ao salvar seu agendamento. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  if (completed) {
    const assignedBarberName = selectedBarbeiro === 'qualquer' 
      ? getAvailableBarberForSlot(selectedTime)?.nome || 'Profissional da Casa' 
      : selectedBarbeiro?.nome;

    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-between pb-12">
        {/* Header Fixo */}
        <header className="w-full bg-zinc-900/90 backdrop-blur-md border-b border-zinc-800/80 sticky top-0 z-50 mb-4">
          <div className="max-w-md mx-auto px-4 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/30 text-amber-500 rounded-xl flex items-center justify-center">
                <Scissors size={22} />
              </div>
              <div>
                <h1 className="font-bold text-base tracking-wide text-zinc-100 flex items-center gap-1.5">
                  BARBEARIA VIP
                  <Sparkles size={14} className="text-amber-400 fill-amber-400" />
                </h1>
                <p className="text-xs text-zinc-400 flex items-center gap-1">
                  <MapPin size={12} className="text-zinc-500" /> Agendamento Online
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowMyBookingsModal(true)}
              className="relative px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-400 font-semibold rounded-xl text-xs flex items-center gap-1.5 transition"
            >
              <CalendarIcon size={14} />
              <span>Meus Agendamentos</span>
              {myBookings.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping absolute -top-0.5 -right-0.5" />
              )}
            </button>
          </div>
        </header>

        <div className="w-full max-w-md px-4 my-auto">
          <div className="w-full bg-zinc-900 border border-zinc-800 rounded-3xl p-6 text-center space-y-6 shadow-2xl shadow-amber-500/10">
            <div className="w-20 h-20 bg-amber-500/10 border border-amber-500/30 text-amber-500 rounded-full flex items-center justify-center mx-auto animate-bounce">
              <CheckCircle2 size={44} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-zinc-100">Agendamento Realizado!</h2>
              <p className="text-zinc-400 text-sm mt-2">
                Seu horário foi reservado com sucesso no sistema.
              </p>
            </div>

            <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-4 text-left space-y-3">
              <div className="flex justify-between items-center text-sm border-b border-zinc-800 pb-2">
                <span className="text-zinc-400">Serviço</span>
                <span className="font-semibold text-amber-400">{selectedServico?.nome} ({selectedServico?.duracao_minutos} min)</span>
              </div>
              <div className="flex justify-between items-center text-sm border-b border-zinc-800 pb-2">
                <span className="text-zinc-400">Barbeiro</span>
                <span className="font-medium text-zinc-200">{assignedBarberName}</span>
              </div>
              <div className="flex justify-between items-center text-sm border-b border-zinc-800 pb-2">
                <span className="text-zinc-400">Data & Hora</span>
                <span className="font-medium text-zinc-200">{selectedDate.split('-').reverse().join('/')} às {selectedTime}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-zinc-400">Valor</span>
                <span className="font-bold text-amber-400">R$ {Number(selectedServico?.preco).toFixed(2).replace('.', ',')}</span>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <a
                href={`https://wa.me/${WHATSAPP_BARBEARIA}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-600/20"
              >
                <MessageCircle size={20} />
                Abrir WhatsApp da Barbearia
              </a>

              <button
                onClick={() => setShowMyBookingsModal(true)}
                className="w-full py-3.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold rounded-xl flex items-center justify-center gap-2 transition text-sm"
              >
                <CalendarIcon size={18} />
                Ver Meus Agendamentos
              </button>

              <button
                onClick={() => {
                  setCompleted(false);
                  setStep(1);
                  setSelectedServico(null);
                  setSelectedBarbeiro(null);
                  setSelectedTime('');
                  setClienteNome('');
                  setClienteTelefone('');
                  setErrorMessage('');
                }}
                className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl transition text-sm"
              >
                Fazer Novo Agendamento
              </button>
            </div>
          </div>
        </div>

        {/* Modal de Meus Agendamentos na tela de confirmação */}
        {showMyBookingsModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-5 relative max-h-[90vh] overflow-y-auto shadow-2xl text-left">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <h3 className="font-bold text-lg text-zinc-100 flex items-center gap-2">
                  <CalendarIcon className="text-amber-500" size={20} />
                  Meus Agendamentos
                </h3>
                <button
                  onClick={() => setShowMyBookingsModal(false)}
                  className="text-zinc-400 hover:text-zinc-100 text-xl font-bold p-1"
                >
                  &times;
                </button>
              </div>

              {/* Busca por Telefone (Mini Login) */}
              <form onSubmit={handleSearchByPhone} className="space-y-2 bg-zinc-950/60 p-3.5 border border-zinc-800/80 rounded-2xl">
                <label className="text-xs text-zinc-400 font-medium block">Trocou de celular? Busque seu WhatsApp:</label>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    placeholder="(62) 99999-9999"
                    value={searchPhoneInput}
                    onChange={(e) => setSearchPhoneInput(e.target.value)}
                    className="flex-1 bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs rounded-xl px-3 py-2.5 outline-none focus:border-amber-500"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2.5 bg-amber-500 text-zinc-950 font-bold text-xs rounded-xl hover:bg-amber-400 transition"
                  >
                    Buscar
                  </button>
                </div>
              </form>

              {/* Lista de Agendamentos Ativos do Cliente */}
              <div className="space-y-3 pt-1">
                {myBookings.length === 0 ? (
                  <div className="py-8 text-center text-zinc-500 text-sm space-y-1">
                    <p className="font-medium">Nenhum agendamento ativo cadastrado neste celular.</p>
                  </div>
                ) : (
                  myBookings.map((item) => {
                    const datePart = item.data_hora.includes('T') ? item.data_hora.split('T')[0] : '';
                    const timePart = item.data_hora.includes('T') ? item.data_hora.split('T')[1] : item.data_hora;
                    const dateFormatted = datePart.split('-').reverse().join('/');
                    const timeStr = timePart.substring(0, 5);

                    return (
                      <div
                        key={item.id}
                        className="bg-zinc-950 border border-zinc-800/90 rounded-2xl p-4 space-y-3 shadow-md"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-bold text-amber-400 text-base">{item.servicos?.nome}</h4>
                            <p className="text-xs text-zinc-400">Barbeiro: <strong>{item.barbeiros?.nome || 'Profissional'}</strong></p>
                          </div>
                          <span className="text-xs font-bold text-zinc-200 bg-zinc-800 px-3 py-1 rounded-full border border-zinc-700">
                            {timeStr}
                          </span>
                        </div>

                        <div className="flex justify-between items-center text-xs text-zinc-400 border-t border-zinc-900 pt-2">
                          <span>📅 {dateFormatted}</span>
                          <span className="font-bold text-amber-400 text-sm">R$ {Number(item.servicos?.preco || 0).toFixed(2).replace('.', ',')}</span>
                        </div>

                        <button
                          disabled={cancellingId === item.id}
                          onClick={() => promptClientCancelBooking(item)}
                          className="w-full py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-semibold rounded-xl text-xs transition flex items-center justify-center gap-1.5"
                        >
                          {cancellingId === item.id ? (
                            <>
                              <Loader2 size={14} className="animate-spin" /> Cancelando...
                            </>
                          ) : (
                            <>Cancelar Agendamento</>
                          )}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        <NotificationToast toast={toast} onClose={() => setToast(null)} />
        
        <CustomConfirmModal
          isOpen={confirmModal.isOpen}
          title={confirmModal.title}
          message={confirmModal.message}
          confirmText="Sim, Cancelar"
          cancelText="Voltar"
          onConfirm={executeClientCancelBooking}
          onCancel={() => setConfirmModal({ isOpen: false, title: '', message: '', item: null })}
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-between pb-12">
      {/* Header Fixo */}
      <header className="w-full bg-zinc-900/90 backdrop-blur-md border-b border-zinc-800/80 sticky top-0 z-50">
        <div className="max-w-md mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/30 text-amber-500 rounded-xl flex items-center justify-center">
              <Scissors size={22} />
            </div>
            <div>
              <h1 className="font-bold text-base tracking-wide text-zinc-100 flex items-center gap-1.5">
                BARBEARIA VIP
                <Sparkles size={14} className="text-amber-400 fill-amber-400" />
              </h1>
              <p className="text-xs text-zinc-400 flex items-center gap-1">
                <MapPin size={12} className="text-zinc-500" /> Agendamento Online
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowMyBookingsModal(true)}
            className="relative px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-400 font-semibold rounded-xl text-xs flex items-center gap-1.5 transition"
          >
            <CalendarIcon size={14} />
            <span>Meus Agendamentos</span>
            {myBookings.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping absolute -top-0.5 -right-0.5" />
            )}
          </button>
        </div>
      </header>

      {/* Container Principal */}
      <div className="w-full max-w-md px-4 pt-6 space-y-6">
        
        {/* Passos do Wizard */}
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-3.5 flex items-center justify-between">
          {[
            { num: 1, label: 'Serviço', icon: Scissors },
            { num: 2, label: 'Barbeiro', icon: User },
            { num: 3, label: 'Horário', icon: Clock },
            { num: 4, label: 'Confirmação', icon: CheckCircle2 },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = step === item.num;
            const isDone = step > item.num;
            return (
              <div
                key={item.num}
                onClick={() => isDone && setStep(item.num)}
                className={`flex flex-col items-center gap-1 text-xs cursor-pointer transition ${
                  isActive ? 'text-amber-400 font-bold' : isDone ? 'text-zinc-300' : 'text-zinc-600'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition ${
                    isActive
                      ? 'bg-amber-500 text-zinc-950 font-bold shadow-lg shadow-amber-500/25 ring-2 ring-amber-400/50'
                      : isDone
                      ? 'bg-zinc-800 text-amber-400 border border-zinc-700'
                      : 'bg-zinc-900 border border-zinc-800 text-zinc-600'
                  }`}
                >
                  {isDone ? <Check size={16} /> : <Icon size={16} />}
                </div>
                <span>{item.label}</span>
              </div>
            );
          })}
        </div>

        {/* Alerta de Erro */}
        {errorMessage && (
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center gap-2 animate-in fade-in">
            <AlertCircle size={18} className="flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {loadingData ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3 text-zinc-400">
            <Loader2 size={32} className="animate-spin text-amber-500" />
            <p className="text-sm">Carregando serviços da barbearia...</p>
          </div>
        ) : (
          <>
            {/* PASSO 1: Serviço */}
            {step === 1 && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <div>
                  <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                    <Scissors className="text-amber-500" size={20} />
                    Escolha o Serviço
                  </h2>
                  <p className="text-zinc-400 text-xs mt-1">Selecione o procedimento desejado</p>
                </div>

                <div className="space-y-3">
                  {servicos.map((servico) => {
                    const isSelected = selectedServico?.id === servico.id;
                    return (
                      <div
                        key={servico.id}
                        onClick={() => {
                          setSelectedServico(servico);
                          setSelectedTime(''); // Limpa horário ao mudar serviço
                        }}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-gradient-to-r from-amber-500/10 to-zinc-900 border-amber-500 ring-1 ring-amber-500 shadow-lg shadow-amber-500/10'
                            : 'bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700'
                        }`}
                      >
                        <div className="space-y-1">
                          <h3 className="font-semibold text-zinc-100 text-base">{servico.nome}</h3>
                          <p className="text-xs text-zinc-400 flex items-center gap-1">
                            <Clock size={13} className="text-zinc-500" /> {servico.duracao_minutos} minutos
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-lg font-bold text-amber-400">
                            R$ {Number(servico.preco).toFixed(2).replace('.', ',')}
                          </span>
                          <div className="mt-1">
                            <span
                              className={`inline-block w-5 h-5 rounded-full border flex items-center justify-center ${
                                isSelected ? 'bg-amber-500 border-amber-500 text-zinc-950' : 'border-zinc-700'
                              }`}
                            >
                              {isSelected && <Check size={12} strokeWidth={3} />}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button
                  disabled={!selectedServico}
                  onClick={() => setStep(2)}
                  className="w-full py-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-950 font-bold rounded-2xl flex items-center justify-center gap-2 transition shadow-xl shadow-amber-500/20 text-base"
                >
                  Continuar para Barbeiro <ChevronRight size={20} />
                </button>
              </div>
            )}

            {/* PASSO 2: Barbeiro */}
            {step === 2 && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <div>
                  <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                    <User className="text-amber-500" size={20} />
                    Escolha o Barbeiro
                  </h2>
                  <p className="text-zinc-400 text-xs mt-1">Selecione o profissional de sua preferência</p>
                </div>

                <div className="space-y-3">
                  <div
                    onClick={() => {
                      setSelectedBarbeiro('qualquer');
                      setSelectedTime('');
                    }}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center gap-4 ${
                      selectedBarbeiro === 'qualquer'
                        ? 'bg-amber-500/10 border-amber-500 ring-1 ring-amber-500 shadow-lg shadow-amber-500/10'
                        : 'bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 text-zinc-950 font-bold flex items-center justify-center shadow-md">
                      <Sparkles size={22} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-zinc-100 text-base">Qualquer Barbeiro</h3>
                      <p className="text-xs text-zinc-400">Primeiro profissional livre no horário</p>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                        selectedBarbeiro === 'qualquer' ? 'bg-amber-500 border-amber-500 text-zinc-950' : 'border-zinc-700'
                      }`}
                    >
                      {selectedBarbeiro === 'qualquer' && <Check size={12} strokeWidth={3} />}
                    </div>
                  </div>

                  {barbeiros.map((barbeiro) => {
                    const isSelected = typeof selectedBarbeiro === 'object' && selectedBarbeiro?.id === barbeiro.id;
                    return (
                      <div
                        key={barbeiro.id}
                        onClick={() => {
                          setSelectedBarbeiro(barbeiro);
                          setSelectedTime('');
                        }}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center gap-4 ${
                          isSelected
                            ? 'bg-amber-500/10 border-amber-500 ring-1 ring-amber-500 shadow-lg shadow-amber-500/10'
                            : 'bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700'
                        }`}
                      >
                        <img
                          src={barbeiro.foto_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                          alt={barbeiro.nome}
                          className="w-12 h-12 rounded-xl object-cover border border-zinc-700"
                        />
                        <div className="flex-1">
                          <h3 className="font-semibold text-zinc-100 text-base flex items-center gap-1.5">
                            {barbeiro.nome}
                            <Award size={14} className="text-amber-400" />
                          </h3>
                          <p className="text-xs text-emerald-400 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Ativo na Barbearia
                          </p>
                        </div>
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                            isSelected ? 'bg-amber-500 border-amber-500 text-zinc-950' : 'border-zinc-700'
                          }`}
                        >
                          {isSelected && <Check size={12} strokeWidth={3} />}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setStep(1)}
                    className="py-4 px-5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 font-semibold rounded-2xl transition"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button
                    disabled={!selectedBarbeiro}
                    onClick={() => setStep(3)}
                    className="flex-1 py-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-950 font-bold rounded-2xl flex items-center justify-center gap-2 transition shadow-xl shadow-amber-500/20 text-base"
                  >
                    Escolher Horário <ChevronRight size={20} />
                  </button>
                </div>
              </div>
            )}

            {/* PASSO 3: Data e Horário com Cálculo Inteligente de Duração */}
            {step === 3 && (
              <div className="space-y-5 animate-in fade-in duration-300">
                <div>
                  <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                    <CalendarIcon className="text-amber-500" size={20} />
                    Data e Horário
                  </h2>
                  <p className="text-zinc-400 text-xs mt-1">
                    Duração prevista: <strong className="text-amber-400">{selectedServico?.duracao_minutos} minutos</strong>
                  </p>
                </div>

                {/* Seleção de Data */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Data</label>
                  <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none">
                    {datesList.map((item) => {
                      const isSelected = selectedDate === item.iso;
                      return (
                        <button
                          key={item.iso}
                          onClick={() => {
                            setSelectedDate(item.iso);
                            setSelectedTime('');
                          }}
                          className={`flex-shrink-0 w-16 py-3 rounded-2xl border flex flex-col items-center gap-1 transition ${
                            isSelected
                              ? 'bg-amber-500 border-amber-500 text-zinc-950 font-bold shadow-lg shadow-amber-500/20'
                              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                          }`}
                        >
                          <span className="text-xs uppercase font-medium">{item.dayName}</span>
                          <span className="text-lg font-bold">{item.dayNum}</span>
                          <span className="text-[10px] uppercase opacity-80">{item.monthName}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Grid de Horários Calculados sem Sobreposição */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Horários Disponíveis</label>
                    <span className="text-[11px] text-zinc-500">
                      {selectedBarbeiro === 'qualquer' ? 'Verificando todos os barbeiros' : `Horários de ${selectedBarbeiro?.nome}`}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-2.5">
                    {timeSlots.map((time) => {
                      const disabled = isSlotDisabled(time);
                      const isSelected = selectedTime === time;
                      return (
                        <button
                          key={time}
                          disabled={disabled}
                          onClick={() => setSelectedTime(time)}
                          className={`py-3 rounded-xl border text-sm font-semibold transition ${
                            disabled
                              ? 'bg-zinc-950/80 border-zinc-900 text-zinc-700 line-through cursor-not-allowed'
                              : isSelected
                              ? 'bg-amber-500 border-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                              : 'bg-zinc-900 border-zinc-800 text-zinc-200 hover:border-amber-500/50'
                          }`}
                        >
                          {time}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setStep(2)}
                    className="py-4 px-5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 font-semibold rounded-2xl transition"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button
                    disabled={!selectedDate || !selectedTime}
                    onClick={() => setStep(4)}
                    className="flex-1 py-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-950 font-bold rounded-2xl flex items-center justify-center gap-2 transition shadow-xl shadow-amber-500/20 text-base"
                  >
                    Preencher Seus Dados <ChevronRight size={20} />
                  </button>
                </div>
              </div>
            )}

            {/* PASSO 4: Dados do Cliente e Confirmação */}
            {step === 4 && (
              <form onSubmit={handleConfirmAgendamento} className="space-y-5 animate-in fade-in duration-300">
                <div>
                  <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                    <CheckCircle2 className="text-amber-500" size={20} />
                    Finalizar Agendamento
                  </h2>
                  <p className="text-zinc-400 text-xs mt-1">Informe seu nome e WhatsApp para a confirmação</p>
                </div>

                <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-4 space-y-2.5">
                  <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2">Resumo da Reserva</h3>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">Serviço:</span>
                    <span className="font-semibold text-zinc-100">{selectedServico?.nome} ({selectedServico?.duracao_minutos} min)</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">Barbeiro:</span>
                    <span className="font-medium text-zinc-200">
                      {selectedBarbeiro === 'qualquer'
                        ? `Qualquer Barbeiro (${getAvailableBarberForSlot(selectedTime)?.nome || 'Livre'})`
                        : selectedBarbeiro?.nome}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">Data & Hora:</span>
                    <span className="font-medium text-zinc-200">{selectedDate.split('-').reverse().join('/')} às {selectedTime}</span>
                  </div>
                  <div className="flex justify-between text-sm border-t border-zinc-800 pt-2 font-bold">
                    <span className="text-zinc-300">Total a pagar:</span>
                    <span className="text-amber-400 text-base">R$ {Number(selectedServico?.preco).toFixed(2).replace('.', ',')}</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-300">Seu Nome Completo *</label>
                    <div className="relative">
                      <User size={18} className="absolute left-3.5 top-3.5 text-zinc-500" />
                      <input
                        type="text"
                        required
                        placeholder="Ex: João da Silva"
                        value={clienteNome}
                        onChange={(e) => setClienteNome(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl py-3 pl-10 pr-4 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-300">WhatsApp (com DDD) *</label>
                    <div className="relative">
                      <Phone size={18} className="absolute left-3.5 top-3.5 text-zinc-500" />
                      <input
                        type="tel"
                        required
                        placeholder="(62) 99999-9999"
                        value={clienteTelefone}
                        onChange={(e) => setClienteTelefone(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl py-3 pl-10 pr-4 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="py-4 px-5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 font-semibold rounded-2xl transition"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !clienteNome || !clienteTelefone}
                    className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition shadow-xl shadow-emerald-600/20 text-base"
                  >
                    {submitting ? (
                      <>
                        <Loader2 size={20} className="animate-spin" /> Salvando...
                      </>
                    ) : (
                      <>
                        <MessageCircle size={20} /> Confirmar & Enviar WhatsApp
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>

      <footer className="w-full text-center py-4 text-xs text-zinc-600 mt-8 border-t border-zinc-900">
        Barbearia VIP &copy; {new Date().getFullYear()} &bull; Todos os direitos reservados
      </footer>

      {/* Modal de Meus Agendamentos & Busca por Telefone */}
      {showMyBookingsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-5 relative max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="font-bold text-lg text-zinc-100 flex items-center gap-2">
                <CalendarIcon className="text-amber-500" size={20} />
                Meus Agendamentos
              </h3>
              <button
                onClick={() => setShowMyBookingsModal(false)}
                className="text-zinc-400 hover:text-zinc-100 text-xl font-bold p-1"
              >
                &times;
              </button>
            </div>

            {/* Busca por Telefone (Mini Login) */}
            <form onSubmit={handleSearchByPhone} className="space-y-2 bg-zinc-950/60 p-3.5 border border-zinc-800/80 rounded-2xl">
              <label className="text-xs text-zinc-400 font-medium block">Trocou de celular? Busque seu WhatsApp:</label>
              <div className="flex gap-2">
                <input
                  type="tel"
                  placeholder="(62) 99999-9999"
                  value={searchPhoneInput}
                  onChange={(e) => setSearchPhoneInput(e.target.value)}
                  className="flex-1 bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs rounded-xl px-3 py-2.5 outline-none focus:border-amber-500"
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-amber-500 text-zinc-950 font-bold text-xs rounded-xl hover:bg-amber-400 transition"
                >
                  Buscar
                </button>
              </div>
            </form>

            {/* Lista de Agendamentos Ativos do Cliente */}
            <div className="space-y-3 pt-1">
              {myBookings.length === 0 ? (
                <div className="py-8 text-center text-zinc-500 text-sm space-y-1">
                  <p className="font-medium">Nenhum agendamento ativo cadastrado neste celular.</p>
                  <p className="text-xs text-zinc-600">Ao agendar, sua reserva ficará salva aqui automaticamente!</p>
                </div>
              ) : (
                myBookings.map((item) => {
                  const datePart = item.data_hora.includes('T') ? item.data_hora.split('T')[0] : '';
                  const timePart = item.data_hora.includes('T') ? item.data_hora.split('T')[1] : item.data_hora;
                  const dateFormatted = datePart.split('-').reverse().join('/');
                  const timeStr = timePart.substring(0, 5);

                  return (
                    <div
                      key={item.id}
                      className="bg-zinc-950 border border-zinc-800/90 rounded-2xl p-4 space-y-3 shadow-md"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-amber-400 text-base">{item.servicos?.nome}</h4>
                          <p className="text-xs text-zinc-400">Barbeiro: <strong>{item.barbeiros?.nome || 'Profissional'}</strong></p>
                        </div>
                        <span className="text-xs font-bold text-zinc-200 bg-zinc-800 px-3 py-1 rounded-full border border-zinc-700">
                          {timeStr}
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-xs text-zinc-400 border-t border-zinc-900 pt-2">
                        <span>📅 {dateFormatted}</span>
                        <span className="font-bold text-amber-400 text-sm">R$ {Number(item.servicos?.preco || 0).toFixed(2).replace('.', ',')}</span>
                      </div>

                      <button
                        disabled={cancellingId === item.id}
                        onClick={() => promptClientCancelBooking(item)}
                        className="w-full py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-semibold rounded-xl text-xs transition flex items-center justify-center gap-1.5"
                      >
                        {cancellingId === item.id ? (
                          <>
                            <Loader2 size={14} className="animate-spin" /> Cancelando...
                          </>
                        ) : (
                          <>Cancelar Agendamento</>
                        )}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Componentes de Notificação Customizados */}
      <NotificationToast toast={toast} onClose={() => setToast(null)} />
      
      <CustomConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText="Sim, Cancelar"
        cancelText="Voltar"
        onConfirm={executeClientCancelBooking}
        onCancel={() => setConfirmModal({ isOpen: false, title: '', message: '', item: null })}
      />
    </main>
  );
}
