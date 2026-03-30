'use client';

import { useState, useMemo, useRef } from 'react';
import {
  samplePatients, sampleAppointments, sampleStock,
  analyticsByYear, MONTHS_SHORT,
  type MonthlyData,
} from '@/lib/data';
import {
  Users, Stethoscope, DollarSign, TrendingUp,
  ArrowUpRight, ArrowDownRight, AlertTriangle, ClipboardList, RefreshCw,
  Minus, Star, Zap, Target, BarChart2, type LucideIcon,
} from 'lucide-react';

type CompareMode = 'none' | 'years' | 'quarters' | 'months';
type QuarterFilter = 'all' | 'Q1' | 'Q2' | 'Q3' | 'Q4';

interface FilterState {
  year: number | 'all';
  month: number | 'all';
  quarterFilter: QuarterFilter;
  compareMode: CompareMode;
  compareYear: number;
  compareMonth: number;
}

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtShort(v: number) {
  if (v >= 1000) return `R$ ${(v / 1000).toFixed(1)}k`;
  return `R$ ${v.toFixed(0)}`;
}

function getYearData(year: number | 'all'): MonthlyData[] {
  if (year === 'all') {
    const merged: MonthlyData[] = Array.from({ length: 12 }, () => ({
      receita: 0, custo: 0, lucro: 0, atendimentos: 0,
    }));
    analyticsByYear.forEach(yd => {
      yd.months.forEach((m, i) => {
        merged[i].receita += m.receita;
        merged[i].custo += m.custo;
        merged[i].lucro += m.lucro;
        merged[i].atendimentos += m.atendimentos;
      });
    });
    return merged;
  }
  return analyticsByYear.find(y => y.year === year)?.months
    ?? Array.from({ length: 12 }, () => ({ receita: 0, custo: 0, lucro: 0, atendimentos: 0 }));
}

function quarterIdx(q: QuarterFilter): number {
  return { Q1: 0, Q2: 1, Q3: 2, Q4: 3 }[q as string] ?? -1;
}

function getQuarterMonths(months: MonthlyData[], qIdx: number): MonthlyData[] {
  const start = qIdx * 3;
  return months.slice(start, start + 3);
}

function applyFilters(months: MonthlyData[], month: number | 'all', quarter: QuarterFilter): MonthlyData[] {
  if (month !== 'all') return [months[month as number]];
  if (quarter !== 'all') return getQuarterMonths(months, quarterIdx(quarter));
  return months;
}

function sumField(months: MonthlyData[], field: keyof MonthlyData): number {
  return months.reduce((acc, m) => acc + ((m[field] as number) || 0), 0);
}

function calcDelta(curr: number, prev: number): { pct: number; abs: number } {
  if (prev === 0) return { pct: 0, abs: curr };
  return { pct: ((curr - prev) / prev) * 100, abs: curr - prev };
}

/** Returns prior period data for automatic delta (without compare mode) */
function getPriorPeriod(
  primaryMonths: MonthlyData[],
  month: number | 'all',
  quarter: QuarterFilter,
  year: number | 'all',
): MonthlyData[] {
  // If specific month selected, compare to previous month
  if (month !== 'all') {
    const mIdx = month as number;
    if (mIdx === 0) {
      // Jan — compare to Dec of previous year
      const prevYear = year === 'all' ? null : (year as number) - 1;
      if (prevYear && prevYear >= 2023) {
        const prevData = getYearData(prevYear);
        return [prevData[11]];
      }
      return [{ receita: 0, custo: 0, lucro: 0, atendimentos: 0 }];
    }
    return [primaryMonths[mIdx - 1]];
  }
  // If quarter selected, compare to same quarter previous year
  if (quarter !== 'all') {
    const prevYear = year === 'all' ? null : (year as number) - 1;
    if (prevYear && prevYear >= 2023) {
      const prevData = getYearData(prevYear);
      return getQuarterMonths(prevData, quarterIdx(quarter));
    }
    return Array.from({ length: 3 }, () => ({ receita: 0, custo: 0, lucro: 0, atendimentos: 0 }));
  }
  // Full year — compare to previous year
  const prevYear = year === 'all' ? null : (year as number) - 1;
  if (prevYear && prevYear >= 2023) {
    return getYearData(prevYear);
  }
  return Array.from({ length: 12 }, () => ({ receita: 0, custo: 0, lucro: 0, atendimentos: 0 }));
}

