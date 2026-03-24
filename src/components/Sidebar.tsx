'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  Stethoscope,
  TrendingUp,
  BarChart3,
  CreditCard,
  Package,
  RefreshCw,
  Receipt,
  Bot,
  Activity,
  type LucideIcon,
} from 'lucide-react';

interface NavLink {
  href: string;
  icon: LucideIcon;
  label: string;
  badge?: string;
}

interface NavSection {
  title: string;
  links: NavLink[];
}

const navSections: NavSection[] = [
  {
    title: 'Principal',
    links: [
      { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
      { href: '/pacientes', icon: Users, label: 'Pacientes', badge: '263' },
      { href: '/atendimentos', icon: Stethoscope, label: 'Atendimentos' },
    ],
  },
  {
    title: 'Financeiro',
    links: [
      { href: '/financeiro', icon: TrendingUp, label: 'Análise Financeira' },
      { href: '/dre', icon: BarChart3, label: 'DRE' },
      { href: '/dfc', icon: CreditCard, label: 'Fluxo de Caixa' },
    ],
  },
  {
    title: 'Operacional',
    links: [
      { href: '/estoque', icon: Package, label: 'Estoque' },
      { href: '/retornos', icon: RefreshCw, label: 'Retornos' },
      { href: '/receita', icon: Receipt, label: 'Tabela de Preços' },
    ],
  },
  {
    title: 'Inteligência',
    links: [
      { href: '/assistente', icon: Bot, label: 'Assistente AI' },
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
        <div className="sidebar-logo-icon">
          <Activity size={22} color="white" strokeWidth={2} />
        </div>
        <div>
          <div className="sidebar-logo-text">DentFlow</div>
          <div className="sidebar-logo-sub">Management System</div>
        </div>
      </div>

      {navSections.map((section) => (
        <div className="sidebar-section" key={section.title}>
          <div className="sidebar-section-title">{section.title}</div>
          {section.links.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`sidebar-link ${isActive ? 'active' : ''}`}
              >
                <span className="sidebar-link-icon">
                  <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                </span>
                <span>{link.label}</span>
                {link.badge && <span className="sidebar-link-badge">{link.badge}</span>}
              </Link>
            );
          })}
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
