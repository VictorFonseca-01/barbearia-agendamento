# 💈 Barbearia Agendamento (Barbershop Scheduling System)

Sistema completo de agendamento online para barbearias, desenvolvido com **Next.js 14 (App Router)**, **TypeScript**, **Tailwind CSS** e **Supabase (PostgreSQL, Realtime e RLS)**.

> 📖 **Para a documentação técnica e operacional completa, acesse:** [DOCUMENTACAO.md](file:///c:/Users/vfonseca/.gemini/antigravity-ide/scratch/barbearia-agendamento/DOCUMENTACAO.md)

---

## 🚀 Tecnologias

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Lucide Icons
- **Backend & Database**: Supabase (PostgreSQL, Row Level Security - RLS, WebSockets / Realtime Subscriptions)
- **Áudio & Feedback**: Web Audio API (Sintetizador nativo para notificações de novos agendamentos) + Vibration API (Feedback tátil em mobile)

---

## 📁 Estrutura do Projeto

```
barbearia-agendamento/
├── src/
│   ├── app/
│   │   ├── admin/          # Painel Administrativo / Dashboard do Barbeiro
│   │   ├── globals.css     # Estilos globais e Tailwind CSS
│   │   ├── layout.tsx      # Layout principal da aplicação
│   │   └── page.tsx        # Página de Agendamento do Cliente (5 Etapas)
│   ├── components/
│   │   └── NotificationToast.tsx # Sistema customizado de Toasts e Modais
│   ├── lib/
│   │   └── supabase.ts     # Conexão com o Supabase
│   └── types/
│       └── database.ts     # Definições de Tipos TypeScript
├── supabase/
│   └── migrations/         # Migrações SQL e Esquema do Banco de Dados
├── DOCUMENTACAO.md         # Documentação detalhada sobre o funcionamento e arquitetura
├── package.json
└── tailwind.config.js
```

---

## 🗄️ Estrutura do Banco de Dados (Supabase)

- `barbeiros` — Profissionais ativos e inativos da barbearia.
- `servicos` — Catálogo de serviços com preço em R$ e duração em minutos.
- `agendamentos` — Registros de horários agendados com vínculo RLS, telefone, cliente e status (`pendente`, `confirmado`, `concluido`, `cancelado`).
- `barbearia_config` — Configurações globais (ex: número oficial do WhatsApp).

---

## ⚙️ Configuração Local

1. Instale as dependências:
   ```bash
   npm install
   ```

2. Configure as variáveis de ambiente em um arquivo `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://sua-url-supabase.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon-aqui
   NEXT_PUBLIC_ADMIN_PIN=1234
   NEXT_PUBLIC_WHATSAPP_BARBEARIA=5562999999999
   ```

3. Execute o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

4. Acesse:
   - **Cliente**: `http://localhost:3000`
   - **Admin**: `http://localhost:3000/admin` (PIN: `1234`)

