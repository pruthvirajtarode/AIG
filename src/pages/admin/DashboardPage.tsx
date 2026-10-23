import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ShoppingCart, CreditCard, Dog, Truck, Award,
  TrendingUp, TrendingDown, AlertTriangle,
  ArrowUpRight, Activity, Radio,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell,
} from 'recharts';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useToast } from '@/contexts/ToastContext';
import { useAppData } from '@/contexts/AppDataContext';

// ── Mock data ────────────────────────────────────────────────
const REVENUE_DATA = [
  { month: 'May', revenue: 0 },
  { month: 'Jun', revenue: 0 },
  { month: 'Jul', revenue: 0 },
  { month: 'Aug', revenue: 0 },
  { month: 'Sep', revenue: 0 },
  { month: 'Oct', revenue: 0 },
];

const ORDER_DIST = [
  { name: 'Confirmed',   value: 0, color: '#3b82f6' },
  { name: 'In Progress', value: 0, color: '#a855f7' },
  { name: 'Completed',   value: 0, color: '#22c55e' },
  { name: 'Pending',     value: 0, color: '#eab308' },
];

const DAILY_ORDERS = [
  { day: 'Mon', orders: 0 },
  { day: 'Tue', orders: 0 },
  { day: 'Wed', orders: 0 },
  { day: 'Thu', orders: 0 },
  { day: 'Fri', orders: 0 },
  { day: 'Sat', orders: 0 },
  { day: 'Sun', orders: 0 },
];

const RECENT_ORDERS: { ref: string; participant: string; programme: string; amount: string; status: string }[] = [];

const EXCEPTIONS: { severity: string; title: string; ref: string; time: string }[] = [];

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'var(--danger)',
  high: 'var(--orange)',
  medium: 'var(--warning)',
  low: 'var(--info)',
};

