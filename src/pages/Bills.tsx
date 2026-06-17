import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { formatCurrency, cn } from '../lib/utils';
import { Receipt, Search, Filter, X } from 'lucide-react';
import { startOfDay, startOfWeek, startOfMonth, startOfYear, endOfDay, isWithinInterval } from 'date-fns';

type DateFilter = 'all' | 'today' | 'week' | 'month' | 'year';
type StatusFilter = 'all' | 'paid' | 'unpaid' | 'partial';

export default function Bills() {
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedBill, setSelectedBill] = useState<any>(null);

  const selectedBillItems = useLiveQuery(
    () => selectedBill ? db.billItems.where('bill_id').equals(selectedBill.id).toArray() : [],
    [selectedBill]
  );

  const bills = useLiveQuery(async () => {
    let q = db.bills.orderBy('bill_date').reverse();
    let results = await q.toArray();

    // Filters
    const now = new Date();
    
    if (dateFilter !== 'all') {
      let startDate = new Date();
      if (dateFilter === 'today') startDate = startOfDay(now);
      else if (dateFilter === 'week') startDate = startOfWeek(now);
      else if (dateFilter === 'month') startDate = startOfMonth(now);
      else if (dateFilter === 'year') startDate = startOfYear(now);
      
      results = results.filter(b => new Date(b.bill_date) >= startDate);
    }

    if (statusFilter !== 'all') {
      results = results.filter(b => b.payment_status === statusFilter);
    }

    // Attach Customer names (N+1 query is fine for Dexie local)
    let billsWithCustomers = await Promise.all(results.map(async b => {
      const c = await db.customers.get(b.customer_id);
      return { ...b, customer_name: c?.name || 'Unknown' };
    }));

    if (search) {
      const lowerSearch = search.toLowerCase();
      billsWithCustomers = billsWithCustomers.filter(b => 
        b.bill_number.toLowerCase().includes(lowerSearch) || 
        b.customer_name.toLowerCase().includes(lowerSearch)
      );
    }

    return billsWithCustomers;
  }, [dateFilter, statusFilter, search]);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4 pb-20">
      <header className="flex justify-between items-center mb-2">
        <h1 className="text-2xl font-bold text-gray-900">Bills</h1>
      </header>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search name or bill number..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none shadow-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <select 
            value={dateFilter} 
            onChange={e => setDateFilter(e.target.value as DateFilter)}
            className="bg-white border border-gray-300 rounded-xl px-3 py-2.5 shadow-sm text-sm font-medium outline-none focus:border-brand-500"
          >
            <option value="all">All Dates</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="year">This Year</option>
          </select>
          <select 
            value={statusFilter} 
            onChange={e => setStatusFilter(e.target.value as StatusFilter)}
            className="bg-white border border-gray-300 rounded-xl px-3 py-2.5 shadow-sm text-sm font-medium outline-none focus:border-brand-500"
          >
            <option value="all">All Statuses</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
            <option value="partial">Partial</option>
          </select>
        </div>
      </div>

      <div className="space-y-3">
        {bills?.length === 0 && (
          <div className="text-center py-10 bg-white rounded-xl border border-gray-200">
            <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <div className="text-gray-500 font-medium">No bills found</div>
          </div>
        )}

        {bills?.map(bill => (
          <div 
            key={bill.id} 
            onClick={() => setSelectedBill(bill)}
            className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between hover:bg-gray-50 cursor-pointer"
          >
            <div>
              <div className="font-semibold text-gray-900">{bill.customer_name}</div>
              <div className="text-sm text-gray-500 flex items-center gap-2">
                <span>{bill.bill_number}</span>
                <span>•</span>
                <span>{new Date(bill.bill_date).toLocaleDateString('en-IN')}</span>
              </div>
            </div>
            <div className="text-right flex flex-col items-end">
              <div className="font-bold text-gray-900">{formatCurrency(bill.total_amount)}</div>
              <div className={cn(
                "text-xs font-semibold px-2 py-0.5 rounded-full mt-1",
                bill.payment_status === 'paid' && "bg-settled-100 text-settled-700",
                bill.payment_status === 'unpaid' && "bg-udhari-100 text-udhari-700",
                bill.payment_status === 'partial' && "bg-yellow-100 text-yellow-700"
              )}>
                {bill.payment_status.toUpperCase()}
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedBill && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4 pb-0 sm:pb-4 animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-4">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Invoice Details</h2>
                <div className="text-sm text-gray-500">{selectedBill.bill_number}</div>
              </div>
              <button 
                onClick={() => setSelectedBill(null)}
                className="p-2 bg-gray-200 rounded-full hover:bg-gray-300 text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              <div className="flex justify-between items-center mb-2">
                <div>
                  <div className="text-xs text-gray-500 uppercase font-semibold">Customer</div>
                  <div className="font-bold text-gray-900">{selectedBill.customer_name}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500 uppercase font-semibold">Date</div>
                  <div className="font-medium text-gray-900">{new Date(selectedBill.bill_date).toLocaleDateString('en-IN')}</div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Item</th>
                      <th className="px-4 py-3 font-medium text-right">Qty</th>
                      <th className="px-4 py-3 font-medium text-right">Rate</th>
                      <th className="px-4 py-3 font-medium text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selectedBillItems?.map((item: any) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3 font-medium text-gray-900">{item.medicine_name_snapshot}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{item.quantity}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(item.rate_at_sale)}</td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(item.item_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-gray-50 p-4 rounded-xl space-y-2">
                <div className="flex justify-between text-gray-600">
                  <span>Total Amount</span>
                  <span className="font-bold text-gray-900">{formatCurrency(selectedBill.total_amount)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Paid Amount</span>
                  <span className="font-medium text-green-600">{formatCurrency(selectedBill.paid_amount)}</span>
                </div>
                {selectedBill.due_amount > 0 && (
                  <div className="flex justify-between text-udhari-700 pt-2 border-t border-gray-200">
                    <span className="font-bold">Udhari (Due)</span>
                    <span className="font-bold">{formatCurrency(selectedBill.due_amount)}</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-4 border-t">
              <button 
                onClick={() => setSelectedBill(null)}
                className="w-full py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800"
              >
                Close Invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
