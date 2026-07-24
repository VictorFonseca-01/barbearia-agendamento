export type StatusAgendamento = 'pendente' | 'confirmado' | 'cancelado' | 'concluido';

export interface Barbeiro {
  id: string;
  nome: string;
  foto_url: string | null;
  ativo: boolean;
  created_at: string;
}

export interface Servico {
  id: string;
  nome: string;
  preco: number;
  duracao_minutos: number;
  created_at: string;
}

export interface Agendamento {
  id: string;
  barbeiro_id: string;
  servico_id: string;
  cliente_nome: string;
  cliente_telefone: string;
  data_hora: string;
  status: StatusAgendamento;
  created_at: string;
  // Relacionamentos opcionais
  barbeiro?: Barbeiro;
  servico?: Servico;
}