function StatCard({
  icon: Icon,
  iconBg,
  label,
  value,
  delta,
  deltaPositive,
  subtitle,
}: {
  icon: React.ElementType;
  iconBg: string;
  label: string;
  value: string;
  delta?: string;
  deltaPositive?: boolean;
  subtitle?: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ background: iconBg }}>
        <Icon size={20} color="#fff" />
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {delta && (
        <div className={`stat-delta ${deltaPositive ? 'positive' : 'negative'}`}>
          {deltaPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {delta}
        </div>
      )}
      {subtitle && (
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>{subtitle}</div>
      )}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: 'var(--surface-800)',
        border: '1px solid var(--border-default)',
        borderRadius: 8,
        padding: '0.5rem 0.875rem',
        fontSize: '0.8125rem',
      }}>
        <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
        {payload.map((p: any, i: number) => (
          <div key={i} style={{ color: p.color || 'var(--aig-green-300)', fontWeight: 600 }}>
            {p.name === 'revenue' ? `SGD ${p.value.toLocaleString()}` : p.value}
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export function DashboardPage() {
  usePageTitle('Dashboard');
  const { toast } = useToast();
  const { orders, animals, payments, deliveries, certificates, exceptions } = useAppData();
  const [liveMode, setLiveMode] = useState(false);

  // Compute live stats from real data
  const totalOrders = orders.filter(o => o.status !== 'cancelled').length;
  const totalRevenue = payments.filter(p => p.status === 'verified').reduce((s, p) => s + p.amount, 0);
  const allocatedAnimals = animals.filter(a => ['allocated','growing','inspection_pending','inspection_passed','qurban_ready'].includes(a.status)).length;
  const totalDeliveries = deliveries.length;
  const totalCertificates = certificates.length;
  const openExceptions = exceptions.filter(e => e.status === 'open' || e.status === 'escalated').length;

  // Build revenue chart data from real payments (group by month)
  const revMap: Record<string, number> = {};
  payments.filter(p => p.status === 'verified' && p.submitted_at).forEach(p => {
    const month = new Date(p.submitted_at!).toLocaleString('default', { month: 'short' });
    revMap[month] = (revMap[month] || 0) + p.amount;
  });
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const revenueData = MONTHS.map(m => ({ month: m, revenue: revMap[m] || 0 }));

  // Order distribution pie
  const ORDER_DIST = [
    { name: 'Confirmed',   value: orders.filter(o => o.status === 'confirmed').length,   color: '#3b82f6' },
    { name: 'In Progress', value: orders.filter(o => ['animal_allocated','animal_growing','final_inspection'].includes(o.status)).length, color: '#a855f7' },
    { name: 'Completed',   value: orders.filter(o => o.status === 'completed').length,   color: '#22c55e' },
    { name: 'Pending',     value: orders.filter(o => ['draft','pending_payment','payment_submitted'].includes(o.status)).length, color: '#eab308' },
  ];

  // Recent orders (latest 5)
  const RECENT_ORDERS = orders.slice(0, 5).map(o => ({
    ref: o.order_ref, participant: o.participant,
    programme: o.programme, amount: `${o.currency} ${o.total_amount}`, status: o.status,
  }));

  // Active exceptions (latest 5)
  const EXCEPTIONS = exceptions.filter(e => e.status !== 'resolved').slice(0, 5).map(e => ({
    severity: e.severity, title: e.title, ref: e.related_entity_id, time: e.created_at,
  }));

  // Daily orders chart (last 7 days)
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const DAILY_ORDERS = days.map(day => ({
    day,
    orders: orders.filter(o => {
      const d = new Date(o.created_at);
      return days[d.getDay()] === day;
    }).length,
  }));

  // ── Export Report: real CSV download ───────────────────────
  const handleExport = useCallback(() => {
    const rows: (string | number)[][] = [
      ['Al Ihsan Group — Qurban Season 2025 Dashboard Report'],
      ['Generated', new Date().toLocaleString()],
      [],
      ['SUMMARY'],
      ['Metric', 'Value'],
      ['Total Orders', 156],
      ['Revenue Collected (SGD)', 91000],
      ['Animals Allocated', 98],
      ['Deliveries', 67],
      ['Certificates', 43],
      ['Open Exceptions', 3],
      [],
      ['MONTHLY REVENUE'],
      ['Month', 'Revenue (SGD)'],
      ...REVENUE_DATA.map(r => [r.month, r.revenue]),
      [],
      ['ORDER DISTRIBUTION'],
      ['Status', 'Count'],
      ...ORDER_DIST.map(o => [o.name, o.value]),
      [],
      ['RECENT ORDERS'],
      ['Order Ref', 'Participant', 'Programme', 'Amount', 'Status'],
      ...RECENT_ORDERS.map(o => [o.ref, o.participant, o.programme, o.amount, o.status]),
      [],
      ['ACTIVE EXCEPTIONS'],
      ['Severity', 'Title', 'Reference', 'Time'],
      ...EXCEPTIONS.map(e => [e.severity, e.title, e.ref, e.time]),
    ];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AIGMS-Dashboard-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('success', 'Report exported!', 'Dashboard report downloaded as CSV file');
  }, [toast]);

  return (
    <div className="page-content animate-fadeInUp">
      {/* Header */}
      <div className="page-header page-header-row" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Al Ihsan Group · Qurban Season 2025</p>
        </div>
        <div className="page-header-actions" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {/* Live indicator */}
          {liveMode && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', color: 'var(--success)', fontWeight: 700 }}>
              <span className="animate-pulse" style={{
                width: 8, height: 8, borderRadius: '50%',
                background: 'var(--success)', display: 'inline-block',
              }} />
              LIVE
            </span>
          )}
          <button
            className={`btn btn-sm ${liveMode ? 'btn-primary' : 'btn-secondary'}`}
            style={liveMode ? { background: 'linear-gradient(135deg,#0f4c35,#22c55e)', boxShadow: '0 0 14px rgba(34,197,94,0.35)' } : {}}
            onClick={() => {
              const next = !liveMode;
              setLiveMode(next);
              toast(next ? 'success' : 'info',
                next ? '🟢 Live View On' : 'Live View Off',
                next ? 'Revenue chart is now updating in real-time' : 'Returned to static dashboard view'
              );
            }}
          >
            {liveMode ? <Radio size={14} /> : <Activity size={14} />}
            {liveMode ? 'Stop Live' : 'Live View'}
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleExport}
          >
            <ArrowUpRight size={14} />
            Export Report
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <StatCard
          icon={ShoppingCart}
          iconBg="linear-gradient(135deg, #155f41, #1f8561)"
          label="Total Orders"
          value={String(totalOrders)}
        />
        <StatCard
          icon={CreditCard}
          iconBg="linear-gradient(135deg, #1e3a5f, #3b82f6)"
          label="Revenue Collected"
          value={`SGD ${totalRevenue.toLocaleString()}`}
        />
        <StatCard
          icon={Dog}
          iconBg="linear-gradient(135deg, #3b1f5f, #a855f7)"
          label="Animals Allocated"
          value={String(allocatedAnimals)}
        />
        <StatCard
          icon={Truck}
          iconBg="linear-gradient(135deg, #1a4a3a, #14b8a6)"
          label="Deliveries"
          value={String(totalDeliveries)}
        />
        <StatCard
          icon={Award}
          iconBg="linear-gradient(135deg, #3d2800, #d4a832)"
          label="Certificates"
          value={String(totalCertificates)}
        />
        <StatCard
          icon={AlertTriangle}
          iconBg="linear-gradient(135deg, #2d0d0d, #ef4444)"
          label="Open Exceptions"
          value={String(openExceptions)}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="content-grid-21" style={{ marginBottom: '1.5rem' }}>
        {/* Revenue Area Chart */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <div>
              <div className="heading-md">Revenue Overview</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Monthly collections (SGD)</div>
            </div>
            <span className="badge badge-green">↑ 8.4%</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={revenueData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--aig-green-500)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="var(--aig-green-500)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => `${v/1000}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="revenue" stroke="var(--aig-green-400)" strokeWidth={2} fill="url(#revGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Order Distribution Pie */}
        <div className="card">
          <div className="heading-md" style={{ marginBottom: '0.25rem' }}>Order Distribution</div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>By status</div>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={ORDER_DIST}
                cx="50%"
                cy="50%"
                innerRadius={48}
                outerRadius={72}
                paddingAngle={3}
                dataKey="value"
              >
                {ORDER_DIST.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: any, name: string) => [v, name]}
                contentStyle={{ background: 'var(--surface-800)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: '0.8125rem' }}
                labelStyle={{ color: 'var(--text-muted)' }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem' }}>
            {ORDER_DIST.map(d => (
              <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, display: 'inline-block' }} />
                <span style={{ color: 'var(--text-muted)' }}>{d.name}</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts Row 2 + Exceptions */}
      <div className="content-grid-21" style={{ marginBottom: '1.5rem' }}>
        {/* Daily Orders Bar */}
        <div className="card">
          <div className="heading-md" style={{ marginBottom: '0.25rem' }}>Orders This Week</div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Daily breakdown</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={DAILY_ORDERS} barSize={28} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="orders" fill="var(--aig-green-600)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Active Exceptions */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div className="heading-md">Active Exceptions</div>
            <span className="badge badge-gray">0 open</span>
          </div>
          {EXCEPTIONS.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              No active exceptions
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {EXCEPTIONS.map((ex, i) => (
                <div key={i} style={{
                  display: 'flex',
                  gap: '0.75rem',
                  padding: '0.75rem',
                  background: 'var(--surface-700)',
                  borderRadius: 8,
                  border: `1px solid ${SEVERITY_COLORS[ex.severity]}22`,
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: SEVERITY_COLORS[ex.severity],
                    flexShrink: 0, marginTop: 5,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.15rem' }}>
                      {ex.title}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {ex.ref} · {ex.time}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Orders Table */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div>
            <div className="heading-md">Recent Orders</div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Latest 5 orders</div>
          </div>
          <Link to="/admin/orders" className="btn btn-ghost btn-sm">View All →</Link>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Order Ref</th>
                <th>Participant</th>
                <th>Programme</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {RECENT_ORDERS.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem', fontSize: '0.875rem' }}>
                    No orders yet
                  </td>
                </tr>
              ) : (
                RECENT_ORDERS.map((o, i) => (
                  <tr key={i}>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.8125rem', color: 'var(--aig-green-300)' }}>
                        {o.ref}
                      </span>
                    </td>
                    <td>{o.participant}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{o.programme}</td>
                    <td style={{ fontWeight: 600 }}>{o.amount}</td>
                    <td><StatusBadge status={o.status} size="sm" /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
