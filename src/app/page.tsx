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

const DEFAULT_WHATSAPP_BARBEARIA = process.env.NEXT_PUBLIC_WHATSAPP_BARBEARIA || '5562999999999';

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

// 1. FEEDBACK TÁTIL (Haptics)
const triggerHaptic = () => {
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(12);
    } catch (e) {}
  }
};

// Auxiliar: Formatação automática de WhatsApp (XX) XXXXX-XXXX
const formatPhone = (val: string) => {
  const digits = val.replace(/\D/g, '').slice(0, 11);
  if (!digits) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

// Auxiliar: Retorna data de hoje em YYYY-MM-DD (fuso local sem deslocamento de UTC)
const getTodayISO = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function Home() {
  const [step, setStep] = useState<number>(1);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [barbeiros, setBarbeiros] = useState<Barbeiro[]>([]);
  const [loadingData, setLoadingData] = useState<boolean>(true);
  const [whatsappBarbearia, setWhatsappBarbearia] = useState<string>(DEFAULT_WHATSAPP_BARBEARIA);

  useEffect(() => {
    async function loadBarbeariaConfig() {
      try {
        const { data } = await supabase
          .from('barbearia_config')
          .select('valor')
          .eq('chave', 'whatsapp_barbearia')
          .single();
        if (data && data.valor) {
          setWhatsappBarbearia(data.valor);
        }
      } catch (err) {
        console.error('Erro ao carregar WhatsApp da barbearia:', err);
      }
    }
    loadBarbeariaConfig();
  }, []);

  // Seleções do formulário
  const [selectedServico, setSelectedServico] = useState<Servico | null>(null);
  const [selectedBarbeiro, setSelectedBarbeiro] = useState<Barbeiro | 'qualquer' | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [clienteNome, setClienteNome] = useState<string>('');
  const [clienteTelefone, setClienteTelefone] = useState<string>('');

  // Memória do Cliente (localStorage)
  useEffect(() => {
    try {
      const savedName = localStorage.getItem('barbearia_cliente_nome');
      const savedPhone = localStorage.getItem('barbearia_cliente_telefone');
      if (savedName) setClienteNome(savedName);
      if (savedPhone) setClienteTelefone(formatPhone(savedPhone));
    } catch (e) {
      console.error('Erro ao carregar memória do cliente:', e);
    }
  }, []);

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

  // Busca agendamentos digitando número de WhatsApp
  const handleSearchByPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic();
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

  // Regra de cancelamento (30 minutos de antecedência) com parsing seguro para Safari
  const promptClientCancelBooking = (item: MyBookingItem) => {
    triggerHaptic();
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

  // Executa o cancelamento pelo cliente
  const executeClientCancelBooking = async () => {
    const item = confirmModal.item;
    if (!item) return;

    setConfirmModal({ isOpen: false, title: '', message: '', item: null });
    setCancellingId(item.id);
    triggerHaptic();

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
        window.open(`https://wa.me/${whatsappBarbearia}?text=${msg}`, '_blank');
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

    // Data padrão: Hoje no formato YYYY-MM-DD local (sem fuso Safari bug)
    setSelectedDate(getTodayISO());
  }, []);

  // 2. Busca agendamentos do dia
  const fetchDayAppointments = useCallback(async () => {
    if (!selectedDate) return;
    try {
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

  useEffect(() => {
    fetchDayAppointments();
  }, [fetchDayAppointments, step, selectedBarbeiro]);

  // Safari (iOS) Date Safe generator: cria os 7 dias usando construtor com inteiros
  const datesList = useMemo(() => {
    const dates = [];
    const now = new Date();
    const currYear = now.getFullYear();
    const currMonth = now.getMonth();
    const currDay = now.getDate();

    for (let i = 0; i < 7; i++) {
      const d = new Date(currYear, currMonth, currDay + i);
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

  // Converte "HH:MM" para minutos
  const timeToMinutes = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };

  // Verifica se um barbeiro específico está ocupado
  const isBarberBusy = (barberId: string, slotStart: number, slotEnd: number) => {
    return existingAppointments.some((app) => {
      if (app.barbeiro_id !== barberId) return false;
      return Math.max(slotStart, app.startMinutes) < Math.min(slotEnd, app.endMinutes);
    });
  };

  // Determina se um horário está bloqueado (Horários passados hoje + Ocupação)
  const isSlotDisabled = (timeStr: string) => {
    const slotStart = timeToMinutes(timeStr);

    if (selectedDate === getTodayISO()) {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      if (slotStart <= currentMinutes) {
        return true;
      }
    }

    if (!selectedServico) return false;

    const serviceDuration = selectedServico.duracao_minutos || 30;
    const slotEnd = slotStart + serviceDuration;

    if (slotEnd > 1140) return true;

    if (selectedBarbeiro && selectedBarbeiro !== 'qualquer') {
      return isBarberBusy(selectedBarbeiro.id, slotStart, slotEnd);
    }

    if (barbeiros.length === 0) return true;
    return barbeiros.every((barber) => isBarberBusy(barber.id, slotStart, slotEnd));
  };

  // Retorna barbeiro disponível para o horário
  const getAvailableBarberForSlot = (timeStr: string): Barbeiro | null => {
    if (selectedBarbeiro && selectedBarbeiro !== 'qualquer') {
      return selectedBarbeiro;
    }

    const slotStart = timeToMinutes(timeStr);
    const serviceDuration = selectedServico?.duracao_minutos || 30;
    const slotEnd = slotStart + serviceDuration;

    return barbeiros.find((barber) => !isBarberBusy(barber.id, slotStart, slotEnd)) || null;
  };

  // Submissão do agendamento
  const handleConfirmAgendamento = async (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic();
    setErrorMessage('');

    if (!selectedServico || !selectedBarbeiro || !selectedDate || !selectedTime || !clienteNome || !clienteTelefone) {
      setErrorMessage('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    const assignedBarber = getAvailableBarberForSlot(selectedTime);
    if (!assignedBarber) {
      setErrorMessage('Desculpe, o barbeiro selecionado não está mais disponível neste horário. Escolha outro horário.');
      return;
    }

    setSubmitting(true);

    try {
      const slotStart = timeToMinutes(selectedTime);
      const serviceDuration = selectedServico.duracao_minutos || 30;
      const slotEnd = slotStart + serviceDuration;

      if (isBarberBusy(assignedBarber.id, slotStart, slotEnd)) {
        throw new Error('Este horário já foi preenchido por outro cliente. Por favor, escolha outro horário.');
      }

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

      try {
        localStorage.setItem('barbearia_cliente_nome', clienteNome.trim());
        localStorage.setItem('barbearia_cliente_telefone', clienteTelefone.trim());

        if (insertedData && insertedData.length > 0) {
          const storedIds = JSON.parse(localStorage.getItem('barbearia_meus_ids') || '[]');
          storedIds.push(insertedData[0].id);
          localStorage.setItem('barbearia_meus_ids', JSON.stringify(storedIds));
        }
      } catch (e) {
        console.error('Erro ao salvar no localStorage:', e);
      }

      await fetchDayAppointments();
      await loadMyBookings();

      setCompleted(true);

      const [year, month, day] = selectedDate.split('-');
      const dataFormatada = `${day}/${month}/${year}`;

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

      const urlWhatsApp = `https://wa.me/${whatsappBarbearia}?text=${mensagemWhatsApp}`;

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

    const [compYear, compMonth, compDay] = selectedDate.split('-');

    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-between pb-12">
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
              onClick={() => { triggerHaptic(); setShowMyBookingsModal(true); }}
              className="relative px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-400 font-semibold rounded-xl text-xs flex items-center gap-1.5 transition active:scale-95"
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
                <span className="font-medium text-zinc-200">{compDay}/{compMonth}/{compYear} às {selectedTime}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-zinc-400">Valor</span>
                <span className="font-bold text-amber-400">R$ {Number(selectedServico?.preco).toFixed(2).replace('.', ',')}</span>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <a
                href={`https://wa.me/${whatsappBarbearia}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => triggerHaptic()}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-600/20 active:scale-[0.98]"
              >
                <MessageCircle size={20} />
                Abrir WhatsApp da Barbearia
              </a>

              <button
                onClick={() => { triggerHaptic(); setShowMyBookingsModal(true); }}
                className="w-full py-3.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold rounded-xl flex items-center justify-center gap-2 transition text-sm active:scale-[0.98]"
              >
                <CalendarIcon size={18} />
                Ver Meus Agendamentos
              </button>

              <button
                onClick={() => {
                  triggerHaptic();
                  setCompleted(false);
                  setStep(1);
                  setSelectedServico(null);
                  setSelectedBarbeiro(null);
                  setSelectedTime('');
                  setErrorMessage('');
                }}
                className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl transition text-sm active:scale-[0.98]"
              >
                Fazer Novo Agendamento
              </button>
            </div>
          </div>
        </div>

        {/* Modal de Meus Agendamentos */}
        {showMyBookingsModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-5 relative max-h-[90vh] overflow-y-auto shadow-2xl text-left">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <h3 className="font-bold text-lg text-zinc-100 flex items-center gap-2">
                  <CalendarIcon className="text-amber-500" size={20} />
                  Meus Agendamentos
                </h3>
                <button
                  onClick={() => { triggerHaptic(); setShowMyBookingsModal(false); }}
                  className="text-zinc-400 hover:text-zinc-100 text-xl font-bold p-1"
                >
                  &times;
                </button>
              </div>

              <form onSubmit={handleSearchByPhone} className="space-y-2 bg-zinc-950/60 p-3.5 border border-zinc-800/80 rounded-2xl">
                <label className="text-xs text-zinc-400 font-medium block">Trocou de celular? Busque seu WhatsApp:</label>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    placeholder="(62) 99999-9999"
                    value={searchPhoneInput}
                    onChange={(e) => setSearchPhoneInput(formatPhone(e.target.value))}
                    className="flex-1 bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs rounded-xl px-3 py-2.5 outline-none focus:border-amber-500"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2.5 bg-amber-500 text-zinc-950 font-bold text-xs rounded-xl hover:bg-amber-400 transition active:scale-95"
                  >
                    Buscar
                  </button>
                </div>
              </form>

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
                          className="w-full py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-semibold rounded-xl text-xs transition flex items-center justify-center gap-1.5 active:scale-95"
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
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-between pb-16">
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
            onClick={() => { triggerHaptic(); setShowMyBookingsModal(true); }}
            className="relative px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-400 font-semibold rounded-xl text-xs flex items-center gap-1.5 transition active:scale-95"
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
                onClick={() => {
                  if (isDone) {
                    triggerHaptic();
                    setStep(item.num);
                  }
                }}
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

        {/* 4. SKELETON LOADERS ELEGANTES */}
        {loadingData ? (
          <div className="space-y-3 py-4 animate-in fade-in duration-300">
            <div className="p-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 animate-pulse h-20 flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-4 w-32 bg-zinc-800 rounded-md" />
                <div className="h-3 w-20 bg-zinc-800/60 rounded-md" />
              </div>
              <div className="h-6 w-16 bg-zinc-800 rounded-md" />
            </div>
            <div className="p-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 animate-pulse h-20 flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-4 w-36 bg-zinc-800 rounded-md" />
                <div className="h-3 w-24 bg-zinc-800/60 rounded-md" />
              </div>
              <div className="h-6 w-16 bg-zinc-800 rounded-md" />
            </div>
            <div className="p-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 animate-pulse h-20 flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-4 w-40 bg-zinc-800 rounded-md" />
                <div className="h-3 w-28 bg-zinc-800/60 rounded-md" />
              </div>
              <div className="h-6 w-16 bg-zinc-800 rounded-md" />
            </div>
          </div>
        ) : (
          <>
            {/* PASSO 1: Serviço */}
            {step === 1 && (
              <div className="space-y-4 animate-in fade-in duration-300 pb-16">
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
                          triggerHaptic();
                          setSelectedServico(servico);
                          setSelectedTime('');
                        }}
                        className={`p-4 rounded-2xl border transition-all duration-200 active:scale-[0.98] cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-gradient-to-r from-amber-500/10 to-zinc-900 border-amber-500 ring-1 ring-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.15)]'
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

                {/* 2. STICKY CTA FOOTER MOBILE */}
                <div className="sticky bottom-0 bg-zinc-950/80 backdrop-blur-md p-4 border-t border-zinc-800/80 z-40 -mx-4 -mb-16 mt-6">
                  <button
                    disabled={!selectedServico}
                    onClick={() => { triggerHaptic(); setStep(2); }}
                    className="w-full py-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-950 font-bold rounded-2xl flex items-center justify-center gap-2 transition shadow-xl shadow-amber-500/20 text-base active:scale-[0.98]"
                  >
                    Continuar para Barbeiro <ChevronRight size={20} />
                  </button>
                </div>
              </div>
            )}

            {/* PASSO 2: Barbeiro */}
            {step === 2 && (
              <div className="space-y-4 animate-in fade-in duration-300 pb-16">
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
                      triggerHaptic();
                      setSelectedBarbeiro('qualquer');
                      setSelectedTime('');
                    }}
                    className={`p-4 rounded-2xl border transition-all duration-200 active:scale-[0.98] cursor-pointer flex items-center gap-4 ${
                      selectedBarbeiro === 'qualquer'
                        ? 'bg-amber-500/10 border-amber-500 ring-1 ring-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.15)]'
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
                          triggerHaptic();
                          setSelectedBarbeiro(barbeiro);
                          setSelectedTime('');
                        }}
                        className={`p-4 rounded-2xl border transition-all duration-200 active:scale-[0.98] cursor-pointer flex items-center gap-4 ${
                          isSelected
                            ? 'bg-amber-500/10 border-amber-500 ring-1 ring-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.15)]'
                            : 'bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700'
                        }`}
                      >
                        {/* 5. BARBEIRO ONLINE BADGE */}
                        <div className="relative">
                          <img
                            src={barbeiro.foto_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                            alt={barbeiro.nome}
                            className="w-12 h-12 rounded-xl object-cover border border-zinc-700"
                          />
                          <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border border-zinc-950"></span>
                          </span>
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-zinc-100 text-base flex items-center gap-1.5">
                            {barbeiro.nome}
                            <Award size={14} className="text-amber-400" />
                          </h3>
                          <p className="text-xs text-emerald-400 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Disponível Hoje
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

                {/* 2. STICKY CTA FOOTER MOBILE */}
                <div className="sticky bottom-0 bg-zinc-950/80 backdrop-blur-md p-4 border-t border-zinc-800/80 z-40 -mx-4 -mb-16 mt-6 flex gap-3">
                  <button
                    onClick={() => { triggerHaptic(); setStep(1); }}
                    className="py-4 px-5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 font-semibold rounded-2xl transition active:scale-[0.98]"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button
                    disabled={!selectedBarbeiro}
                    onClick={() => { triggerHaptic(); setStep(3); }}
                    className="flex-1 py-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-950 font-bold rounded-2xl flex items-center justify-center gap-2 transition shadow-xl shadow-amber-500/20 text-base active:scale-[0.98]"
                  >
                    Escolher Horário <ChevronRight size={20} />
                  </button>
                </div>
              </div>
            )}

            {/* PASSO 3: Data e Horário */}
            {step === 3 && (
              <div className="space-y-5 animate-in fade-in duration-300 pb-16">
                <div>
                  <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                    <CalendarIcon className="text-amber-500" size={20} />
                    Data e Horário
                  </h2>
                  <p className="text-zinc-400 text-xs mt-1">
                    Duração prevista: <strong className="text-amber-400">{selectedServico?.duracao_minutos} minutos</strong>
                  </p>
                </div>

                {/* Seleção de Data (Safari-Safe) */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Data</label>
                  <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none">
                    {datesList.map((item) => {
                      const isSelected = selectedDate === item.iso;
                      return (
                        <button
                          key={item.iso}
                          onClick={() => {
                            triggerHaptic();
                            setSelectedDate(item.iso);
                            setSelectedTime('');
                          }}
                          className={`flex-shrink-0 w-16 py-3 rounded-2xl border flex flex-col items-center gap-1 transition-all duration-200 active:scale-[0.98] ${
                            isSelected
                              ? 'bg-amber-500 border-amber-500 text-zinc-950 font-bold shadow-[0_0_20px_rgba(245,158,11,0.2)]'
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

                {/* Grid de Horários Calculados com Bloqueio de Horários Passados */}
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
                          onClick={() => {
                            triggerHaptic();
                            setSelectedTime(time);
                          }}
                          className={`py-3 rounded-xl border text-sm font-semibold transition-all duration-200 active:scale-[0.98] ${
                            disabled
                              ? 'bg-zinc-950/80 border-zinc-900 text-zinc-700 line-through cursor-not-allowed'
                              : isSelected
                              ? 'bg-amber-500 border-amber-500 text-zinc-950 shadow-[0_0_15px_rgba(245,158,11,0.25)]'
                              : 'bg-zinc-900 border-zinc-800 text-zinc-200 hover:border-amber-500/50'
                          }`}
                        >
                          {time}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. STICKY CTA FOOTER MOBILE */}
                <div className="sticky bottom-0 bg-zinc-950/80 backdrop-blur-md p-4 border-t border-zinc-800/80 z-40 -mx-4 -mb-16 mt-6 flex gap-3">
                  <button
                    onClick={() => { triggerHaptic(); setStep(2); }}
                    className="py-4 px-5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 font-semibold rounded-2xl transition active:scale-[0.98]"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button
                    disabled={!selectedDate || !selectedTime}
                    onClick={() => { triggerHaptic(); setStep(4); }}
                    className="flex-1 py-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-950 font-bold rounded-2xl flex items-center justify-center gap-2 transition shadow-xl shadow-amber-500/20 text-base active:scale-[0.98]"
                  >
                    Preencher Seus Dados <ChevronRight size={20} />
                  </button>
                </div>
              </div>
            )}

            {/* PASSO 4: Dados do Cliente com Máscara e Memória */}
            {step === 4 && (
              <form onSubmit={handleConfirmAgendamento} className="space-y-5 animate-in fade-in duration-300">
                <div>
                  <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                    <CheckCircle2 className="text-amber-500" size={20} />
                    Finalizar Agendamento
                  </h2>
                  <p className="text-zinc-400 text-xs mt-1">Informe seu nome e WhatsApp para a confirmação</p>
                </div>

                <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-4 space-y-2.5 shadow-lg shadow-black/30">
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
                    <span className="font-medium text-zinc-200">
                      {selectedDate.split('-').reverse().join('/')} às {selectedTime}
                    </span>
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
                        onChange={(e) => setClienteTelefone(formatPhone(e.target.value))}
                        className="w-full bg-zinc-900 border border-zinc-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl py-3 pl-10 pr-4 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => { triggerHaptic(); setStep(3); }}
                    className="py-4 px-5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 font-semibold rounded-2xl transition active:scale-[0.98]"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !clienteNome || !clienteTelefone}
                    className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition shadow-xl shadow-emerald-600/20 text-base active:scale-[0.98]"
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
                onClick={() => { triggerHaptic(); setShowMyBookingsModal(false); }}
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
                  onChange={(e) => setSearchPhoneInput(formatPhone(e.target.value))}
                  className="flex-1 bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs rounded-xl px-3 py-2.5 outline-none focus:border-amber-500"
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-amber-500 text-zinc-950 font-bold text-xs rounded-xl hover:bg-amber-400 transition active:scale-95"
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
                        className="w-full py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-semibold rounded-xl text-xs transition flex items-center justify-center gap-1.5 active:scale-95"
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
