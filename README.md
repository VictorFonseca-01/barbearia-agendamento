# 💈 Barbearia Agendamento (Barbershop Scheduling MVP)

Sistema completo de agendamento online para barbearias, desenvolvido com **Next.js (App Router)** e **Supabase (PostgreSQL, Auth e RLS)**.

## 🚀 Tecnologias

- **Frontend**: Next.js 14+ (React 18), Tailwind CSS / Vanilla CSS, Lucide Icons
- **Backend / Database**: Supabase (PostgreSQL, Row Level Security, Triggers e Funções SQL)
- **Autenticação**: Supabase Auth (Email/Senha e OAuth)

## 📁 Estrutura do Projeto

```
barbearia-agendamento/
├── src/
│   ├── app/                # Next.js App Router (Páginas e Rotas API)
│   ├── components/         # Componentes UI reutilizáveis
│   └── lib/                # Configurações do cliente Supabase e utilitários
├── supabase/
│   └── schema.sql          # Script PostgreSQL (Tabelas, Enums, RLS e Triggers)
├── public/                 # Assets estáticos e imagens
├── .env.example            # Exemplo de variáveis de ambiente
└── README.md
```

## 🗄️ Estrutura do Banco de Dados (Supabase)

- `profiles` — Perfis de usuários (Clientes, Barbeiros e Administradores)
- `services` — Serviços oferecidos (Corte, Barba, Combo, etc.) com preço e duração
- `appointments` — Agendamentos com data, hora, status e relacionamentos RLS

## ⚙️ Configuração Local

1. Clone o repositório:
   ```bash
   git clone <URL_DO_REPOSITORIO>
   cd barbearia-agendamento
   ```

2. Instale as dependências:
   ```bash
   npm install
   ```

3. Configure as variáveis de ambiente em um arquivo `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://sua-url-supabase.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon-aqui
   ```

4. Execute o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

---
Desenvolvido com foco em alta performance, UI/UX premium e segurança com RLS.
