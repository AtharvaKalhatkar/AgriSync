import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Supplier, type Medicine } from '../db/db';
import { formatCurrency, cn } from '../lib/utils';
import { Search, Plus, Trash2, IndianRupee, CheckCircle2 } from 'lucide-react';
import { queueSyncItem, queueSyncItems } from '../lib/sync';

interface PurchaseItemDraft {
  id: string; // temp id
  medicine: Medicine;
  quantity: number;
  rate: number;
}

export default function NewPurchase() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1: Supplier, 2: Items, 3: Payment
  
  // Draft State
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [items, setItems] = useState<PurchaseItemDraft[]>([]);
  
  // Search States
  const [supplierSearch, setSupplierSearch] = useState('');
  const [medicineSearch, setMedicineSearch] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  
  // Data
  const suppliers = useLiveQuery(() => db.suppliers.toArray()) || [];
  const medicines = useLiveQuery(() => db.medicines.toArray()) || [];

  const filteredSuppliers = useMemo(() => {
    if (!supplierSearch) return suppliers.filter(s => s.is_active).slice(0, 10);
    const lower = supplierSearch.toLowerCase();
    return suppliers.filter(s => 
      (s.name.toLowerCase().includes(lower) || s.mobile.includes(lower)) && s.is_active
    ).slice(0, 10);
  }, [supplierSearch, suppliers]);

  const filteredMedicines = useMemo(() => {
    if (!medicineSearch) return medicines.filter(m => m.is_active).slice(0, 10);
    const lower = medicineSearch.toLowerCase();
    return medicines.filter(m => m.name.toLowerCase().includes(lower) && m.is_active).slice(0, 10);
  }, [medicineSearch, medicines]);

  const totalAmount = items.reduce((acc, item) => acc + (item.quantity * item.rate), 0);

  // New Supplier State
  const [newSupName, setNewSupName] = useState('');
  const [newSupMobile, setNewSupMobile] = useState('');

  const handleCreateSupplier = async () => {
    if (!newSupName || !newSupMobile) return;
    const newSupplier: Supplier = {
      id: uuidv4(),
      name: newSupName,
      mobile: newSupMobile,
      balance_due: 0,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await db.suppliers.add(newSupplier);
    await queueSyncItem('suppliers', newSupplier.id, 'insert', newSupplier);
    setSelectedSupplier(newSupplier);
    setStep(2);
  };

  const addItem = (med: Medicine) => {
    setItems([...items, { id: uuidv4(), medicine: med, quantity: 1, rate: med.purchase_price || med.rate }]);
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
  const [paymentMode, setPaymentMode] = useState<'cash' | 'online' | 'credit' | 'split'>('cash');
  const [splitPaid, setSplitPaid] = useState<string>('');

  const handleSavePurchase = async () => {
    if (!selectedSupplier || items.length === 0 || !invoiceNumber) return;

    const now = new Date().toISOString();
    const purchaseId = uuidv4();
    
    let paidAmount = 0;
    let dueAmount = 0;
    let finalStatus: 'paid' | 'partial' | 'unpaid' = 'paid';

    if (paymentMode === 'cash' || paymentMode === 'online') {
      paidAmount = totalAmount;
      dueAmount = 0;
      finalStatus = 'paid';
    } else if (paymentMode === 'credit') {
      paidAmount = 0;
      dueAmount = totalAmount;
      finalStatus = 'unpaid';
    } else if (paymentMode === 'split') {
      paidAmount = Number(splitPaid);
      dueAmount = totalAmount - paidAmount;
      finalStatus = dueAmount > 0 ? 'partial' : 'paid';
    }

    const newPurchase = {
      id: purchaseId,
      invoice_number: invoiceNumber,
      supplier_id: selectedSupplier.id,
      purchase_date: now,
      total_amount: totalAmount,
      paid_amount: paidAmount,
      due_amount: dueAmount,
      payment_status: finalStatus,
      created_at: now,
      updated_at: now,
    };

    const newPurchaseItems = items.map(item => ({
      id: uuidv4(),
      purchase_id: purchaseId,
      medicine_id: item.medicine.id,
      medicine_name_snapshot: item.medicine.name,
      purchase_rate: item.rate,
      quantity: item.quantity,
      item_total: item.quantity * item.rate,
    }));

    await db.transaction('rw', db.purchases, db.purchaseItems, db.suppliers, db.syncQueue, db.medicines, async () => {
      await db.purchases.add(newPurchase);
      await db.purchaseItems.bulkAdd(newPurchaseItems);
      
      const qItems = [
        { tableName: 'purchases', recordId: newPurchase.id, operation: 'insert' as const, payload: newPurchase },
        ...newPurchaseItems.map(item => ({ tableName: 'purchase_items', recordId: item.id, operation: 'insert' as const, payload: item }))
      ];
      
      // Add stock qty & potentially update average purchase price
      for (const item of items) {
        const existingStock = item.medicine.stock_qty || 0;
        const newQty = existingStock + item.quantity;
        await db.medicines.update(item.medicine.id, { stock_qty: newQty, purchase_price: item.rate, updated_at: now });
        qItems.push({ 
          tableName: 'medicines', 
          recordId: item.medicine.id, 
          operation: 'update' as const, 
          payload: { ...item.medicine, stock_qty: newQty, purchase_price: item.rate, updated_at: now } 
        });
      }
      
      if (dueAmount > 0) {
        const newBalance = selectedSupplier.balance_due + dueAmount;
        await db.suppliers.update(selectedSupplier.id, { balance_due: newBalance, updated_at: now });
        qItems.push({ tableName: 'suppliers', recordId: selectedSupplier.id, operation: 'update' as const, payload: { ...selectedSupplier, balance_due: newBalance, updated_at: now } });
      }

      await queueSyncItems(qItems);
    });

    navigate('/'); // Back to dashboard
  };

  return (
    <div className="flex flex-col min-h-full bg-gray-50 pb-20">
      <header className="bg-white border-b px-4 py-3 flex items-center shadow-sm z-10 sticky top-0">
        <h1 className="text-xl font-bold">New Purchase (Stock In)</h1>
        {totalAmount > 0 && (
          <div className="ml-auto font-bold text-brand-600 bg-brand-50 px-3 py-1 rounded-full">
            {formatCurrency(totalAmount)}
          </div>
        )}
      </header>

      <div className="p-4 max-w-lg mx-auto w-full space-y-6">
        {/* STEP 1: SUPPLIER */}
        {step === 1 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Supplier</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Search name or mobile..."
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all shadow-sm text-lg"
                  value={supplierSearch}
                  onChange={(e) => { setSupplierSearch(e.target.value); setNewSupName(e.target.value); }}
                />
              </div>
            </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {filteredSuppliers.map(s => (
                  <button
                    key={s.id}
                    onClick={() => { setSelectedSupplier(s); setStep(2); }}
                    className="w-full text-left p-4 border-b last:border-b-0 hover:bg-gray-50 flex justify-between items-center transition-colors"
                  >
                    <div>
                      <div className="font-semibold text-gray-900">{s.name}</div>
                      <div className="text-sm text-gray-500">{s.mobile}</div>
                    </div>
                  </button>
                ))}
                
                {filteredSuppliers.length === 0 && supplierSearch && (
                  <div className="p-4 bg-gray-50 space-y-3">
                    <div className="text-sm text-gray-500 font-medium pb-2 border-b">Create New Supplier</div>
                    <input
                      type="text"
                      placeholder="Name"
                      className="w-full p-3 border rounded-lg"
                      value={newSupName}
                      onChange={e => setNewSupName(e.target.value)}
                    />
                    <input
                      type="tel"
                      placeholder="Mobile Number"
                      className="w-full p-3 border rounded-lg"
                      value={newSupMobile}
                      onChange={e => setNewSupMobile(e.target.value)}
                    />
                    <button
                      onClick={handleCreateSupplier}
                      disabled={!newSupName || !newSupMobile}
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
                    <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Supplier</div>
                    <div className="font-bold text-gray-900 text-lg">{selectedSupplier?.name}</div>
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
                        <div className="font-bold text-gray-900 mb-3 pr-6">{item.medicine.name}</div>
                        <div className="flex gap-3">
                          <div className="w-1/3">
                            <label className="text-xs text-gray-500 font-medium block mb-1">Qty Added</label>
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
                            <label className="text-xs text-gray-500 font-medium block mb-1">Buy Rate (₹)</label>
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
                  <h3 className="font-bold text-gray-900 mb-3">Add Stock</h3>
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      placeholder="Search medicine to add stock..."
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-base bg-gray-50"
                      value={medicineSearch}
                      onChange={(e) => setMedicineSearch(e.target.value)}
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
                          <div className="bg-brand-100 text-brand-700 p-1.5 rounded-lg">
                            <Plus className="w-4 h-4" />
                          </div>
                        </div>
                      </button>
                    ))}
                    {filteredMedicines.length === 0 && medicineSearch && (
                      <div className="p-4 text-center text-gray-500 text-sm">
                        No medicines found. Please add medicines from the Medicines tab first.
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
                    Proceed to Finalize <IndianRupee className="w-5 h-5" />
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
              <div className="text-sm text-gray-500 font-medium mb-1">Total Purchase Amount</div>
              <div className="text-4xl font-bold text-gray-900">{formatCurrency(totalAmount)}</div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-1">Invoice/Bill Number *</label>
              <input
                type="text"
                placeholder="From Supplier's Bill..."
                className="w-full p-3 border border-gray-300 rounded-lg text-lg"
                value={invoiceNumber}
                onChange={e => setInvoiceNumber(e.target.value)}
              />
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 px-1 mb-3">Payment Given To Supplier</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'cash', label: 'Cash (Full)' },
                  { id: 'online', label: 'Online (Full)' },
                  { id: 'credit', label: 'Credit (Unpaid)' },
                  { id: 'split', label: 'Partial Pay' },
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount Paid (₹)</label>
                  <input
                    type="number"
                    autoFocus
                    className="w-full p-3 border border-gray-300 rounded-lg text-lg font-bold"
                    value={splitPaid}
                    onChange={e => setSplitPaid(e.target.value)}
                  />
                </div>
                <div className="flex justify-between items-center p-3 bg-red-50 text-red-700 rounded-lg font-medium">
                  <span>Credit (We Owe):</span>
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
                onClick={handleSavePurchase}
                disabled={!invoiceNumber || (paymentMode === 'split' && (!splitPaid || Number(splitPaid) > totalAmount || Number(splitPaid) < 0))}
                className="w-2/3 bg-brand-600 text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg shadow-brand-500/30 disabled:opacity-50"
              >
                <CheckCircle2 className="w-5 h-5" /> Save Stock In
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
