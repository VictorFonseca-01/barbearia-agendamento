# 💈 Documentação Completa do Sistema Barbearia Agendamento

Uma solução completa, moderna e responsiva para agendamento online de barbearias, desenvolvida com **Next.js 14 (App Router)**, **TypeScript**, **Tailwind CSS** e **Supabase (PostgreSQL, Realtime e RLS)**.

---

## 📋 Sumário
1. [Visão Geral do Sistema](#-visão-geral-do-sistema)
2. [Estrutura de Arquivos e Pastas](#-estrutura-de-arquivos-e-pastas)
3. [Arquitetura & Banco de Dados (Supabase)](#-arquitetura--banco-de-dados-supabase)
4. [Como Funciona o Sistema](#-como-funciona-o-sistema)
   - [Fluxo do Cliente (Agendamento Público)](#1-fluxo-do-cliente-agendamento-público)
   - [Fluxo do Administrador (Dashboard Admin)](#2-fluxo-do-administrador-dashboard-admin)
5. [Visual, UI & Experiência do Usuário (UI/UX)](#-visual-ui--experiência-do-usuário-uiux)
6. [Segurança e Regras de Negócio](#-segurança-e-regras-de-negócio)
7. [Guia de Instalação e Execução](#-guia-de-instalação-e-execução)

---

## 🎯 Visão Geral do Sistema

O **Barbearia Agendamento** é um sistema completo desenvolvido para eliminar filas de espera e otimizar a gestão de tempo em barbearias modernas. O sistema opera em duas frentes integradas em tempo real:

1. **Interface do Cliente**: Permite ao cliente escolher serviços, barbeiro de preferência, data e horário disponível, fornecendo confirmação imediata e opção de envio de comprovante via WhatsApp.
2. **Painel de Controle Admin**: Permite ao barbeiro/administrador monitorar os agendamentos do dia, alterar status, visualizar relatórios de faturamento diário, cadastrar novos barbeiros/serviços e receber notificações sonoras e em tempo real quando um novo agendamento é efetuado.

---

## 📁 Estrutura de Arquivos e Pastas

```
barbearia-agendamento/
├── src/
│   ├── app/
│   │   ├── admin/
│   │   │   └── page.tsx           # Painel de Administração (Dashboard, Filtros, Gestão de Serviços/Barbeiros)
│   │   ├── globals.css            # Estilos globais e diretivas do Tailwind CSS
│   │   ├── layout.tsx             # Layout raiz com fontes e metadados da aplicação
│   │   └── page.tsx               # Página principal do Cliente (Formulário de Agendamento em 5 Etapas)
│   ├── components/
│   │   └── NotificationToast.tsx  # Sistema customizado de Toasts e Modais de Confirmação
│   ├── lib/
│   │   └── supabase.ts            # Inicialização e cliente Supabase (JS Client)
│   └── types/
│       └── database.ts            # Tipagens TypeScript para as entidades do banco
├── supabase/
│   └── migrations/
│       ├── 20260724000000_initial_schema.sql         # Criação das tabelas (barbeiros, servicos, agendamentos)
│       ├── 20260724000001_seed_initial_data.sql      # Inserção de dados iniciais para testes
│       ├── 20260724000002_fix_rls_security_policies.sql # Ajuste de políticas de segurança RLS
│       ├── 20260724000003_admin_rls_policies.sql     # Permissões de escrita administrativas
│       ├── 20260724000004_enable_realtime.sql        # Habilitação de publicações Realtime no Supabase
│       └── 20260724000005_barbearia_config.sql       # Tabela de configurações gerais (WhatsApp da barbearia)
├── public/                         # Assets estáticos e imagens
├── .env.local                      # Variáveis de ambiente (Chaves Supabase e PIN Admin)
├── package.json                    # Dependências e scripts do projeto
├── tailwind.config.js              # Configuração do Tailwind CSS (Cores, Fontes, Temas)
└── DOCUMENTACAO.md                 # Este arquivo de documentação técnica e operacional
```

---

## 🗄️ Arquitetura & Banco de Dados (Supabase)

O banco de dados utiliza o **PostgreSQL** hospedado no Supabase com suporte a **Row Level Security (RLS)** e **Realtime Subscriptions**.

### Diagrama Entidade-Relacionamento (ERD)

```
 [barbeiros] 1 ──── < agendamentos > ──── 1 [servicos]
   (id)                 (id)                (id)
   (nome)               (barbeiro_id)       (nome)
   (foto_url)           (servico_id)        (preco)
   (ativo)              (cliente_nome)      (duracao_minutos)
                        (cliente_telefone)
                        (data_hora)
                        (status)

 [barbearia_config]
   (chave) UNIQUE
   (valor)
```

### Tabelas do Banco:

1. **`barbeiros`**: Armazena a lista de profissionais da barbearia.
   - `id` (UUID, Primary Key)
   - `nome` (Text, Not Null)
   - `foto_url` (Text, Opcional)
   - `ativo` (Boolean, Default True)
   - `created_at` (Timestamp)

2. **`servicos`**: Catálogo de cortes e tratamentos oferecidos.
   - `id` (UUID, Primary Key)
   - `nome` (Text, Not Null)
   - `preco` (Numeric 10,2, Not Null)
   - `duracao_minutos` (Integer, Not Null)
   - `created_at` (Timestamp)

3. **`agendamentos`**: Tabela central de marcação de horários.
   - `id` (UUID, Primary Key)
   - `barbeiro_id` (UUID, Foreign Key ➔ `barbeiros.id`)
   - `servico_id` (UUID, Foreign Key ➔ `servicos.id`)
   - `cliente_nome` (Text, Not Null)
   - `cliente_telefone` (Text, Not Null)
   - `data_hora` (Timestamp with time zone)
   - `status` (Text: `'pendente'`, `'confirmado'`, `'cancelado'`, `'concluido'`)
   - `created_at` (Timestamp)

4. **`barbearia_config`**: Armazena parâmetros globais do sistema.
   - `chave` (Text UNIQUE, ex: `'whatsapp_barbearia'`)
   - `valor` (Text)

---

## ⚙️ Como Funciona o Sistema

### 1. Fluxo do Cliente (Agendamento Público)
O cliente acessa a página principal ([`src/app/page.tsx`](file:///c:/Users/vfonseca/.gemini/antigravity-ide/scratch/barbearia-agendamento/src/app/page.tsx)) e passa por um assistente intuitivo em **5 etapas**:

1. **Etapa 1 - Escolha do Serviço**:
   - Exibe os serviços ativos (ex: Corte de Cabelo, Barba Completa, Combo Cabelo + Barba, Pezinho/Sobrancelha).
   - Exibe valores em R$, duração estimada em minutos e ícones ilustrativos.
2. **Etapa 2 - Escolha do Barbeiro**:
   - O cliente pode escolher um barbeiro específico ou selecionar a opção *"Qualquer Barbeiro Disponível"*.
3. **Etapa 3 - Escolha da Data e Horário**:
   - Calendário com atalhos rápidos ("Hoje", "Amanhã") e navegação por dias.
   - **Verificação de Conflitos**: O sistema calcula os horários já agendados para o barbeiro e desabilita automaticamente os slots ocupados, respeitando a duração de cada serviço.
4. **Etapa 4 - Dados do Cliente**:
   - Preenchimento do Nome e Telefone WhatsApp com formatação automática em tempo real `(XX) XXXXX-XXXX` e feedback tátil (vibrante em dispositivos móveis suportados).
5. **Etapa 5 - Confirmação e Sucesso**:
   - Resumo detalhado do agendamento com valor, data, horário e profissional.
   - Gravação instantânea no Supabase.
   - Botão para enviar mensagem direta com os detalhes do agendamento para o WhatsApp da barbearia.

---

### 2. Fluxo do Administrador (Dashboard Admin)
O barbeiro ou administrador acessa a rota [`src/app/admin`](file:///c:/Users/vfonseca/.gemini/antigravity-ide/scratch/barbearia-agendamento/src/app/admin/page.tsx):

1. **Autenticação por PIN**:
   - Tela de bloqueio com PIN numérico de segurança (configurado no arquivo `.env.local` via `NEXT_PUBLIC_ADMIN_PIN`).
2. **Atualização em Tempo Real (Realtime & Audio Alert)**:
   - Conexão ativa via WebSockets (`supabase.channel`). Quando um novo cliente faz um agendamento, o sistema emite um **alerta sonoro sintetizado em dois tons** (usando a Web Audio API nativa) e exibe uma notificação Toast na tela.
3. **Métricas Diárias de Desempenho**:
   - Cards com faturamento total previsto/realizado, total de cortes, quantidade de agendamentos pendentes, confirmados e concluídos.
4. **Filtros e Gestão da Agenda**:
   - Alternância entre dias via calendário interno.
   - Filtro por barbeiro ou visualização geral.
   - Atualização rápida do status do agendamento (Pendente ➔ Confirmado ➔ Concluído / Cancelado).
   - Botão de contato rápido no WhatsApp com o cliente em 1 clique.
5. **Gestão de Cadastros e Configurações**:
   - Modal para cadastrar novos barbeiros (nome, foto URL).
   - Modal para cadastrar novos serviços (nome, preço, duração).
   - Modal de configurações para atualizar o WhatsApp oficial de atendimento da barbearia.

---

## 🎨 Visual, UI & Experiência do Usuário (UI/UX)

O sistema foi desenhado com estética **Premium / Luxury Dark Mode**:

- **Paleta de Cores**:
  - **Fundo**: Slate Escuro Obsidian (`#0F172A` / `#020617`).
  - **Cards & Elementos**: Slate de alta densidade (`#1E293B`) com bordas suaves em tom de cinza neutro (`#334155`).
  - **Cores de Destaque**: Âmbar / Dourado (`#F59E0B` / `#D97706`), transmitindo um visual sofisticado de barbearia tradicional de alto padrão.
  - **Indicadores de Status**: Verde Esmeralda (Concluído), Azul Céu (Confirmado), Amarelo/Âmbar (Pendente), Vermelho Rosado (Cancelado).

- **Efeitos e Micro-Interações**:
  - **Glassmorphism**: Efeito de vidro fosco (`backdrop-blur-md`) em cabeçalhos e modais.
  - **Animações Fluidas**: Transições de hover, iluminação de bordas ativas e animação do indicador de progresso no Stepper de agendamento.
  - **Feedback Tátil**: Vibração no toque ao selecionar opções no smartphone.
  - **Alertas Sonoros**: Sintetizador de áudio de baixa latência para novos agendamentos no painel admin.
  - **Design Mobile-First**: Adaptação perfeita a qualquer tamanho de tela, de smartwatches e smartphones a monitores 4K.

---

## 🔒 Segurança e Regras de Negócio

1. **Row Level Security (RLS)**:
   - Apenas barbeiros e serviços ativos são listados publicamente.
   - Clientes podem inserir novos agendamentos, mas não podem alterar dados de terceiros.
   - Políticas exclusivas liberam a leitura e modificação de status.
2. **Prevenção de Horários Duplicados**:
   - O algoritmo de agendamento valida no frontend e backend o intervalo em minutos `[data_hora, data_hora + duracao_minutos]`, impedindo que dois clientes agendem o mesmo barbeiro no mesmo horário.
3. **Formatação de Dados e Telefone**:
   - Higienização e sanitização dos dados informados pelo cliente.

---

## 🚀 Guia de Instalação e Execução

### 1. Pré-requisitos
- **Node.js**: v18.0.0 ou superior
- **npm** ou **yarn**
- Conta e projeto criado no **Supabase**

### 2. Variáveis de Ambiente (`.env.local`)
Crie o arquivo `.env.local` na raiz do projeto com as seguintes variáveis:

```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon-aqui
NEXT_PUBLIC_ADMIN_PIN=1234
NEXT_PUBLIC_WHATSAPP_BARBEARIA=5562999999999
```

### 3. Rodando o Banco de Dados no Supabase
Caso utilize a CLI do Supabase para sincronizar as migrations:

```bash
npx supabase db push
```

### 4. Executando o Projeto em Modo de Desenvolvimento

```bash
# Instalar dependências
npm install

# Rodar servidor local
npm run dev
```

Acesse o sistema em:
- **Área do Cliente**: `http://localhost:3000`
- **Painel Administrativo**: `http://localhost:3000/admin` (PIN padrão: `1234`)

---

## 📌 Resumo da Solução

O **Barbearia Agendamento** entrega uma solução completa "chave na mão", aliando **beleza visual extraordinária**, **rapidez de carregamento**, **sincronização em tempo real** e **facilidade de uso** tanto para clientes quanto para profissionais.
