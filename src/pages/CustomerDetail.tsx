import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { formatCurrency, cn } from '../lib/utils';
import { ArrowLeft, Phone, IndianRupee, Share2, Receipt } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { queueSyncItems } from '../lib/sync';

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const customer = useLiveQuery(() => db.customers.get(id!));
  
  const history = useLiveQuery(async () => {
    if (!id) return [];
    
    const bills = await db.bills.where('customer_id').equals(id).toArray();
    const payments = await db.payments.where('customer_id').equals(id).toArray();
    
    const combined = [
      ...bills.map(b => ({
        type: 'bill' as const,
        date: b.bill_date,
        amount: b.total_amount,
        ref: b.bill_number,
        rawDate: new Date(b.created_at).getTime()
      })),
      ...payments.map(p => ({
        type: 'payment' as const,
        date: p.payment_date,
        amount: p.amount,
        mode: p.mode,
        rawDate: new Date(p.created_at).getTime()
      }))
    ].sort((a, b) => a.rawDate - b.rawDate);

    // Calculate running balance
    let balance = 0;
    return combined.map(item => {
      if (item.type === 'bill') {
        balance += item.amount;
      } else {
        balance -= item.amount;
      }
      return { ...item, balance };
    }).reverse(); // Newest first
  }, [id]);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');

  const handleRecordPayment = async () => {
    if (!id || !customer || !paymentAmount) return;
    const amount = Number(paymentAmount);
    
    // Create payment record
    const payment = {
      id: uuidv4(),
      customer_id: id,
      amount,
      mode: 'udhari_settlement' as const,
      payment_date: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    // Update customer balance locally
    const newBalance = customer.udhari_balance - amount;

    // Distribute payment across unpaid bills (oldest first)
    const unpaidBillsRaw = await db.bills
      .where('customer_id').equals(id)
      .filter(b => b.payment_status !== 'paid')
      .toArray();
    const unpaidBills = unpaidBillsRaw.sort((a, b) => new Date(a.bill_date).getTime() - new Date(b.bill_date).getTime());

    let remainingToDistribute = amount;
    const billsToUpdate: any[] = [];

    for (const bill of unpaidBills) {
      if (remainingToDistribute <= 0) break;
      
      const payable = Math.min(bill.due_amount, remainingToDistribute);
      bill.paid_amount += payable;
      bill.due_amount -= payable;
      bill.payment_status = bill.due_amount === 0 ? 'paid' : 'partial';
      bill.updated_at = new Date().toISOString();
      
      remainingToDistribute -= payable;
      billsToUpdate.push(bill);
    }

    await db.transaction('rw', db.payments, db.customers, db.bills, db.syncQueue, async () => {
      await db.payments.add(payment);
      await db.customers.update(id, { udhari_balance: newBalance, updated_at: new Date().toISOString() });
      await db.bills.bulkPut(billsToUpdate);
      
      const qItems: any[] = [
        { tableName: 'payments', recordId: payment.id, operation: 'insert', payload: payment },
        { tableName: 'customers', recordId: id, operation: 'update', payload: { ...customer, udhari_balance: newBalance, updated_at: new Date().toISOString() } },
        ...billsToUpdate.map(b => ({ tableName: 'bills', recordId: b.id, operation: 'update', payload: b }))
      ];
      
      await queueSyncItems(qItems);
    });

    setShowPaymentModal(false);
    setPaymentAmount('');
  };

  const handleSendLink = async () => {
    if (!customer) return;
    const shopName = localStorage.getItem('agrisync_shop') || 'AgriSync Shop';
    
    // Format mobile number for WhatsApp (assuming Indian numbers)
    let cleanMobile = customer.mobile.replace(/\D/g, '');
    if (cleanMobile.length === 10) cleanMobile = '91' + cleanMobile;
    else if (cleanMobile.length > 10 && !cleanMobile.startsWith('91')) cleanMobile = '91' + cleanMobile;

    const vpa = localStorage.getItem('agrisync_vpa');
    
    let message = `Namaskar! Your outstanding udhari balance with *${shopName}* is *${formatCurrency(customer.udhari_balance)}*.\n\nPlease clear this balance as soon as possible.`;
    
    if (vpa) {
      const upiUrl = `upi://pay?pa=${vpa}&pn=${encodeURIComponent(shopName)}&am=${customer.udhari_balance.toFixed(2)}&cu=INR`;
      message += `\n\n*Payment Details:*\nUPI ID: ${vpa}\nPayment Link: ${upiUrl}`;
    }
    
    message += `\n\nThank you!`;

    const waUrl = `https://wa.me/${cleanMobile}?text=${encodeURIComponent(message)}`;
    
    window.open(waUrl, '_blank');
  };

  if (!customer) return null;

  return (
    <div className="flex flex-col min-h-full bg-gray-50 pb-20 relative">
      <header className="bg-white border-b px-4 py-3 flex items-center shadow-sm z-10 sticky top-0">
        <button onClick={() => navigate(-1)} className="mr-3 p-2 -ml-2 rounded-full hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold">{customer.name}</h1>
          <a href={`tel:${customer.mobile}`} className="text-sm text-brand-600 flex items-center gap-1">
            <Phone className="w-3 h-3" /> {customer.mobile}
          </a>
        </div>
      </header>

      <div className="p-4 max-w-lg mx-auto w-full space-y-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 text-center">
          <div className="text-sm text-gray-500 font-medium mb-1">Outstanding Balance</div>
          <div className={cn("text-4xl font-bold", customer.udhari_balance > 0 ? "text-udhari-600" : "text-settled-600")}>
            {formatCurrency(customer.udhari_balance)}
          </div>
          
          {customer.udhari_balance > 0 && (
            <div className="flex gap-3 mt-6">
              <button 
                onClick={() => setShowPaymentModal(true)}
                className="flex-1 bg-gray-900 text-white py-3 rounded-xl font-semibold flex justify-center items-center gap-2"
              >
                <IndianRupee className="w-4 h-4" /> Record Pay
              </button>
              <button 
                onClick={handleSendLink}
                className="flex-1 bg-green-50 border-2 border-green-500 text-green-700 py-3 rounded-xl font-bold flex justify-center items-center gap-2 hover:bg-green-100"
              >
                <Share2 className="w-4 h-4" /> WhatsApp
              </button>
            </div>
          )}
        </div>

        <div>
          <h2 className="font-bold text-gray-900 px-1 mb-3">Udhari History (Khata)</h2>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {history?.map((item, i) => (
              <div key={i} className="flex justify-between items-center p-4 border-b border-gray-100 last:border-0">
                <div className="flex gap-3 items-center">
                  <div className={cn(
                    "p-2 rounded-full",
                    item.type === 'bill' ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"
                  )}>
                    {item.type === 'bill' ? <Receipt className="w-4 h-4" /> : <IndianRupee className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">
                      {item.type === 'bill' ? `Bill ${item.ref}` : `Payment (${item.mode})`}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={cn(
                    "font-bold",
                    item.type === 'bill' ? "text-udhari-600" : "text-settled-600"
                  )}>
                    {item.type === 'bill' ? '+' : '-'}{formatCurrency(item.amount)}
                  </div>
                  <div className="text-xs font-medium text-gray-400">
                    Bal: {formatCurrency(item.balance)}
                  </div>
                </div>
              </div>
            ))}
            
            {history?.length === 0 && (
              <div className="p-6 text-center text-gray-500">No transaction history</div>
            )}
          </div>
        </div>
      </div>

      {showPaymentModal && (
        <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-t-3xl p-6 pb-12 animate-in slide-in-from-bottom-8">
            <h3 className="text-xl font-bold mb-4 text-center">Record Payment</h3>
            <div className="text-center text-sm text-gray-500 mb-6">
              Total Due: <span className="font-bold text-gray-900">{formatCurrency(customer.udhari_balance)}</span>
            </div>
            
            <input
              type="number"
              autoFocus
              placeholder="Amount Paid (₹)"
              className="w-full p-4 border-2 border-gray-200 rounded-xl text-center text-2xl font-bold mb-6 focus:border-brand-500 outline-none"
              value={paymentAmount}
              onChange={e => setPaymentAmount(e.target.value)}
            />
            
            <div className="flex gap-3">
              <button 
                onClick={() => setShowPaymentModal(false)}
                className="w-1/3 py-4 rounded-xl font-medium text-gray-600 bg-gray-100 hover:bg-gray-200"
              >
                Cancel
              </button>
              <button 
                onClick={handleRecordPayment}
                disabled={!paymentAmount || Number(paymentAmount) <= 0 || Number(paymentAmount) > customer.udhari_balance}
                className="w-2/3 bg-brand-600 text-white py-4 rounded-xl font-bold text-lg disabled:opacity-50 shadow-lg shadow-brand-500/30"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
