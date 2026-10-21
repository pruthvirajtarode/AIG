import React from 'react';
import { Link } from 'react-router-dom';
import {
  ShoppingCart, CreditCard, Dog, Truck, Award,
  TrendingUp, TrendingDown, AlertTriangle, Clock, CheckCircle2, Users,
  ArrowUpRight, Activity,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell,
} from 'recharts';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { usePageTitle } from '@/hooks/usePageTitle';

// ── Mock data ────────────────────────────────────────────────
const REVENUE_DATA = [
  { month: 'May', revenue: 48000 },
  { month: 'Jun', revenue: 52000 },
  { month: 'Jul', revenue: 61000 },
  { month: 'Aug', revenue: 75000 },
  { month: 'Sep', revenue: 68000 },
  { month: 'Oct', revenue: 91000 },
];

const ORDER_DIST = [
  { name: 'Confirmed', value: 42, color: '#3b82f6' },
  { name: 'In Progress', value: 28, color: '#a855f7' },
  { name: 'Completed', value: 67, color: '#22c55e' },
  { name: 'Pending', value: 19, color: '#eab308' },
];

const DAILY_ORDERS = [
  { day: 'Mon', orders: 12 },
  { day: 'Tue', orders: 19 },
  { day: 'Wed', orders: 8 },
  { day: 'Thu', orders: 25 },
  { day: 'Fri', orders: 31 },
  { day: 'Sat', orders: 17 },
  { day: 'Sun', orders: 6 },
];

const RECENT_ORDERS = [
  { ref: 'AIG-2025-000158', participant: 'Ahmad Rizal bin Yusof', programme: 'Cow Share — Somalia', amount: 'SGD 850', status: 'payment_verified' },
  { ref: 'AIG-2025-000157', participant: 'Nurul Ain binti Hassan', programme: 'Goat — Malaysia', amount: 'SGD 420', status: 'payment_submitted' },
  { ref: 'AIG-2025-000156', participant: 'Mohamad Faiz bin Ali', programme: 'Cow Share — Palestine', amount: 'SGD 950', status: 'animal_allocated' },
  { ref: 'AIG-2025-000155', participant: 'Siti Norzahra binti Md Zain', programme: 'Sheep — Turkey', amount: 'SGD 380', status: 'delivered' },
  { ref: 'AIG-2025-000154', participant: 'Zulkifli bin Othman', programme: 'Goat — Bangladesh', amount: 'SGD 390', status: 'completed' },
];

const EXCEPTIONS = [
  { severity: 'critical', title: 'Animal weight below minimum threshold', ref: 'A-2025-008', time: '18 min ago' },
  { severity: 'high', title: 'Payment bank slip unreadable', ref: 'PAY-2025-142', time: '1h ago' },
  { severity: 'medium', title: 'Delivery failed — recipient not home', ref: 'DEL-2025-039', time: '3h ago' },
];

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
  return (
    <div className="page-content animate-fadeInUp">
      {/* Header */}
      <div className="page-header page-header-row" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Al Ihsan Group · Qurban Season 2025</p>
        </div>
        <div className="page-header-actions" style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary btn-sm">
            <Activity size={14} />
            Live View
          </button>
          <button className="btn btn-primary btn-sm">
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
          value="156"
          delta="+12% this week"
          deltaPositive
        />
        <StatCard
          icon={CreditCard}
          iconBg="linear-gradient(135deg, #1e3a5f, #3b82f6)"
          label="Revenue Collected"
          value="SGD 91K"
          delta="+8.4% vs last month"
          deltaPositive
        />
        <StatCard
          icon={Dog}
          iconBg="linear-gradient(135deg, #3b1f5f, #a855f7)"
          label="Animals Allocated"
          value="98"
          subtitle="42 pending inspection"
        />
        <StatCard
          icon={Truck}
          iconBg="linear-gradient(135deg, #1a4a3a, #14b8a6)"
          label="Deliveries"
          value="67"
          delta="12 scheduled today"
          deltaPositive
        />
        <StatCard
          icon={Award}
          iconBg="linear-gradient(135deg, #3d2800, #d4a832)"
          label="Certificates"
          value="43"
          subtitle="14 pending generation"
        />
        <StatCard
          icon={AlertTriangle}
          iconBg="linear-gradient(135deg, #2d0d0d, #ef4444)"
          label="Open Exceptions"
          value="3"
          delta="1 critical"
          deltaPositive={false}
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
            <AreaChart data={REVENUE_DATA} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
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
            <span className="badge badge-red">3 open</span>
          </div>
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
              {RECENT_ORDERS.map((o, i) => (
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
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
