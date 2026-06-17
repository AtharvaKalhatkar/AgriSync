import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../db/db';
import { v4 as uuidv4 } from 'uuid';

export default function ResetDB() {
  const navigate = useNavigate();

  useEffect(() => {
    async function resetAndSeed() {
      // 1. Clear everything
      await db.transaction('rw', db.customers, db.suppliers, db.bills, db.billItems, db.payments, db.syncQueue, db.medicines, async () => {
        await db.customers.clear();
        await db.suppliers.clear();
        await db.bills.clear();
        await db.billItems.clear();
        await db.payments.clear();
        await db.syncQueue.clear();
        await db.medicines.clear();

        // 2. Add Dummy Products
        const now = new Date().toISOString();
        const dummyMedicines = [
          { id: uuidv4(), name: 'Urea 46% (IFFCO)', category: 'fertilizer', unit: 'kg', rate: 266.50, net_weight: '45kg', stock_qty: 150, purchase_price: 250, is_active: true, created_at: now, updated_at: now },
          { id: uuidv4(), name: 'DAP (Diammonium Phosphate)', category: 'fertilizer', unit: 'kg', rate: 1350, net_weight: '50kg', stock_qty: 80, purchase_price: 1200, is_active: true, created_at: now, updated_at: now },
          { id: uuidv4(), name: 'Coragen (Chlorantraniliprole)', category: 'pesticide', unit: 'bottle', rate: 1800, net_weight: '150ml', stock_qty: 25, purchase_price: 1600, is_active: true, created_at: now, updated_at: now },
          { id: uuidv4(), name: 'Roundup (Glyphosate)', category: 'pesticide', unit: 'litre', rate: 450, net_weight: '1L', stock_qty: 40, purchase_price: 400, is_active: true, created_at: now, updated_at: now },
          { id: uuidv4(), name: 'Pioneer Corn Seed P3396', category: 'seed', unit: 'packet', rate: 1250, net_weight: '4kg', stock_qty: 100, purchase_price: 1100, is_active: true, created_at: now, updated_at: now },
          { id: uuidv4(), name: 'Mahadhan 10:26:26', category: 'fertilizer', unit: 'kg', rate: 1470, net_weight: '50kg', stock_qty: 60, purchase_price: 1350, is_active: true, created_at: now, updated_at: now },
        ];
        
        await db.medicines.bulkAdd(dummyMedicines);
      });

      // Clear localStorage except shop name and UPI
      const shop = localStorage.getItem('agrisync_shop');
      const vpa = localStorage.getItem('agrisync_vpa');
      localStorage.clear();
      if (shop) localStorage.setItem('agrisync_shop', shop);
      if (vpa) localStorage.setItem('agrisync_vpa', vpa);

      alert('Database successfully wiped and seeded with real agricultural products!');
      navigate('/');
      window.location.reload();
    }

    resetAndSeed();
  }, [navigate]);

  return (
    <div className="flex items-center justify-center h-screen bg-gray-50 flex-col space-y-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
      <h1 className="text-xl font-bold text-gray-900">Wiping Database and adding Products...</h1>
    </div>
  );
}
