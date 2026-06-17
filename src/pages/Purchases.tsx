import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { formatCurrency, cn } from '../lib/utils';
import { Package, Search, Filter, IndianRupee } from 'lucide-react';
import { format } from 'date-fns';

type StatusFilter = 'all' | 'paid' | 'unpaid' | 'partial';

export default function Purchases() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Fetch all purchases with their supplier data
  const purchases = useLiveQuery(async () => {
    const allPurchases = await db.purchases.reverse().sortBy('purchase_date');
    const enriched = await Promise.all(
      allPurchases.map(async (p) => {
        const supplier = await db.suppliers.get(p.supplier_id);
        return { ...p, supplierName: supplier?.name || 'Unknown Supplier' };
      })
    );
    return enriched;
  }, []);

  const filteredPurchases = purchases?.filter(p => {
    // Text search
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      p.invoice_number.toLowerCase().includes(searchLower) ||
      p.supplierName.toLowerCase().includes(searchLower);

    // Status filter
    const matchesStatus = statusFilter === 'all' || p.payment_status === statusFilter;

    return matchesSearch && matchesStatus;
  }) || [];

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 pb-20">
      <header className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Package className="w-6 h-6" /> Purchase History
          </h1>
          <p className="text-gray-500">View all past stock inward bills</p>
        </div>
      </header>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by invoice number or supplier name..."
            className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex gap-2 items-center overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
          <Filter className="w-5 h-5 text-gray-400 shrink-0" />
          {(['all', 'paid', 'unpaid', 'partial'] as StatusFilter[]).map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap capitalize border transition-colors",
                statusFilter === status
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              )}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="space-y-4">
        {filteredPurchases.length === 0 ? (
          <div className="text-center py-12 text-gray-500 bg-white rounded-xl border border-gray-100">
            No purchases found matching your criteria.
          </div>
        ) : (
          filteredPurchases.map(purchase => (
            <div key={purchase.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:shadow-md">
              <div className="flex items-start gap-4">
                <div className="bg-brand-50 p-3 rounded-xl shrink-0">
                  <Package className="w-6 h-6 text-brand-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-gray-900 text-lg">Invoice #{purchase.invoice_number}</h3>
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wider",
                      purchase.payment_status === 'paid' && "bg-green-100 text-green-700",
                      purchase.payment_status === 'unpaid' && "bg-red-100 text-red-700",
                      purchase.payment_status === 'partial' && "bg-orange-100 text-orange-700"
                    )}>
                      {purchase.payment_status}
                    </span>
                  </div>
                  <div className="text-gray-600 font-medium">Supplier: {purchase.supplierName}</div>
                  <div className="text-sm text-gray-400 mt-1">
                    {format(new Date(purchase.purchase_date), 'dd MMM yyyy, hh:mm a')}
                  </div>
                </div>
              </div>

              <div className="flex flex-row md:flex-col justify-between items-end border-t md:border-t-0 pt-4 md:pt-0">
                <div className="text-left md:text-right">
                  <div className="text-sm text-gray-500 mb-0.5">Total Amount</div>
                  <div className="font-bold text-gray-900 text-xl flex items-center gap-1">
                    <IndianRupee className="w-4 h-4" /> {purchase.total_amount}
                  </div>
                </div>
                {purchase.due_amount > 0 && (
                  <div className="text-left md:text-right mt-1">
                    <div className="text-xs text-red-500 font-bold">Credit: {formatCurrency(purchase.due_amount)}</div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
