'use client';

const procedimentos = [
  { tipo: 'Particular', nome: 'Urgência Endodontica', valor2025: 450, valor2026: 469.44 },
  { tipo: 'Particular', nome: 'Clareamento Consultório', valor2025: 500, valor2026: 521.60 },
  { tipo: 'Particular', nome: 'Clareamento Caseiro', valor2025: 350, valor2026: 365.12 },
  { tipo: 'Particular', nome: 'Profilaxia + Raspagem', valor2025: 350, valor2026: 365.12 },
  { tipo: 'Particular', nome: 'Preenchimento Labial', valor2025: 600, valor2026: 625.92 },
  { tipo: 'Uniodonto', nome: 'Consulta odontológica inicial', valor2025: 30.95, valor2026: 30.95 },
  { tipo: 'Uniodonto', nome: 'Profilaxia', valor2025: 45.50, valor2026: 45.50 },
  { tipo: 'Uniodonto', nome: 'Raspagem Supragengival', valor2025: 12.00, valor2026: 12.00 },
  { tipo: 'Camed', nome: 'Tratamento endodôntico birradicular', valor2025: 180.00, valor2026: 180.00 },
  { tipo: 'Camed', nome: 'Restauração direta resina', valor2025: 85.00, valor2026: 85.00 },
  { tipo: 'Geap', nome: 'CONSULTA ODONTOLÓGICA INICIAL', valor2025: 30.95, valor2026: 30.95 },
  { tipo: 'Geap', nome: 'PACOTE ODONTOLÓGICO PERIODONTAL', valor2025: 61.76, valor2026: 61.76 },
];

export default function ReceitaPage() {
  const tipos = [...new Set(procedimentos.map(p => p.tipo))];

  return (
    <div>
      <div className="page-header">
        <h1>Tabela de Preços</h1>
        <p>Base de receita com valores por procedimento e plano de saúde</p>
      </div>

      {tipos.map(tipo => (
        <div key={tipo} style={{ marginBottom: 'var(--space-xl)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
            <span className={`badge ${tipo === 'Particular' ? 'badge-amber' : tipo === 'Uniodonto' ? 'badge-teal' : tipo === 'Camed' ? 'badge-purple' : 'badge-rose'}`} style={{ fontSize: '0.8rem', padding: '6px 14px' }}>
              {tipo}
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {procedimentos.filter(p => p.tipo === tipo).length} procedimentos
            </span>
          </div>

          <div className="glass-card" style={{ padding: 0 }}>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Procedimento</th>
                    <th style={{ textAlign: 'right' }}>Valor 2025</th>
                    <th style={{ textAlign: 'right' }}>Valor 2026</th>
                    <th style={{ textAlign: 'right' }}>Reajuste</th>
                  </tr>
                </thead>
                <tbody>
                  {procedimentos.filter(p => p.tipo === tipo).map((p, i) => {
                    const reajuste = ((p.valor2026 - p.valor2025) / p.valor2025) * 100;
                    return (
                      <tr key={i}>
                        <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{p.nome}</td>
                        <td style={{ textAlign: 'right' }}>R$ {p.valor2025.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>R$ {p.valor2026.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                        <td style={{ textAlign: 'right' }}>
                          {reajuste > 0 ? (
                            <span className="badge badge-amber">+{reajuste.toFixed(1)}%</span>
                          ) : (
                            <span className="badge badge-teal">0%</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
