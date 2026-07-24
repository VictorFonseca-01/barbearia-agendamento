import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Barbearia Agendamento | Agende seu Horário Online',
  description: 'Agendamento rápido e descomplicado para corte de cabelo e barba em menos de 1 minuto.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="dark">
      <body className="bg-zinc-950 text-zinc-100 min-h-screen antialiased selection:bg-amber-500 selection:text-zinc-950">
        {children}
      </body>
    </html>
  );
}
