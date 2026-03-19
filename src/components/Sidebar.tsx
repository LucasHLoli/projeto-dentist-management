'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

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
        <div style={{ 
          padding: 'var(--space-md)', 
          background: 'var(--bg-glass)', 
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-glass)',
          fontSize: '0.75rem',
          color: 'var(--text-muted)'
        }}>
          <div style={{ color: 'var(--accent-teal)', fontWeight: 600, marginBottom: '4px' }}>
            ● Online
          </div>
          Servidor Local Ativo
        </div>
      </div>
    </aside>
  );
}
