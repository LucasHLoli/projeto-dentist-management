'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

const navSections = [
  {
    title: 'Principal',
    links: [
      { href: '/', icon: '📊', label: 'Dashboard' },
      { href: '/pacientes', icon: '👥', label: 'Pacientes', badge: '263' },
      { href: '/atendimentos', icon: '🦷', label: 'Atendimentos' },
    ],
  },
  {
    title: 'Financeiro',
    links: [
      { href: '/financeiro', icon: '💰', label: 'Análise Financeira' },
      { href: '/dre', icon: '📈', label: 'DRE' },
      { href: '/dfc', icon: '💳', label: 'Fluxo de Caixa' },
    ],
  },
  {
    title: 'Operacional',
    links: [
      { href: '/estoque', icon: '📦', label: 'Estoque' },
      { href: '/retornos', icon: '🔄', label: 'Retornos' },
      { href: '/receita', icon: '🧾', label: 'Tabela de Preços' },
    ],
  },
  {
    title: 'Inteligência',
    links: [
      { href: '/assistente', icon: '🤖', label: 'Assistente AI' },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [allConnected, setAllConnected] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/status')
      .then(r => r.json())
      .then(data => {
        setAllConnected(data.googleSheets?.connected && data.groqAI?.connected);
      })
      .catch(() => setAllConnected(false));
  }, []);

  const dotColor = allConnected === null
    ? 'var(--text-muted)'
    : allConnected
      ? 'var(--accent-teal)'
      : '#f59e0b';

  const dotGlow = allConnected === null
    ? 'none'
    : allConnected
      ? '0 0 6px var(--accent-teal)'
      : '0 0 6px #f59e0b';

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">🦷</div>
        <div>
          <div className="sidebar-logo-text">DentFlow</div>
          <div className="sidebar-logo-sub">Management System</div>
        </div>
      </div>

      {navSections.map((section) => (
        <div className="sidebar-section" key={section.title}>
          <div className="sidebar-section-title">{section.title}</div>
          {section.links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`sidebar-link ${pathname === link.href ? 'active' : ''}`}
            >
              <span className="sidebar-link-icon">{link.icon}</span>
              <span>{link.label}</span>
              {link.badge && <span className="sidebar-link-badge">{link.badge}</span>}
            </Link>
          ))}
        </div>
      ))}

      <div style={{ marginTop: 'auto', paddingTop: 'var(--space-lg)' }}>
        <div className="sidebar-section-title">Sistema</div>
        <Link
          href="/sistema"
          className={`sidebar-link ${pathname === '/sistema' ? 'active' : ''}`}
        >
          <span className="sidebar-link-icon">
            <span style={{
              display: 'inline-block',
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: dotColor,
              boxShadow: dotGlow,
            }} />
          </span>
          <span>Status do Sistema</span>
        </Link>
      </div>
    </aside>
  );
}