function getQuarterAggregate(months: MonthlyData[], qIdx: number): MonthlyData {
  const ms = getQuarterMonths(months, qIdx);
  return ms.reduce(
    (acc, m) => ({
      receita: acc.receita + m.receita,
      custo: acc.custo + m.custo,
      lucro: acc.lucro + m.lucro,
      atendimentos: acc.atendimentos + m.atendimentos,
    }),
    { receita: 0, custo: 0, lucro: 0, atendimentos: 0 },
  );
}

function DashboardFilters({ filters, onChange }: { filters: FilterState; onChange: (f: FilterState) => void }) {
  const years = [2023, 2024, 2025, 2026];

  function set<K extends keyof FilterState>(key: K, val: FilterState[K]) {
    onChange({ ...filters, [key]: val });
  }

  const selStyle: React.CSSProperties = {
    width: 'auto',
    padding: '6px 32px 6px 10px',
    fontSize: '0.8rem',
    height: 34,
  };

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center',
      padding: '0.75rem 1rem',
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '0.75rem',
      marginBottom: '1.5rem',
    }}>
      <span style={{
        fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.1em', marginRight: '0.25rem',
      }}>Filtros</span>

      <select
        className="form-input" style={selStyle}
        value={filters.year === 'all' ? 'all' : filters.year}
        onChange={e => {
          const newYear = e.target.value === 'all' ? 'all' : Number(e.target.value);
          onChange({ ...filters, year: newYear });
        }}
      >
        <option value="all">Todos os anos</option>
        {years.map(y => <option key={y} value={y}>{y}</option>)}
      </select>

      <select
        className="form-input" style={selStyle}
        value={filters.quarterFilter}
        onChange={e => onChange({
          ...filters,
          quarterFilter: e.target.value as QuarterFilter,
          month: e.target.value !== 'all' ? 'all' : filters.month,
        })}
      >
        <option value="all">Todos os trimestres</option>
        <option value="Q1">Q1 (Jan–Mar)</option>
        <option value="Q2">Q2 (Abr–Jun)</option>
        <option value="Q3">Q3 (Jul–Set)</option>
        <option value="Q4">Q4 (Out–Dez)</option>
      </select>

      <select
        className="form-input" style={selStyle}
        value={filters.month === 'all' ? 'all' : filters.month}
        onChange={e => onChange({
          ...filters,
          month: e.target.value === 'all' ? 'all' : Number(e.target.value),
          quarterFilter: e.target.value !== 'all' ? 'all' : filters.quarterFilter,
        })}
      >
        <option value="all">Todos os meses</option>
        {MONTHS_SHORT.map((m, i) => <option key={i} value={i}>{m}</option>)}
      </select>

      <select
        className="form-input" style={selStyle}
        value={filters.compareMode}
        onChange={e => set('compareMode', e.target.value as CompareMode)}
      >
        <option value="none">Sem comparação</option>
        <option value="years">Comparar anos</option>
        <option value="quarters">Comparar trimestres</option>
        <option value="months">Comparar meses</option>
      </select>

      {filters.compareMode !== 'none' && (
        <>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>vs</span>
          <select
            className="form-input" style={selStyle}
            value={filters.compareYear}
            onChange={e => set('compareYear', Number(e.target.value))}
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          {filters.compareMode === 'months' && (
            <select
              className="form-input" style={selStyle}
              value={filters.compareMonth}
              onChange={e => set('compareMonth', Number(e.target.value))}
            >
              {MONTHS_SHORT.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, delta, deltaLabel, color }: {
  icon: LucideIcon;
  label: string;
  value: string;
  delta: { pct: number; abs: number } | null;
  deltaLabel?: string;
  color: string;
}) {
  const positive = delta ? delta.pct >= 0 : true;
  const hasData = delta !== null && Math.abs(delta.pct) > 0.01;

  function fmtAbs(v: number) {
    if (Math.abs(v) >= 1000) return `R$ ${(Math.abs(v) / 1000).toFixed(1)}k`;
    if (Math.abs(v) >= 1) return `R$ ${Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    return String(Math.round(Math.abs(v)));
  }

  return (
    <div className={`stat-card ${color} animate-in`} style={{ position: 'relative', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.06,
        background: color === 'purple' ? 'var(--gradient-hero)' :
          color === 'teal' ? 'var(--gradient-teal)' :
          color === 'amber' ? 'var(--gradient-amber)' : 'var(--gradient-rose)',
        pointerEvents: 'none',
      }} />
      <div className="stat-card-icon"><Icon size={18} strokeWidth={2} /></div>
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-value" style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>{value}</div>
      {hasData ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className={`stat-card-change ${positive ? 'positive' : 'negative'}`} style={{ width: 'fit-content' }}>
            {positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {Math.abs(delta!.pct).toFixed(1)}% ({positive ? '+' : '-'}{fmtAbs(delta!.abs)})
          </span>
          {deltaLabel && (
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', paddingLeft: 2 }}>{deltaLabel}</span>
          )}
        </div>
      ) : (
        <span className="stat-card-change" style={{ color: 'var(--text-muted)', background: 'rgba(100,116,139,0.1)' }}>
          <Minus size={12} /> sem comparativo
        </span>
      )}
    </div>
  );
}

function BarChart({
  primaryData, primaryLabel, primaryColor,
  compareData, compareLabel, compareColor,
  labels,
}: {
  primaryData: number[];
  primaryLabel: string;
  primaryColor: string;
  compareData?: number[];
  compareLabel?: string;
  compareColor?: string;
  labels: string[];
}) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; idx: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const allVals = [...primaryData, ...(compareData ?? [])].filter(v => v > 0);
  const max = Math.max(...allVals, 1);
  const W = 360;
  const H = 100;
  const barCount = primaryData.length;
  const groupW = W / barCount;
  const barW = compareData ? groupW * 0.38 : groupW * 0.55;
  const gap = compareData ? groupW * 0.06 : 0;

  return (
    <div style={{ position: 'relative', userSelect: 'none' }}>
      {compareData && (
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: primaryColor, display: 'inline-block' }} />
            {primaryLabel}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: compareColor, display: 'inline-block' }} />
            {compareLabel}
          </span>
        </div>
      )}
      <svg
        ref={svgRef}
        width="100%" height={H + 20} viewBox={`0 0 ${W} ${H + 20}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block', cursor: 'crosshair' }}
        onMouseLeave={() => setTooltip(null)}
        onMouseMove={e => {
          const rect = svgRef.current?.getBoundingClientRect();
          if (!rect) return;
          const rx = (e.clientX - rect.left) / rect.width * W;
          const idx = Math.min(barCount - 1, Math.max(0, Math.floor(rx / groupW)));
          setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, idx });
        }}
      >
        <defs>
          <linearGradient id={`bg-p-${primaryColor.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={primaryColor} stopOpacity="1" />
            <stop offset="100%" stopColor={primaryColor} stopOpacity="0.4" />
          </linearGradient>
          {compareColor && (
            <linearGradient id={`bg-c-${compareColor.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={compareColor} stopOpacity="1" />
              <stop offset="100%" stopColor={compareColor} stopOpacity="0.4" />
            </linearGradient>
          )}
        </defs>

        {primaryData.map((v, i) => {
          const bh = (v / max) * (H - 10);
          const xOffset = i * groupW + (groupW - (compareData ? barW * 2 + gap : barW)) / 2;
          return (
            <rect
              key={`p${i}`}
              x={xOffset} y={H - bh} width={barW} height={Math.max(bh, 1)}
              rx={3}
              fill={`url(#bg-p-${primaryColor.replace('#', '')})`}
              opacity={tooltip?.idx === i ? 1 : 0.8}
              style={{ transition: 'opacity 100ms' }}
            />
          );
        })}

        {compareData?.map((v, i) => {
          const bh = (v / max) * (H - 10);
          const xOffset = i * groupW + (groupW - barW * 2 - gap) / 2 + barW + gap;
          return (
            <rect
              key={`c${i}`}
              x={xOffset} y={H - bh} width={barW} height={Math.max(bh, 1)}
              rx={3}
              fill={compareColor ? `url(#bg-c-${compareColor.replace('#', '')})` : '#aaa'}
              opacity={tooltip?.idx === i ? 1 : 0.6}
              style={{ transition: 'opacity 100ms' }}
            />
          );
        })}

        {tooltip !== null && (
          <rect
            x={tooltip.idx * groupW} y={0}
            width={groupW} height={H}
            fill="rgba(255,255,255,0.04)"
          />
        )}

        {labels.map((l, i) => (
          <text
            key={`${l}-${i}`} x={i * groupW + groupW / 2} y={H + 14}
            textAnchor="middle" fontSize={8} fill="var(--text-muted)"
          >{l}</text>
        ))}
      </svg>

      {tooltip !== null && (
        <div style={{
          position: 'absolute',
          top: Math.max(0, tooltip.y - 80),
          left: Math.min(tooltip.x + 10, 220),
          background: '#1e2235',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '0.5rem',
          padding: '0.5rem 0.75rem',
          fontSize: '0.75rem',
          color: 'var(--text-primary)',
          pointerEvents: 'none',
          zIndex: 10,
          minWidth: 120,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--text-secondary)', fontSize: '0.7rem' }}>
            {labels[tooltip.idx]}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: primaryColor, display: 'inline-block', flexShrink: 0 }} />
            {primaryLabel}: <strong style={{ color: primaryColor }}>{fmtShort(primaryData[tooltip.idx])}</strong>
          </div>
          {compareData && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: compareColor, display: 'inline-block', flexShrink: 0 }} />
              {compareLabel}: <strong style={{ color: compareColor }}>{fmtShort(compareData[tooltip.idx])}</strong>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function HighlightCard({ icon: Icon, label, value, sub, iconColor, bgGlow }: {
  icon: LucideIcon; label: string; value: string; sub?: string; iconColor: string; bgGlow: string;
}) {
  return (
    <div style={{
      background: bgGlow, border: `1px solid ${iconColor}33`,
      borderRadius: '0.75rem', padding: '0.9rem 1rem',
      display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `${iconColor}22`, flexShrink: 0,
      }}>
        <Icon size={16} color={iconColor} />
      </div>
      <div>
        <div style={{ fontSize: '0.65rem', fontWeight: 600, color: iconColor, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>{value}</div>
        {sub && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

function QuarterCard({ label, curr, prev }: {
  label: string; curr: MonthlyData; prev: MonthlyData | null;
}) {
  const dRev = prev && prev.receita > 0 ? calcDelta(curr.receita, prev.receita) : null;
  const dProfit = prev && prev.lucro > 0 ? calcDelta(curr.lucro, prev.lucro) : null;
  return (
    <div className="glass-card" style={{ padding: '1rem' }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>{label}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
        <div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: 2 }}>Receita</div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{fmtShort(curr.receita)}</div>
          {dRev && (
            <span style={{ fontSize: '0.65rem', color: dRev.pct >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)', display: 'flex', alignItems: 'center', gap: 2, marginTop: 2 }}>
              {dRev.pct >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
              {Math.abs(dRev.pct).toFixed(1)}%
            </span>
          )}
        </div>
        <div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: 2 }}>Lucro</div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#6366f1' }}>{fmtShort(curr.lucro)}</div>
          {dProfit && (
            <span style={{ fontSize: '0.65rem', color: dProfit.pct >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)', display: 'flex', alignItems: 'center', gap: 2, marginTop: 2 }}>
              {dProfit.pct >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
              {Math.abs(dProfit.pct).toFixed(1)}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [filters, setFilters] = useState<FilterState>({
    year: 2025,
    month: 'all',
    quarterFilter: 'all',
    compareMode: 'none',
    compareYear: 2024,
    compareMonth: 0,
  });

  const lowStock = sampleStock.filter(s => s.estoqueReal <= 3).length;

  // Primary year months
  const primaryYearMonths = useMemo(() => getYearData(filters.year), [filters.year]);
  // Primary filtered months
  const primaryFiltered = useMemo(
    () => applyFilters(primaryYearMonths, filters.month, filters.quarterFilter),
    [primaryYearMonths, filters.month, filters.quarterFilter],
  );

  // Compare year months
  const compareYearMonths = useMemo(() => getYearData(filters.compareYear), [filters.compareYear]);

  // In compare-months mode, always compare a specific primary month vs compare month.
  // If user hasn't selected a month, default to month 0 (January) for comparison.
  const effectivePrimaryMonth: number | 'all' = filters.compareMode === 'months'
    ? (filters.month !== 'all' ? (filters.month as number) : 0)
    : filters.month;

  // Primary filtered adjusted for compare-months (enforce specific month)
  const primaryFilteredForCompare = useMemo(() => {
    if (filters.compareMode === 'months') {
      const mIdx = filters.month !== 'all' ? (filters.month as number) : 0;
      return [primaryYearMonths[mIdx]];
    }
    return primaryFiltered;
  }, [primaryYearMonths, filters.compareMode, filters.month, primaryFiltered]);

  // Compare filtered months (depends on mode)
  const compareFiltered = useMemo(() => {
    if (filters.compareMode === 'months') {
      return [compareYearMonths[filters.compareMonth]];
    }
    // For 'years' and 'quarters' mode, apply same month/quarter filter on compare year
    return applyFilters(compareYearMonths, filters.month, filters.quarterFilter);
  }, [compareYearMonths, filters.compareMode, filters.compareMonth, filters.month, filters.quarterFilter]);

  // Prior period (auto delta even without compare mode)
  const priorFiltered = useMemo(
    () => getPriorPeriod(primaryYearMonths, filters.month, filters.quarterFilter, filters.year),
    [primaryYearMonths, filters.month, filters.quarterFilter, filters.year],
  );

  // For KPIs: in compare-months mode use the aligned (single-month) primary data
  const kpiPrimary = filters.compareMode === 'months' ? primaryFilteredForCompare : primaryFiltered;

  const primaryReceit = sumField(kpiPrimary, 'receita');
  const primaryLucro = sumField(kpiPrimary, 'lucro');
  const primaryCusto = sumField(kpiPrimary, 'custo');
  const primaryAtend = sumField(kpiPrimary, 'atendimentos');

  // If compare mode active, use compare period; otherwise use auto prior period
  const compareReceit = filters.compareMode !== 'none' ? sumField(compareFiltered, 'receita') : sumField(priorFiltered, 'receita');
  const compareLucro = filters.compareMode !== 'none' ? sumField(compareFiltered, 'lucro') : sumField(priorFiltered, 'lucro');
  const compareAtend = filters.compareMode !== 'none' ? sumField(compareFiltered, 'atendimentos') : sumField(priorFiltered, 'atendimentos');

  const deltaReceit = calcDelta(primaryReceit, compareReceit);
  const deltaLucro = calcDelta(primaryLucro, compareLucro);
  const deltaAtend = calcDelta(primaryAtend, compareAtend);

  const ticketMedio = primaryAtend > 0 ? primaryReceit / primaryAtend : 0;
  const margem = primaryReceit > 0 ? (primaryLucro / primaryReceit) * 100 : 0;

  // Best month in primary year
  const bestMonthIdx = primaryYearMonths.reduce((best, m, i) => m.receita > primaryYearMonths[best].receita ? i : best, 0);
  const bestMonthRev = primaryYearMonths[bestMonthIdx].receita;

  // Highest MoM growth in primary year
  let bestGrowthIdx = -1;
  let bestGrowthPct = -Infinity;
  for (let i = 1; i < primaryYearMonths.length; i++) {
    const prev = primaryYearMonths[i - 1].receita;
    const curr = primaryYearMonths[i].receita;
    if (prev > 0 && curr > 0) {
      const pct = ((curr - prev) / prev) * 100;
      if (pct > bestGrowthPct) { bestGrowthPct = pct; bestGrowthIdx = i; }
    }
  }

  // Year-over-year comparison for Business Highlights
  const prevYear = typeof filters.year === 'number' && filters.year > 2023 ? filters.year - 1 : null;
  const prevYearData = prevYear ? getYearData(prevYear) : null;
  // YoY uses the same filtered period applied to prev year (month/quarter/full)
  const prevYearFiltered = prevYearData
    ? applyFilters(prevYearData, filters.month, filters.quarterFilter)
    : null;
  const prevYearRevenue = prevYearFiltered ? sumField(prevYearFiltered, 'receita') : 0;
  const currentYearRevenue = sumField(primaryFiltered, 'receita');
  const yoyDelta = prevYearRevenue > 0 ? calcDelta(currentYearRevenue, prevYearRevenue) : null;

  const showCompare = filters.compareMode !== 'none';

  let chartLabels: string[];
  let chartPrimary: number[];
  let chartPrimaryLucro: number[];
  let chartCompare: number[] | undefined;
  let chartCompareLucro: number[] | undefined;
  let chartPrimaryLabel: string;
  let chartCompareLabel: string;

  chartPrimaryLabel = filters.year === 'all' ? 'Todos' : String(filters.year);
  chartCompareLabel = String(filters.compareYear);

  if (filters.compareMode === 'quarters') {
    chartLabels = ['Q1', 'Q2', 'Q3', 'Q4'];
    chartPrimary = [0, 1, 2, 3].map(q => sumField(getQuarterMonths(primaryYearMonths, q), 'receita'));
    chartPrimaryLucro = [0, 1, 2, 3].map(q => sumField(getQuarterMonths(primaryYearMonths, q), 'lucro'));
    chartCompare = [0, 1, 2, 3].map(q => sumField(getQuarterMonths(compareYearMonths, q), 'receita'));
    chartCompareLucro = [0, 1, 2, 3].map(q => sumField(getQuarterMonths(compareYearMonths, q), 'lucro'));
  } else if (filters.compareMode === 'months') {
    // True month comparison: two bars — primary month vs compare month
    const pMonthIdx = filters.month !== 'all' ? (filters.month as number) : 0;
    const pLabel = `${MONTHS_SHORT[pMonthIdx]} ${filters.year === 'all' ? '' : filters.year}`.trim();
    const cLabel = `${MONTHS_SHORT[filters.compareMonth]} ${filters.compareYear}`;
    chartLabels = [pLabel, cLabel];
    chartPrimary = [primaryYearMonths[pMonthIdx].receita, 0];
    chartPrimaryLucro = [primaryYearMonths[pMonthIdx].lucro, 0];
    chartCompare = [0, compareYearMonths[filters.compareMonth].receita];
    chartCompareLucro = [0, compareYearMonths[filters.compareMonth].lucro];
    chartPrimaryLabel = pLabel;
    chartCompareLabel = cLabel;
  } else {
    // Default: 12 months view, optionally with compare year overlay
    chartLabels = MONTHS_SHORT;
    chartPrimary = primaryYearMonths.map(m => m.receita);
    chartPrimaryLucro = primaryYearMonths.map(m => m.lucro);
    if (showCompare) {
      chartCompare = compareYearMonths.map(m => m.receita);
      chartCompareLucro = compareYearMonths.map(m => m.lucro);
    }
  }

  // Quarter filter: show quarter cards
  const showQuarterCards = filters.compareMode === 'quarters' || filters.quarterFilter !== 'all';

  const periodLabel = (() => {
    if (filters.quarterFilter !== 'all') {
      const q = filters.quarterFilter;
      return `${q} ${filters.year === 'all' ? '(todos os anos)' : filters.year}`;
    }
    if (filters.year === 'all') return 'Todos os anos';
    if (filters.month !== 'all') return `${MONTHS_SHORT[filters.month as number]} ${filters.year}`;
    return String(filters.year);
  })();

  const compareLabel = filters.compareMode !== 'none'
    ? (filters.compareMode === 'months'
        ? `${MONTHS_SHORT[filters.compareMonth]} ${filters.compareYear}`
        : String(filters.compareYear))
    : `${typeof filters.year === 'number' && filters.year > 2023 ? filters.year - 1 : ''}`;

  const deltaLabel = filters.compareMode !== 'none'
    ? `vs ${compareLabel}`
    : `vs período anterior`;

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Visão estratégica da clínica — <strong style={{ color: 'var(--text-secondary)' }}>{periodLabel}</strong></p>
      </div>

      <DashboardFilters filters={filters} onChange={setFilters} />

      {/* KPI Cards */}
      <div className="stats-grid">
        <StatCard
          icon={Users}
          label="Total de Pacientes"
          value="263"
          delta={null}
          color="purple"
        />
        <StatCard
          icon={Stethoscope}
          label="Atendimentos"
          value={primaryAtend > 0 ? primaryAtend.toLocaleString('pt-BR') : '—'}
          delta={compareAtend > 0 ? deltaAtend : null}
          deltaLabel={deltaLabel}
          color="teal"
        />
        <StatCard
          icon={DollarSign}
          label="Receita do Período"
          value={primaryReceit > 0 ? `R$ ${fmt(primaryReceit)}` : '—'}
          delta={compareReceit > 0 ? deltaReceit : null}
          deltaLabel={deltaLabel}
          color="amber"
        />
        <StatCard
          icon={TrendingUp}
          label="Lucro Líquido"
          value={primaryLucro > 0 ? `R$ ${fmt(primaryLucro)}` : '—'}
          delta={compareLucro > 0 ? deltaLucro : null}
          deltaLabel={deltaLabel}
          color="rose"
        />
      </div>

      {/* Business Highlights */}
      <div className="glass-card" style={{ marginBottom: 'var(--space-xl)' }}>
        <div className="glass-card-header">
          <div>
            <div className="glass-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Zap size={16} color="var(--accent-amber)" /> Business Highlights
            </div>
            <div className="glass-card-subtitle">Insights automáticos — {periodLabel}</div>
          </div>
          <span className="badge badge-amber">{periodLabel}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.75rem' }}>
          <HighlightCard
            icon={Star}
            label="Melhor Mês"
            value={bestMonthRev > 0 ? MONTHS_SHORT[bestMonthIdx] : '—'}
            sub={bestMonthRev > 0 ? `R$ ${fmt(bestMonthRev)}` : 'Sem dados'}
            iconColor="#f59e0b"
            bgGlow="rgba(245,158,11,0.06)"
          />
          <HighlightCard
            icon={TrendingUp}
            label="Maior Crescimento MoM"
            value={bestGrowthIdx >= 0 ? MONTHS_SHORT[bestGrowthIdx] : '—'}
            sub={bestGrowthIdx >= 0 ? `+${bestGrowthPct.toFixed(1)}% vs mês anterior` : 'Sem dados'}
            iconColor="#10b981"
            bgGlow="rgba(16,185,129,0.06)"
          />
          <HighlightCard
            icon={Target}
            label="Ticket Médio"
            value={ticketMedio > 0 ? `R$ ${fmt(ticketMedio)}` : '—'}
            sub={primaryAtend > 0 ? `${primaryAtend} atendimentos` : 'Sem dados'}
            iconColor="#6366f1"
            bgGlow="rgba(99,102,241,0.06)"
          />
          <HighlightCard
            icon={BarChart2}
            label="Margem Operacional"
            value={primaryReceit > 0 ? `${margem.toFixed(1)}%` : '—'}
            sub={primaryCusto > 0 ? `Custo: R$ ${fmt(primaryCusto)}` : 'Sem dados'}
            iconColor="#14b8a6"
            bgGlow="rgba(20,184,166,0.06)"
          />
          {yoyDelta && (
            <HighlightCard
              icon={yoyDelta.pct >= 0 ? ArrowUpRight : ArrowDownRight}
              label={`vs ${prevYear} (ano anterior)`}
              value={`${yoyDelta.pct >= 0 ? '+' : ''}${yoyDelta.pct.toFixed(1)}%`}
              sub={`R$ ${fmt(Math.abs(yoyDelta.abs))} ${yoyDelta.pct >= 0 ? 'a mais' : 'a menos'}`}
              iconColor={yoyDelta.pct >= 0 ? '#10b981' : '#f43f5e'}
              bgGlow={yoyDelta.pct >= 0 ? 'rgba(16,185,129,0.06)' : 'rgba(244,63,94,0.06)'}
            />
          )}
        </div>
      </div>

      {/* Quarter Cards */}
      {showQuarterCards && (
        <div style={{ marginBottom: 'var(--space-xl)' }}>
          <div style={{
            fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem',
          }}>
            Resumo por Trimestre — {filters.year === 'all' ? 'Todos os anos' : filters.year}
            {filters.compareMode === 'quarters' ? ` vs ${filters.compareYear}` : ''}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.75rem' }}>
            {[0, 1, 2, 3].map(q => {
              const curr = getQuarterAggregate(primaryYearMonths, q);
              const prev = filters.compareMode === 'quarters'
                ? getQuarterAggregate(compareYearMonths, q)
                : prevYearData ? getQuarterAggregate(prevYearData, q) : null;
              const isActive = filters.quarterFilter === 'all' || filters.quarterFilter === (`Q${q + 1}` as QuarterFilter);
              return (
                <div key={q} style={{ opacity: isActive ? 1 : 0.45, transition: 'opacity 200ms' }}>
                  <QuarterCard label={`Q${q + 1}`} curr={curr} prev={prev} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid-2" style={{ marginBottom: 'var(--space-xl)' }}>
        <div className="glass-card">
          <div className="glass-card-header">
            <div>
              <div className="glass-card-title">Receita</div>
              <div className="glass-card-subtitle">
                {showCompare ? `${chartPrimaryLabel} vs ${chartCompareLabel}` : `Evolução — ${periodLabel}`}
              </div>
            </div>
            <span className="badge badge-emerald">{primaryReceit > 0 ? `R$ ${fmt(primaryReceit)}` : '—'}</span>
          </div>
          <BarChart
            primaryData={chartPrimary}
            primaryLabel={chartPrimaryLabel}
            primaryColor="#10b981"
            compareData={showCompare ? chartCompare : undefined}
            compareLabel={chartCompareLabel}
            compareColor="#6366f1"
            labels={chartLabels}
          />
        </div>

        <div className="glass-card">
          <div className="glass-card-header">
            <div>
              <div className="glass-card-title">Lucro</div>
              <div className="glass-card-subtitle">
                {showCompare ? `${chartPrimaryLabel} vs ${chartCompareLabel}` : 'Receita menos custos operacionais'}
              </div>
            </div>
            <span className="badge badge-purple">{primaryLucro > 0 ? `R$ ${fmt(primaryLucro)}` : '—'}</span>
          </div>
          <BarChart
            primaryData={chartPrimaryLucro}
            primaryLabel={chartPrimaryLabel}
            primaryColor="#6366f1"
            compareData={showCompare ? chartCompareLucro : undefined}
            compareLabel={chartCompareLabel}
            compareColor="#f43f5e"
            labels={chartLabels}
          />
        </div>
      </div>

      {/* Bottom: last appointments + alerts */}
      <div className="grid-2">
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

        <div className="glass-card">
          <div className="glass-card-header">
            <div className="glass-card-title">Alertas</div>
            <span className="badge badge-rose">{lowStock + 2} pendências</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {lowStock > 0 && (
              <div style={{ padding: 'var(--space-md)', background: 'var(--accent-rose-glow)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(244,63,94,0.2)', display: 'flex', gap: 'var(--space-md)', alignItems: 'flex-start' }}>
                <AlertTriangle size={16} color="#fda4af" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fda4af', marginBottom: '4px' }}>Estoque Baixo</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{lowStock} item(s) com estoque ≤ 3 unidades</div>
                </div>
              </div>
            )}
            <div style={{ padding: 'var(--space-md)', background: 'var(--accent-amber-glow)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(245,158,11,0.2)', display: 'flex', gap: 'var(--space-md)', alignItems: 'flex-start' }}>
              <ClipboardList size={16} color="#fcd34d" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fcd34d', marginBottom: '4px' }}>Prontuários Desatualizados</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{samplePatients.filter(p => !p.atualizado).length} pacientes precisam de atualização</div>
              </div>
            </div>
            <div style={{ padding: 'var(--space-md)', background: 'var(--accent-emerald-glow)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(16,185,129,0.2)', display: 'flex', gap: 'var(--space-md)', alignItems: 'flex-start' }}>
              <RefreshCw size={16} color="#6ee7b7" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#6ee7b7', marginBottom: '4px' }}>Retornos Pendentes</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>3 pacientes com retorno pendente nesta semana</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
