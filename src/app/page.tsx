'use client';

import { samplePatients, sampleAppointments, analyticsDFC, sampleStock } from '@/lib/data';

function StatCard({ icon, label, value, change, changeType, color }: {
  icon: string; label: string; value: string; change: string; changeType: 'positive' | 'negative'; color: string;
}) {
  return (
    <div className={`stat-card ${color} animate-in`}>
      <div className="stat-card-icon">{icon}</div>
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-value">{value}</div>
      <span className={`stat-card-change ${changeType}`}>
        {changeType === 'positive' ? '↑' : '↓'} {change}
      </span>
    </div>
  );
}

function MiniChart({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const gradId = `grad-${color.replace('#', '')}`;

  return (
    <svg width="100%" height="60" viewBox="0 0 200 60" preserveAspectRatio="none" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path
        d={data.map((d, i) => {
          const x = (i / (data.length - 1)) * 200;
          const y = 55 - ((d - min) / range) * 50;
          return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
        }).join(' ') + ` L 200 60 L 0 60 Z`}
        fill={`url(#${gradId})`}
      />
      <path
        d={data.map((d, i) => {
          const x = (i / (data.length - 1)) * 200;
          const y = 55 - ((d - min) / range) * 50;
          return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
        }).join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="2"
      />
    </svg>
  );
}

export default function Dashboard() {
  const totalPatients = 263;
  const totalAppointments = 1135;
  const totalRevenue = analyticsDFC.receita.reduce((a, b) => a + b, 0);
  const totalProfit = analyticsDFC.lucro.reduce((a, b) => a + b, 0);
  const lowStock = sampleStock.filter(s => s.estoqueReal <= 3).length;

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Bem-vindo ao DentFlow — Visão geral da clínica</p>
      </div>

      <div className="stats-grid">
        <StatCard icon="👥" label="Total de Pacientes" value={totalPatients.toString()} change="+12 este mês" changeType="positive" color="purple" />
        <StatCard icon="🦷" label="Atendimentos" value={totalAppointments.toLocaleString('pt-BR')} change="454 com dados" changeType="positive" color="teal" />
        <StatCard icon="💰" label="Receita Total" value={`R$ ${totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} change="+18.5%" changeType="positive" color="amber" />
        <StatCard icon="📈" label="Lucro Líquido" value={`R$ ${totalProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} change="+22.3%" changeType="positive" color="rose" />
      </div>

      <div className="grid-2" style={{ marginBottom: 'var(--space-xl)' }}>
        {/* Revenue Chart */}
        <div className="glass-card">
          <div className="glass-card-header">
            <div>
              <div className="glass-card-title">Receita Mensal</div>
              <div className="glass-card-subtitle">Evolução ao longo de 2025</div>
            </div>
            <span className="badge badge-emerald">+18.5%</span>
          </div>
          <MiniChart data={analyticsDFC.receita} color="#10b981" />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-sm)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            {['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'].map(m => (
              <span key={m}>{m}</span>
            ))}
          </div>
        </div>

        {/* Profit Chart */}
        <div className="glass-card">
          <div className="glass-card-header">
            <div>
              <div className="glass-card-title">Lucro Mensal</div>
              <div className="glass-card-subtitle">Receita menos custos operacionais</div>
            </div>
            <span className="badge badge-purple">+22.3%</span>
          </div>
          <MiniChart data={analyticsDFC.lucro} color="#6366f1" />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-sm)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            {['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'].map(m => (
              <span key={m}>{m}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid-2">
        {/* Recent Appointments */}
        <div className="glass-card">
          <div className="glass-card-header">
            <div className="glass-card-title">Últimos Atendimentos</div>
            <a href="/atendimentos" className="btn btn-sm btn-secondary">Ver todos →</a>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Paciente</th>
                  <th>Plano</th>
                </tr>
              </thead>
              <tbody>
                {sampleAppointments.slice(0, 5).map(a => (
                  <tr key={a.id}>
                    <td>{a.data.split('-').reverse().join('/')}</td>
                    <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{a.paciente}</td>
                    <td>
                      <span className={`badge ${
                        a.planoSaude === 'Particular' ? 'badge-amber' :
                        a.planoSaude === 'Uniodonto' ? 'badge-teal' :
                        a.planoSaude === 'Camed' ? 'badge-purple' : 'badge-rose'
                      }`}>
                        {a.planoSaude}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Alerts */}
        <div className="glass-card">
          <div className="glass-card-header">
            <div className="glass-card-title">Alertas</div>
            <span className="badge badge-rose">{lowStock + 2} pendências</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {lowStock > 0 && (
              <div style={{ padding: 'var(--space-md)', background: 'var(--accent-rose-glow)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(244,63,94,0.2)' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fda4af', marginBottom: '4px' }}>
                  ⚠️ Estoque Baixo
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {lowStock} item(s) com estoque ≤ 3 unidades
                </div>
              </div>
            )}

            <div style={{ padding: 'var(--space-md)', background: 'var(--accent-amber-glow)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fcd34d', marginBottom: '4px' }}>
                📋 Prontuários Desatualizados
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {samplePatients.filter(p => !p.atualizado).length} pacientes precisam de atualização
              </div>
            </div>

            <div style={{ padding: 'var(--space-md)', background: 'var(--accent-emerald-glow)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#6ee7b7', marginBottom: '4px' }}>
                🔄 Retornos Pendentes
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                3 pacientes com retorno pendente nesta semana
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
