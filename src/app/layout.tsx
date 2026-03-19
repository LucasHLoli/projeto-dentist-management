import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '@/components/Sidebar';
import { AIChat } from '@/components/AIChat';

export const metadata: Metadata = {
  title: 'DentFlow — Gestão Odontológica',
  description: 'Sistema completo de gestão para clínica odontológica com integração Google.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <div className="app-layout">
          <Sidebar />
          <main className="main-content">
            {children}
          </main>
          <AIChat />
        </div>
      </body>
    </html>
  );
}
