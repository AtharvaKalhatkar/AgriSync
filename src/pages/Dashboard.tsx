import { useDashboardStats } from '../db/queries';
import { formatCurrency } from '../lib/utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Link } from 'react-router-dom';
import { TrendingUp, AlertCircle, Coins, ArrowUpRight } from 'lucide-react';

export default function Dashboard() {
  const stats = useDashboardStats();

  if (!stats) return <div className="p-4 flex justify-center items-center h-full">Loading...</div>;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6 pb-24">
      <header className="flex justify-between items-center mb-6">
        <div>
          <h1 
            className="text-4xl font-extrabold bg-gradient-to-r from-brand-600 via-indigo-500 to-purple-600 bg-clip-text text-transparent pb-1"
            style={{ fontFamily: "'Baloo 2', cursive" }}
          >
            {localStorage.getItem('agrisync_shop') || 'AgriSync Shop'}
          </h1>
          <p className="text-sm text-gray-500 font-medium">Dashboard Overview</p>
        </div>
      </header>

      {/* Main Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="col-span-2 bg-brand-600 rounded-2xl p-5 text-white shadow-lg shadow-brand-500/20">
          <div className="flex items-center space-x-2 opacity-80 mb-2">
            <TrendingUp className="w-5 h-5" />
            <span className="font-medium">Today's Sale</span>
          </div>
          <div className="text-3xl font-bold">{formatCurrency(stats.todaySale)}</div>
        </div>
        <div className="col-span-2 bg-udhari-500 rounded-2xl p-5 text-white shadow-lg shadow-udhari-500/20">
          <div className="flex items-center space-x-2 opacity-80 mb-2">
            <AlertCircle className="w-5 h-5" />
            <span className="font-medium">Total Udhari</span>
          </div>
          <div className="text-3xl font-bold">{formatCurrency(stats.totalOutstandingUdhari)}</div>
        </div>
      </div>

      {/* Profit Card */}
      <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-5 text-white shadow-lg shadow-green-500/30 flex justify-between items-center relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center space-x-2 opacity-90 mb-1">
            <Coins className="w-5 h-5" />
            <span className="font-semibold text-sm uppercase tracking-wider">Today's Net Profit</span>
          </div>
          <div className="text-3xl font-black">{formatCurrency(stats.todayProfit)}</div>
          {stats.todaySale > 0 && (
            <div className="text-sm font-medium opacity-90 mt-1 flex items-center gap-1">
              <ArrowUpRight className="w-4 h-4" /> 
              {((stats.todayProfit / stats.todaySale) * 100).toFixed(1)}% Margin
            </div>
          )}
        </div>
        <div className="absolute -right-6 -bottom-6 opacity-20">
          <Coins className="w-32 h-32" />
        </div>
      </div>

      {/* Breakdowns */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
          <div className="text-xs text-gray-500 font-medium mb-1">Cash</div>
          <div className="text-lg font-bold text-gray-900">{formatCurrency(stats.todayCash)}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
          <div className="text-xs text-gray-500 font-medium mb-1">Online</div>
          <div className="text-lg font-bold text-gray-900">{formatCurrency(stats.todayOnline)}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
          <div className="text-xs text-gray-500 font-medium mb-1">Udhari Given</div>
          <div className="text-lg font-bold text-udhari-600">{formatCurrency(stats.todayUdhariGiven)}</div>
        </div>
      </div>

      {/* Hishob Trend */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Hishob Trend (7 Days)</h2>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
              <Tooltip 
                cursor={{ fill: '#f3f4f6' }}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
              />
              <Bar dataKey="sales" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Udhari Customers */}
      {stats.topUdhariCustomers.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-4 px-1">Top Udhari Customers</h2>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {stats.topUdhariCustomers.map((customer, i) => (
              <Link 
                key={customer.id} 
                to={`/customers/${customer.id}`}
                className={cn(
                  "flex items-center justify-between p-4 hover:bg-gray-50 active:bg-gray-100 transition-colors",
                  i !== stats.topUdhariCustomers.length - 1 ? "border-b border-gray-100" : ""
                )}
              >
                <div>
                  <div className="font-semibold text-gray-900">{customer.name}</div>
                  <div className="text-sm text-gray-500">{customer.mobile}</div>
                </div>
                <div className="font-bold text-udhari-600">
                  {formatCurrency(customer.udhari_balance)}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function cn(...classes: (string | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
