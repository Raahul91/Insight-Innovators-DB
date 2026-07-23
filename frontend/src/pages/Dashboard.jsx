import { useEffect, useState } from "react";
import { fetchPortfolio } from "../lib/api";
import { fmtCurrency, fmtNumber, fmtPct } from "../lib/format";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { ArrowUpRight, ArrowDownRight, TrendingUp, Wallet, Activity, PieChart as PieIcon } from "lucide-react";

const COLORS = ["#0A2540", "#007AFF", "#34C759", "#F59E0B", "#8B5CF6"];

const StatCard = ({ label, value, delta, icon: Icon, testid, positive }) => (
  <div
    data-testid={testid}
    className="bg-white border border-[var(--border)] rounded-xl p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
  >
    <div className="flex items-center justify-between mb-4">
      <span className="text-xs tracking-[0.15em] uppercase text-[var(--text-secondary)]">{label}</span>
      <div className="h-8 w-8 rounded-lg bg-gray-50 border border-[var(--border)] flex items-center justify-center">
        <Icon size={16} className="text-[var(--primary)]" />
      </div>
    </div>
    <div className="font-display font-black text-3xl text-[var(--primary)] font-mono-num">{value}</div>
    {delta !== undefined && (
      <div
        className={`mt-2 text-sm font-medium flex items-center gap-1 ${
          positive ? "text-[var(--success)]" : "text-[var(--danger)]"
        }`}
      >
        {positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
        <span className="font-mono-num">{delta}</span>
      </div>
    )}
  </div>
);

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPortfolio()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <div className="p-10 text-[var(--text-secondary)]" data-testid="dashboard-loading">
        Loading portfolio…
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 space-y-8 fade-up" data-testid="dashboard-page">
      {/* Stat Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          testid="stat-networth"
          label="Net Worth"
          value={fmtCurrency(data.net_worth)}
          delta={`${fmtPct(data.day_change_pct)} today`}
          positive={data.day_change_pct >= 0}
          icon={Wallet}
        />
        <StatCard
          testid="stat-invested"
          label="Total Invested"
          value={fmtCurrency(data.total_invested)}
          icon={Activity}
        />
        <StatCard
          testid="stat-gain"
          label="Total Return"
          value={fmtCurrency(data.total_gain)}
          delta={fmtPct(data.total_gain_pct)}
          positive={data.total_gain_pct >= 0}
          icon={TrendingUp}
        />
        <StatCard
          testid="stat-day-change"
          label="Day Change"
          value={fmtCurrency(data.day_change)}
          delta={fmtPct(data.day_change_pct)}
          positive={data.day_change_pct >= 0}
          icon={PieIcon}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white border border-[var(--border)] rounded-xl p-6" data-testid="performance-chart-card">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="text-xs tracking-[0.15em] uppercase text-[var(--text-secondary)]">
                Portfolio Performance
              </div>
              <h3 className="font-display font-bold text-xl text-[var(--primary)]">
                12-month trajectory
              </h3>
            </div>
            <div className="text-xs px-3 py-1 rounded-full bg-[var(--success)]/10 text-[var(--success)] font-medium">
              {fmtPct(data.total_gain_pct)} YTD
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.performance}>
                <defs>
                  <linearGradient id="line-grad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#0A2540" />
                    <stop offset="100%" stopColor="#007AFF" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="month" stroke="#4B5563" fontSize={12} />
                <YAxis stroke="#4B5563" fontSize={12} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{
                    background: "#fff",
                    border: "1px solid #E5E7EB",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(v) => fmtCurrency(v)}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="url(#line-grad)"
                  strokeWidth={3}
                  dot={{ r: 3, fill: "#007AFF" }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-[var(--border)] rounded-xl p-6" data-testid="allocation-chart-card">
          <div className="text-xs tracking-[0.15em] uppercase text-[var(--text-secondary)]">Allocation</div>
          <h3 className="font-display font-bold text-xl text-[var(--primary)] mb-4">By asset class</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.allocation}
                  dataKey="value"
                  nameKey="category"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={2}
                >
                  {data.allocation.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => fmtCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 space-y-2">
            {data.allocation.map((a, i) => (
              <div key={a.category} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ background: COLORS[i % COLORS.length] }}
                  />
                  <span className="text-[var(--text-secondary)]">{a.category}</span>
                </div>
                <span className="font-mono-num text-[var(--primary)] font-medium">{fmtNumber(a.percentage)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Holdings Table */}
      <div className="bg-white border border-[var(--border)] rounded-xl overflow-hidden" data-testid="holdings-table-card">
        <div className="px-6 py-5 border-b border-[var(--border)] flex items-center justify-between">
          <div>
            <div className="text-xs tracking-[0.15em] uppercase text-[var(--text-secondary)]">Holdings</div>
            <h3 className="font-display font-bold text-xl text-[var(--primary)]">Portfolio positions</h3>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-[var(--text-secondary)]">
              <tr className="text-left">
                <th className="px-6 py-3 font-medium">Asset</th>
                <th className="px-6 py-3 font-medium">Category</th>
                <th className="px-6 py-3 font-medium text-right">Shares</th>
                <th className="px-6 py-3 font-medium text-right">Avg Cost</th>
                <th className="px-6 py-3 font-medium text-right">Price</th>
                <th className="px-6 py-3 font-medium text-right">Value</th>
                <th className="px-6 py-3 font-medium text-right">Day</th>
              </tr>
            </thead>
            <tbody>
              {data.holdings.map((h) => {
                const value = h.shares * h.current_price;
                const positive = h.day_change_pct >= 0;
                return (
                  <tr
                    key={h.ticker}
                    data-testid={`holding-row-${h.ticker}`}
                    className="border-t border-[var(--border)] hover:bg-gray-50/60 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="font-display font-bold text-[var(--primary)]">{h.ticker}</div>
                      <div className="text-xs text-[var(--text-secondary)]">{h.name}</div>
                    </td>
                    <td className="px-6 py-4 text-[var(--text-secondary)]">{h.category}</td>
                    <td className="px-6 py-4 text-right font-mono-num">{fmtNumber(h.shares, h.shares < 1 ? 4 : 2)}</td>
                    <td className="px-6 py-4 text-right font-mono-num text-[var(--text-secondary)]">
                      {fmtCurrency(h.avg_cost)}
                    </td>
                    <td className="px-6 py-4 text-right font-mono-num">{fmtCurrency(h.current_price)}</td>
                    <td className="px-6 py-4 text-right font-mono-num font-semibold">{fmtCurrency(value)}</td>
                    <td
                      className={`px-6 py-4 text-right font-mono-num font-medium ${
                        positive ? "text-[var(--success)]" : "text-[var(--danger)]"
                      }`}
                    >
                      {fmtPct(h.day_change_pct)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
