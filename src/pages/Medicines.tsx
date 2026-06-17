import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Medicine } from '../db/db';
import { formatCurrency, cn } from '../lib/utils';
import { Pill, Search, Edit2, Trash2, X } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { queueSyncItem } from '../lib/sync';

export default function Medicines() {
  const [search, setSearch] = useState('');
  
  const medicines = useLiveQuery(async () => {
    let results = await db.medicines.toArray();
    if (search) {
      const lower = search.toLowerCase();
      results = results.filter(m => 
        (m.name.toLowerCase().includes(lower) || m.category.toLowerCase().includes(lower)) && m.is_active
      );
    } else {
      results = results.filter(m => m.is_active);
    }
    return results.sort((a, b) => a.name.localeCompare(b.name));
  }, [search]);

  // Add Medicine Form
  const [showAdd, setShowAdd] = useState(false);
  const [newMedName, setNewMedName] = useState('');
  const [newMedCategory, setNewMedCategory] = useState('pesticide');
  const [newMedUnit, setNewMedUnit] = useState('litre');
  const [newMedRate, setNewMedRate] = useState('');
  const [newMedCost, setNewMedCost] = useState('');
  const [gstPercentage, setGstPercentage] = useState('18');
  const [newMedStock, setNewMedStock] = useState('');
  const [newMedWeight, setNewMedWeight] = useState('');

  const handleAdd = async () => {
    if (!newMedName || !newMedRate) return;
    const med: Medicine = {
      id: uuidv4(),
      name: newMedName,
      category: newMedCategory,
      unit: newMedUnit,
      rate: Number(newMedRate),
      purchase_price: newMedCost ? Number(newMedCost) : undefined,
      gst_percentage: Number(gstPercentage) || 0,
      stock_qty: newMedStock ? Number(newMedStock) : undefined,
      net_weight: newMedWeight || undefined,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    await db.medicines.add(med);
    await queueSyncItem('medicines', med.id, 'insert', med);
    setShowAdd(false);
    setNewMedName('');
    setNewMedRate('');
    setNewMedCost('');
    setGstPercentage('18');
    setNewMedStock('');
    setNewMedWeight('');
  };

  // Edit State
  const [editingMed, setEditingMed] = useState<Medicine | null>(null);

  const handleUpdate = async () => {
    if (!editingMed) return;
    const updated = { ...editingMed, updated_at: new Date().toISOString() };
    await db.medicines.put(updated);
    await queueSyncItem('medicines', updated.id, 'update', updated);
    setEditingMed(null);
  };

  const handleDelete = async (med: Medicine) => {
    // Some environments suppress window.confirm, preventing deletion.
    const updated = { ...med, is_active: false, updated_at: new Date().toISOString() };
    await db.medicines.put(updated);
    await queueSyncItem('medicines', updated.id, 'update', updated);
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4 pb-20">
      <header className="flex justify-between items-center mb-2">
        <h1 className="text-2xl font-bold text-gray-900">Medicines</h1>
        <button 
          onClick={() => setShowAdd(!showAdd)}
          className="bg-brand-100 text-brand-700 px-3 py-1.5 rounded-lg font-medium text-sm hover:bg-brand-200"
        >
          {showAdd ? 'Cancel' : '+ Add Medicine'}
        </button>
      </header>

      {showAdd && (
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3 mb-6 animate-in fade-in">
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
              <option value="pouch">Pouch</option>
              <option value="bottle">Bottle</option>
            </select>
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Sale Rate (₹) *"
              className="w-1/2 p-3 border rounded-lg"
              value={newMedRate}
              onChange={e => setNewMedRate(e.target.value)}
            />
            <input
              type="number"
              placeholder="Purchase Cost (₹)"
              className="w-1/2 p-3 border rounded-lg"
              value={newMedCost}
              onChange={e => setNewMedCost(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="GST %"
              className="w-1/3 p-3 border rounded-lg"
              value={gstPercentage}
              onChange={e => setGstPercentage(e.target.value)}
            />
            <input
              type="number"
              placeholder="Stock Qty"
              className="w-1/3 p-3 border rounded-lg"
              value={newMedStock}
              onChange={e => setNewMedStock(e.target.value)}
            />
            <input
              type="text"
              placeholder="Net Wt (e.g. 500ml)"
              className="w-1/3 p-3 border rounded-lg"
              value={newMedWeight}
              onChange={e => setNewMedWeight(e.target.value)}
            />
          </div>
          <button
            onClick={handleAdd}
            disabled={!newMedName || !newMedRate}
            className="w-full bg-brand-600 text-white py-3 rounded-lg font-medium disabled:opacity-50"
          >
            Save Medicine
          </button>
        </div>
      )}

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Search medicines..."
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none shadow-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {medicines?.length === 0 && (
          <div className="text-center py-10">
            <Pill className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <div className="text-gray-500 font-medium">No medicines found</div>
          </div>
        )}

        {medicines?.map((med, i) => (
          <div 
            key={med.id} 
            className={cn(
              "flex items-center justify-between p-4",
              i !== medicines.length - 1 ? "border-b border-gray-100" : ""
            )}
          >
            <div>
              <div className="font-semibold text-gray-900 text-lg">{med.name}</div>
              <div className="text-sm text-gray-500 capitalize">
                {med.category} • {med.unit} {med.net_weight ? `• ${med.net_weight}` : ''}
              </div>
              {med.stock_qty !== undefined && (
                <div className="text-xs mt-1 flex gap-2">
                  <span className={med.stock_qty <= 5 ? 'text-red-500 font-bold' : 'text-green-600'}>
                    Stock: {med.stock_qty}
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="font-bold text-lg text-gray-900">
                  {formatCurrency(med.rate)}
                </div>
                <div className="text-xs text-gray-500">{(med as any).gst_percentage || 0}% GST</div>
              </div>
              <div className="flex gap-2 border-l pl-4 border-gray-200">
                <button 
                  onClick={() => setEditingMed(med)}
                  className="p-2 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => handleDelete(med)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Modal */}
      {editingMed && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-5 space-y-4 animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-bold text-lg">Edit Medicine</h3>
              <button onClick={() => setEditingMed(null)} className="p-1 hover:bg-gray-100 rounded-md"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <input
              type="text"
              className="w-full p-3 border rounded-lg"
              value={editingMed.name}
              onChange={e => setEditingMed({...editingMed, name: e.target.value})}
            />
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Sale Rate"
                className="w-1/2 p-3 border rounded-lg"
                value={editingMed.rate}
                onChange={e => setEditingMed({...editingMed, rate: Number(e.target.value)})}
              />
              <input
                type="number"
                placeholder="Purchase Cost"
                className="w-1/2 p-3 border rounded-lg"
                value={editingMed.purchase_price || ''}
                onChange={e => setEditingMed({...editingMed, purchase_price: e.target.value ? Number(e.target.value) : undefined})}
              />
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="GST %"
                className="w-1/3 p-3 border rounded-lg"
                value={(editingMed as any).gst_percentage || '0'}
                onChange={e => setEditingMed({...editingMed, gst_percentage: Number(e.target.value)})}
              />
              <input
                type="number"
                placeholder="Stock"
                className="w-1/3 p-3 border rounded-lg"
                value={editingMed.stock_qty !== undefined ? editingMed.stock_qty : ''}
                onChange={e => setEditingMed({...editingMed, stock_qty: e.target.value ? Number(e.target.value) : undefined})}
              />
              <input
                type="text"
                placeholder="Net Wt"
                className="w-1/3 p-3 border rounded-lg"
                value={editingMed.net_weight || ''}
                onChange={e => setEditingMed({...editingMed, net_weight: e.target.value})}
              />
            </div>
            <button
              onClick={handleUpdate}
              className="w-full bg-brand-600 text-white py-3 rounded-lg font-medium"
            >
              Save Changes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
