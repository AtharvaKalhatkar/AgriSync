import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { formatCurrency, cn } from '../lib/utils';
import { Users, Search, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Customers() {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'udhari'>('name');

  const customers = useLiveQuery(async () => {
    let results = await db.customers.toArray();

    if (search) {
      const lower = search.toLowerCase();
      results = results.filter(c => 
        c.name.toLowerCase().includes(lower) || 
        c.mobile.includes(lower)
      );
    }

    if (sortBy === 'name') {
      results.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      results.sort((a, b) => b.udhari_balance - a.udhari_balance);
    }

    return results;
  }, [search, sortBy]);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4 pb-20">
      <header className="flex justify-between items-center mb-2">
        <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
      </header>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search name or mobile..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none shadow-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select 
          value={sortBy} 
          onChange={e => setSortBy(e.target.value as 'name' | 'udhari')}
          className="bg-white border border-gray-300 rounded-xl px-3 py-2.5 shadow-sm text-sm font-medium outline-none focus:border-brand-500"
        >
          <option value="name">Sort by Name (A-Z)</option>
          <option value="udhari">Highest Udhari First</option>
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {customers?.length === 0 && (
          <div className="text-center py-10">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <div className="text-gray-500 font-medium">No customers found</div>
          </div>
        )}

        {customers?.map((customer, i) => (
          <Link 
            key={customer.id} 
            to={`/customers/${customer.id}`}
            className={cn(
              "flex items-center justify-between p-4 hover:bg-gray-50 active:bg-gray-100 transition-colors block",
              i !== customers.length - 1 ? "border-b border-gray-100" : ""
            )}
          >
            <div>
              <div className="font-semibold text-gray-900 text-lg">{customer.name}</div>
              <div className="text-sm text-gray-500">{customer.mobile}</div>
            </div>
            <div className={cn(
              "font-bold text-lg",
              customer.udhari_balance > 0 ? "text-udhari-600" : "text-gray-400"
            )}>
              {customer.udhari_balance > 0 ? formatCurrency(customer.udhari_balance) : 'Settled'}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
