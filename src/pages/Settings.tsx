import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, RefreshCw, Cloud, CloudOff, Download } from 'lucide-react';
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
      const allCustomers = await db.customers.toArray();
      const allBills = await db.bills.toArray();
      
      let csvContent = "data:text/csv;charset=utf-8,";
      csvContent += "Type,ID,Name/Number,Date,Total Amount,Paid Amount,Due Amount,Status\n";
      
      allCustomers.forEach(c => {
        csvContent += `Customer,${c.id},${c.name.replace(/,/g, '')},${c.created_at},${c.udhari_balance},,,\n`;
      });
      
      allBills.forEach(b => {
        csvContent += `Bill,${b.bill_number},${b.customer_id},${b.bill_date},${b.total_amount},${b.paid_amount},${b.due_amount},${b.payment_status}\n`;
      });
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `agrisync_backup_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      alert("Export failed");
    }
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
        <h2 className="text-lg font-bold text-gray-900">Data Backup</h2>
        <p className="text-sm text-gray-500 mb-4">
          Export all your customers, bills, and udhari records to a CSV file.
        </p>
        <button 
          onClick={handleExportData}
          className="bg-white border-2 border-gray-200 text-gray-700 py-3 px-6 rounded-lg font-medium flex items-center gap-2 hover:border-brand-500 transition-colors"
        >
          <Download className="w-4 h-4" /> Export to CSV
        </button>
      </div>

      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
        <h2 className="text-lg font-bold text-gray-900">App Info</h2>
        <p className="text-sm text-gray-500">AgriSync Version 1.1.0 (Phase 2)</p>
        <p className="text-sm text-gray-500">Data is stored locally via Dexie.js and synced to Supabase when online.</p>
      </div>
    </div>
  );
}
