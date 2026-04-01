import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '@/components/Sidebar';
import { AIChatWrapper } from '@/components/AIChatWrapper';
import { ToastProvider } from '@/components/Toast';

export const metadata: Metadata = {
  title: 'DentFlow — Gestão Odontológica',
  description: 'Sistema completo de gestão para clínica odontológica com integração Google.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ToastProvider>
          <div className="app-layout">
            <Sidebar />
            <main className="main-content">
              {children}
            </main>
            <AIChatWrapper />
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
