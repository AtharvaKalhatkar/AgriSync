import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Customer, type Medicine } from '../db/db';
import { formatCurrency, cn } from '../lib/utils';
import { Search, Plus, Trash2, IndianRupee, CheckCircle2 } from 'lucide-react';
import { queueSyncItem, queueSyncItems } from '../lib/sync';

interface BillItemDraft {
  id: string; // temp id
  medicine: Medicine;
  quantity: number;
  rate: number;
  gst_percentage?: number;
}

export default function NewBill() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1: Customer, 2: Items, 3: Payment
  
  // Draft State
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [items, setItems] = useState<BillItemDraft[]>([]);
  
  // Search States
  const [customerSearch, setCustomerSearch] = useState('');
  const [medicineSearch, setMedicineSearch] = useState('');
  
  // Data
  const customers = useLiveQuery(() => db.customers.toArray()) || [];
  const medicines = useLiveQuery(() => db.medicines.toArray()) || [];

  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return customers.filter(c => c.is_active).slice(0, 10);
    const lower = customerSearch.toLowerCase();
    return customers.filter(c => 
      (c.name.toLowerCase().includes(lower) || c.mobile.includes(lower)) && c.is_active
    ).slice(0, 10);
  }, [customerSearch, customers]);

  const filteredMedicines = useMemo(() => {
    if (!medicineSearch) return medicines.filter(m => m.is_active).slice(0, 10);
    const lower = medicineSearch.toLowerCase();
    return medicines.filter(m => m.name.toLowerCase().includes(lower) && m.is_active).slice(0, 10);
  }, [medicineSearch, medicines]);

  const totalAmount = items.reduce((acc, item) => acc + (item.quantity * item.rate), 0);

  // New Customer State
  const [newCustName, setNewCustName] = useState('');
  const [newCustMobile, setNewCustMobile] = useState('');

  // New Medicine State
  const [newMedName, setNewMedName] = useState('');
  const [newMedCategory, setNewMedCategory] = useState('pesticide');
  const [newMedUnit, setNewMedUnit] = useState('litre');
  const [newMedRate, setNewMedRate] = useState('');
  const [newMedCost, setNewMedCost] = useState('');

  const handleCreateCustomer = async () => {
    if (!newCustName || !newCustMobile) return;
    const newCustomer: Customer = {
      id: uuidv4(),
      name: newCustName,
      mobile: newCustMobile,
      udhari_balance: 0,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await db.customers.add(newCustomer);
    await queueSyncItem('customers', newCustomer.id, 'insert', newCustomer);
    setSelectedCustomer(newCustomer);
    setStep(2);
  };

  const handleCreateMedicine = async () => {
    if (!newMedName || !newMedRate) return;
    const newMedicine: Medicine = {
      id: uuidv4(),
      name: newMedName,
      category: newMedCategory,
      unit: newMedUnit,
      rate: Number(newMedRate),
      purchase_price: newMedCost ? Number(newMedCost) : undefined,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await db.medicines.add(newMedicine);
    await queueSyncItem('medicines', newMedicine.id, 'insert', newMedicine);
    addItem(newMedicine);
    setMedicineSearch('');
    setNewMedName('');
    setNewMedRate('');
    setNewMedCost('');
  };

  const addItem = (med: Medicine) => {
    setItems([...items, { id: uuidv4(), medicine: med, quantity: 1, rate: med.rate, gst_percentage: med.gst_percentage }]);
    setMedicineSearch('');
  };

  const updateItemQty = (id: string, qty: string) => {
    setItems(items.map(item => item.id === id ? { ...item, quantity: Number(qty) } : item));
  };

  const updateItemRate = (id: string, rate: string) => {
    setItems(items.map(item => item.id === id ? { ...item, rate: Number(rate) } : item));
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  // Payment State
  const [paymentMode, setPaymentMode] = useState<'cash' | 'online' | 'udhari' | 'split'>('cash');
  const [splitPaid, setSplitPaid] = useState<string>('');

  const handleSaveBill = async () => {
    if (!selectedCustomer || items.length === 0) return;

    const now = new Date().toISOString();
    const billId = uuidv4();
    const billNumber = `AGS-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(Math.random()*1000).toString().padStart(3,'0')}`;
    
    let paidAmount = 0;
    let dueAmount = 0;
    let finalStatus: 'paid' | 'partial' | 'unpaid' = 'paid';

    if (paymentMode === 'cash' || paymentMode === 'online') {
      paidAmount = totalAmount;
      dueAmount = 0;
      finalStatus = 'paid';
    } else if (paymentMode === 'udhari') {
      paidAmount = 0;
      dueAmount = totalAmount;
      finalStatus = 'unpaid';
    } else if (paymentMode === 'split') {
      paidAmount = Number(splitPaid);
      dueAmount = totalAmount - paidAmount;
      finalStatus = dueAmount > 0 ? 'partial' : 'paid';
    }

    const newBill = {
      id: billId,
      bill_number: billNumber,
      customer_id: selectedCustomer.id,
      bill_date: now,
      total_amount: totalAmount,
      paid_amount: paidAmount,
      due_amount: dueAmount,
      payment_status: finalStatus,
      created_at: now,
      updated_at: now,
    };

    const newBillItems = items.map(item => ({
      id: uuidv4(),
      bill_id: billId,
      medicine_id: item.medicine.id,
      medicine_name_snapshot: item.medicine.name,
      rate_at_sale: item.rate,
      purchase_price_at_sale: item.medicine.purchase_price || 0,
      gst_percentage: item.gst_percentage || 0,
      quantity: item.quantity,
      item_total: item.quantity * item.rate,
    }));

    await db.transaction('rw', [db.bills, db.billItems, db.payments, db.syncQueue, db.medicines, db.customers], async () => {
      await db.bills.add(newBill);
      await db.billItems.bulkAdd(newBillItems);
      
      const qItems: any[] = [
        { tableName: 'bills', recordId: newBill.id, operation: 'insert', payload: newBill },
        ...newBillItems.map(item => ({ tableName: 'bill_items', recordId: item.id, operation: 'insert', payload: item }))
      ];
      
      for (const item of items) {
        if (item.medicine.stock_qty !== undefined) {
          const newQty = Math.max(0, item.medicine.stock_qty - item.quantity);
          await db.medicines.update(item.medicine.id, { stock_qty: newQty, updated_at: now });
          qItems.push({ 
            tableName: 'medicines', 
            recordId: item.medicine.id, 
            operation: 'update' as const, 
            payload: { ...item.medicine, stock_qty: newQty, updated_at: now } 
          });
        }
      }
      
      if (paidAmount > 0) {
        const payment = {
          id: uuidv4(),
          customer_id: selectedCustomer.id,
          bill_id: billId,
          amount: paidAmount,
          mode: paymentMode === 'split' ? 'cash' : paymentMode as 'cash' | 'online',
          payment_date: now,
          created_at: now,
        };
        await db.payments.add(payment);
        qItems.push({ tableName: 'payments', recordId: payment.id, operation: 'insert' as const, payload: payment });
      }

      if (dueAmount > 0) {
        const newBalance = selectedCustomer.udhari_balance + dueAmount;
        await db.customers.update(selectedCustomer.id, { udhari_balance: newBalance, updated_at: now });
        qItems.push({ 
          tableName: 'customers', 
          recordId: selectedCustomer.id, 
          operation: 'update' as const, 
          payload: { ...selectedCustomer, udhari_balance: newBalance, updated_at: now } 
        });
      }

      await queueSyncItems(qItems);
    });

    navigate('/bills');
  };

  return (
    <div className="flex flex-col min-h-full bg-gray-50 pb-20">
      <header className="bg-white border-b px-4 py-3 flex items-center shadow-sm z-10 sticky top-0">
        <h1 className="text-xl font-bold">New Bill</h1>
        {totalAmount > 0 && (
          <div className="ml-auto font-bold text-brand-600 bg-brand-50 px-3 py-1 rounded-full">
            {formatCurrency(totalAmount)}
          </div>
        )}
      </header>

      <div className="p-4 max-w-lg mx-auto w-full space-y-6">
        {/* STEP 1: CUSTOMER */}
        {step === 1 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Customer</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Search name or mobile..."
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all shadow-sm text-lg"
                  value={customerSearch}
                  onChange={(e) => { setCustomerSearch(e.target.value); setNewCustName(e.target.value); }}
                />
              </div>
            </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {filteredCustomers.map(c => (
                  <button
                    key={c.id}
                    onClick={() => { setSelectedCustomer(c); setStep(2); }}
                    className="w-full text-left p-4 border-b last:border-b-0 hover:bg-gray-50 flex justify-between items-center transition-colors"
                  >
                    <div>
                      <div className="font-semibold text-gray-900">{c.name}</div>
                      <div className="text-sm text-gray-500">{c.mobile}</div>
                    </div>
                    {c.udhari_balance > 0 && (
                      <div className="text-sm font-medium text-udhari-600 bg-udhari-50 px-2 py-1 rounded-md">
                        Owes: {formatCurrency(c.udhari_balance)}
                      </div>
                    )}
                  </button>
                ))}
                
                {filteredCustomers.length === 0 && customerSearch && (
                  <div className="p-4 bg-gray-50 space-y-3">
                    <div className="text-sm text-gray-500 font-medium pb-2 border-b">Create New Customer</div>
                    <input
                      type="text"
                      placeholder="Name"
                      className="w-full p-3 border rounded-lg"
                      value={newCustName}
                      onChange={e => setNewCustName(e.target.value)}
                    />
                    <input
                      type="tel"
                      placeholder="Mobile Number"
                      className="w-full p-3 border rounded-lg"
                      value={newCustMobile}
                      onChange={e => setNewCustMobile(e.target.value)}
                    />
                    <button
                      onClick={handleCreateCustomer}
                      disabled={!newCustName || !newCustMobile}
                      className="w-full bg-brand-600 text-white py-3 rounded-lg font-medium disabled:opacity-50"
                    >
                      Save & Continue
                    </button>
                  </div>
                )}
              </div>
          </div>
        )}

        {/* STEP 2: ITEMS */}
        {step >= 2 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            {step === 2 && (
              <div className="flex flex-col">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex justify-between items-center mb-6">
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Customer</div>
                    <div className="font-bold text-gray-900 text-lg">{selectedCustomer?.name}</div>
                  </div>
                  <button onClick={() => setStep(1)} className="text-brand-600 text-sm font-medium hover:underline">Change</button>
                </div>

                {/* Added Items List (Cart) at the Top */}
                {items.length > 0 && (
                  <div className="space-y-3 mb-8">
                    <div className="flex justify-between items-end px-1">
                      <h3 className="font-bold text-gray-900">Cart ({items.length})</h3>
                      <div className="text-sm font-bold text-brand-600">{formatCurrency(totalAmount)}</div>
                    </div>
                    {items.map(item => (
                      <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 relative animate-in fade-in zoom-in-95 duration-200">
                        <button 
                          onClick={() => removeItem(item.id)}
                          className="absolute -top-2 -right-2 bg-red-100 text-red-600 p-1.5 rounded-full hover:bg-red-200 shadow-sm"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <div className="font-bold text-gray-900 mb-2 pr-6">
                          {item.medicine.name}
                          {item.gst_percentage ? <span className="ml-2 text-xs font-normal text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">+{item.gst_percentage}% GST</span> : null}
                        </div>
                        <div className="flex gap-3">
                          <div className="w-1/3">
                            <label className="text-xs text-gray-500 font-medium block mb-1">Qty</label>
                            <input 
                              type="number" 
                              min="0.1"
                              step="any"
                              className="w-full p-2.5 border border-gray-300 rounded-lg text-center font-bold focus:ring-2 focus:ring-brand-500 outline-none"
                              value={item.quantity || ''}
                              onChange={e => updateItemQty(item.id, e.target.value)}
                            />
                          </div>
                          <div className="w-1/3">
                            <label className="text-xs text-gray-500 font-medium block mb-1">Rate (₹)</label>
                            <input 
                              type="number" 
                              className="w-full p-2.5 border border-gray-300 rounded-lg text-center font-bold focus:ring-2 focus:ring-brand-500 outline-none"
                              value={item.rate || ''}
                              onChange={e => updateItemRate(item.id, e.target.value)}
                            />
                          </div>
                          <div className="w-1/3">
                            <label className="text-xs text-gray-500 font-medium block mb-1">Total</label>
                            <div className="p-2.5 bg-gray-50 border border-gray-100 rounded-lg text-center font-bold text-gray-900">
                              ₹{(item.quantity * item.rate) || 0}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Search & Add Products */}
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-6">
                  <h3 className="font-bold text-gray-900 mb-3">Add Products</h3>
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      placeholder="Search medicine..."
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-base bg-gray-50"
                      value={medicineSearch}
                      onChange={(e) => { setMedicineSearch(e.target.value); setNewMedName(e.target.value); }}
                    />
                  </div>

                  <div className="rounded-xl border border-gray-100 overflow-hidden max-h-64 overflow-y-auto">
                    {filteredMedicines.map(m => (
                      <button
                        key={m.id}
                        onClick={() => {
                          addItem(m);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="w-full text-left p-3 border-b border-gray-100 last:border-b-0 hover:bg-brand-50 flex justify-between items-center transition-colors"
                      >
                        <div>
                          <div className="font-semibold text-gray-900">{m.name}</div>
                          <div className="text-xs text-gray-500">
                            {m.category} • {m.unit} {m.net_weight ? `• ${m.net_weight}` : ''}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="font-bold text-gray-900 text-sm">
                              {formatCurrency(m.rate)}
                            </div>
                            {m.gst_percentage ? <div className="text-[10px] text-gray-500">{m.gst_percentage}% GST</div> : null}
                          </div>
                          <div className="bg-brand-100 text-brand-700 p-1.5 rounded-lg">
                            <Plus className="w-4 h-4" />
                          </div>
                        </div>
                      </button>
                    ))}

                    {filteredMedicines.length === 0 && medicineSearch && (
                      <div className="p-4 bg-gray-50 space-y-3">
                          <div className="text-sm text-gray-500 font-medium pb-2 border-b">Add New Medicine</div>
                          <input
                            type="text"
                            placeholder="Name"
                            className="w-full p-3 border rounded-lg"
                            value={newMedName}
                            onChange={e => setNewMedName(e.target.value)}
                          />
                          <div className="flex gap-2">
                            <select 
                              className="w-1/2 p-3 border rounded-lg bg-white"
                              value={newMedCategory}
                              onChange={e => setNewMedCategory(e.target.value)}
                            >
                              <option value="pesticide">Pesticide</option>
                              <option value="fertilizer">Fertilizer</option>
                              <option value="seed">Seed</option>
                              <option value="other">Other</option>
                            </select>
                            <select 
                              className="w-1/2 p-3 border rounded-lg bg-white"
                              value={newMedUnit}
                              onChange={e => setNewMedUnit(e.target.value)}
                            >
                              <option value="litre">Litre</option>
                              <option value="kg">KG</option>
                              <option value="packet">Packet</option>
                              <option value="bottle">Bottle</option>
                            </select>
                          </div>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              placeholder="Sale Rate (₹)"
                              className="w-1/2 p-3 border rounded-lg"
                              value={newMedRate}
                              onChange={e => setNewMedRate(e.target.value)}
                            />
                            <input
                              type="number"
                              placeholder="Cost (₹)"
                              className="w-1/2 p-3 border rounded-lg"
                              value={newMedCost}
                              onChange={e => setNewMedCost(e.target.value)}
                            />
                          </div>
                          <button
                            onClick={handleCreateMedicine}
                            disabled={!newMedName || !newMedRate}
                            className="w-full bg-brand-600 text-white py-3 rounded-lg font-medium disabled:opacity-50"
                          >
                            Save & Add to Bill
                          </button>
                        </div>
                      )}
                  </div>
                </div>

                {/* Proceed Button */}
                {items.length > 0 && (
                  <button 
                    onClick={() => setStep(3)}
                    className="w-full bg-gray-900 text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-xl sticky bottom-4 z-20"
                  >
                    Proceed to Payment <IndianRupee className="w-5 h-5" />
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* STEP 3: PAYMENT */}
        {step === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 text-center">
              <div className="text-sm text-gray-500 font-medium mb-1">Total Amount</div>
              <div className="text-4xl font-bold text-gray-900">{formatCurrency(totalAmount)}</div>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 px-1 mb-3">Payment Mode</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'cash', label: 'Cash (Full)' },
                  { id: 'online', label: 'Online (Full)' },
                  { id: 'udhari', label: 'Udhari (Full)' },
                  { id: 'split', label: 'Split / Partial' },
                ].map(mode => (
                  <button
                    key={mode.id}
                    onClick={() => setPaymentMode(mode.id as any)}
                    className={cn(
                      "p-4 rounded-xl border-2 font-medium text-center transition-all",
                      paymentMode === mode.id 
                        ? "border-brand-500 bg-brand-50 text-brand-700" 
                        : "border-gray-200 bg-white text-gray-600 hover:border-brand-200"
                    )}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            {paymentMode === 'split' && (
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-4 animate-in fade-in">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount Paid Now (₹)</label>
                  <input
                    type="number"
                    autoFocus
                    className="w-full p-3 border border-gray-300 rounded-lg text-lg font-bold"
                    value={splitPaid}
                    onChange={e => setSplitPaid(e.target.value)}
                  />
                </div>
                <div className="flex justify-between items-center p-3 bg-udhari-50 text-udhari-700 rounded-lg font-medium">
                  <span>Remaining Udhari:</span>
                  <span>{formatCurrency(totalAmount - Number(splitPaid))}</span>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button 
                onClick={() => setStep(2)}
                className="w-1/3 py-4 rounded-xl font-medium text-gray-600 bg-gray-200 hover:bg-gray-300 transition-colors"
              >
                Back
              </button>
              <button 
                onClick={handleSaveBill}
                disabled={paymentMode === 'split' && (!splitPaid || Number(splitPaid) > totalAmount || Number(splitPaid) < 0)}
                className="w-2/3 bg-brand-600 text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg shadow-brand-500/30 disabled:opacity-50"
              >
                <CheckCircle2 className="w-5 h-5" /> Save Bill
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
