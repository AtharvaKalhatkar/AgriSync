import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, RefreshCw, Cloud, CloudOff, Download, Upload } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { processSyncQueue } from '../lib/sync';

export default function Settings() {
  const [vpa, setVpa] = useState('');
  const [shopName, setShopName] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  const pendingItemsCount = useLiveQuery(
    () => db.syncQueue.filter(item => item.synced === false).count(),
    []
  );

  const lastPulled = localStorage.getItem('agrisync_last_pulled');
  const isOnline = navigator.onLine;

  useEffect(() => {
    setVpa(localStorage.getItem('agrisync_vpa') || '');
    setShopName(localStorage.getItem('agrisync_shop') || '');
  }, []);

  const handleSave = () => {
    localStorage.setItem('agrisync_vpa', vpa);
    localStorage.setItem('agrisync_shop', shopName);
    alert('Settings Saved');
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    await processSyncQueue();
    setIsSyncing(false);
  };

  const handleExportData = async () => {
    try {
      const exportData = {
        customers: await db.customers.toArray(),
        suppliers: await db.suppliers.toArray(),
        medicines: await db.medicines.toArray(),
        bills: await db.bills.toArray(),
        billItems: await db.billItems.toArray(),
        payments: await db.payments.toArray(),
        purchases: await db.purchases.toArray(),
        purchaseItems: await db.purchaseItems.toArray(),
      };
      
      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = url;
      link.download = `agrisync_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Backup export failed: " + e);
    }
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm("WARNING: Restoring a backup will overwrite ALL current data in this device. Proceed?")) {
      e.target.value = ''; // reset input
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const data = JSON.parse(text);

        await db.transaction('rw', [db.customers, db.suppliers, db.bills, db.billItems, db.payments, db.purchases, db.purchaseItems, db.medicines, db.syncQueue], async () => {
          // Clear existing
          await db.customers.clear();
          await db.suppliers.clear();
          await db.bills.clear();
          await db.billItems.clear();
          await db.payments.clear();
          await db.purchases.clear();
          await db.purchaseItems.clear();
          await db.medicines.clear();
          await db.syncQueue.clear();

          // Restore
          if (data.customers) await db.customers.bulkAdd(data.customers);
          if (data.suppliers) await db.suppliers.bulkAdd(data.suppliers);
          if (data.bills) await db.bills.bulkAdd(data.bills);
          if (data.billItems) await db.billItems.bulkAdd(data.billItems);
          if (data.payments) await db.payments.bulkAdd(data.payments);
          if (data.purchases) await db.purchases.bulkAdd(data.purchases);
          if (data.purchaseItems) await db.purchaseItems.bulkAdd(data.purchaseItems);
          if (data.medicines) await db.medicines.bulkAdd(data.medicines);
        });

        alert("Backup restored successfully!");
        window.location.reload();
      } catch (err) {
        alert("Failed to restore backup. Invalid file format.");
        console.error(err);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6 pb-20">
      <header className="flex justify-between items-center mb-2">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <SettingsIcon className="w-6 h-6" /> Settings
        </h1>
      </header>

      {/* Cloud Sync Status */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              {isOnline ? <Cloud className="w-5 h-5 text-brand-600" /> : <CloudOff className="w-5 h-5 text-gray-400" />}
              Cloud Sync
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {isOnline ? 'Connected to internet.' : 'Offline. Changes will sync when online.'}
            </p>
          </div>
          <button 
            onClick={handleManualSync}
            disabled={!isOnline || isSyncing}
            className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 text-gray-700 ${isSyncing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4 border-t pt-4">
          <div>
            <div className="text-xs text-gray-500 font-medium">Pending Uploads</div>
            <div className="text-xl font-bold text-gray-900">
              {pendingItemsCount !== undefined ? pendingItemsCount : '...'}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 font-medium">Last Synced</div>
            <div className="text-sm font-bold text-gray-900 mt-1">
              {lastPulled ? new Date(lastPulled).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Never'}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
        <h2 className="text-lg font-bold text-gray-900">Payment Link Setup</h2>
        <p className="text-sm text-gray-500 mb-4">
          Configure your UPI ID and Shop Name to generate payment request links for Udhari settlement.
        </p>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Shop Name</label>
          <input
            type="text"
            placeholder="e.g. AgriSync Shop"
            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
            value={shopName}
            onChange={e => setShopName(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">UPI ID (VPA)</label>
          <input
            type="text"
            placeholder="e.g. shop@upi"
            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
            value={vpa}
            onChange={e => setVpa(e.target.value)}
          />
        </div>

        <button 
          onClick={handleSave}
          className="bg-brand-600 text-white py-3 px-6 rounded-lg font-medium flex items-center gap-2 mt-4 hover:bg-brand-700 transition-colors"
        >
          <Save className="w-4 h-4" /> Save Settings
        </button>
      </div>

      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
        <h2 className="text-lg font-bold text-gray-900">Data Backup & Restore</h2>
        <p className="text-sm text-gray-500 mb-4">
          Download a complete backup of your shop's database, or restore from a previous backup file.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4">
          <button 
            onClick={handleExportData}
            className="flex-1 bg-white border-2 border-brand-200 text-brand-700 py-3 px-6 rounded-lg font-bold flex justify-center items-center gap-2 hover:bg-brand-50 transition-colors"
          >
            <Download className="w-5 h-5" /> Download Full Backup (JSON)
          </button>
          
          <label className="flex-1 bg-white border-2 border-gray-200 text-gray-700 py-3 px-6 rounded-lg font-bold flex justify-center items-center gap-2 hover:bg-gray-50 transition-colors cursor-pointer relative">
            <Upload className="w-5 h-5" /> Restore Backup
            <input 
              type="file" 
              accept=".json" 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={handleImportData}
            />
          </label>
        </div>
      </div>

      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
        <h2 className="text-lg font-bold text-gray-900">App Info</h2>
        <p className="text-sm text-gray-500">AgriSync Version 1.1.0 (Phase 2)</p>
        <p className="text-sm text-gray-500">Data is stored locally via Dexie.js and synced to Supabase when online.</p>
      </div>
    </div>
  );
}
