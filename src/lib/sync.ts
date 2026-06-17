import { db } from '../db/db';
import { supabase } from './supabase';
import { v4 as uuidv4 } from 'uuid';

export async function processSyncQueue() {
  if (!navigator.onLine || !supabase) return;

  // 1. PUSH PHASE
  // Read oldest unsynced queue items
  const unsyncedItems = await db.syncQueue
    .where('synced').equals(false)
    .sortBy('created_at');

  for (const item of unsyncedItems) {
    try {
      const { table_name, operation, payload } = item;
      
      let error = null;

      if (operation === 'insert' || operation === 'update') {
        // Upsert on id
        const { error: supaError } = await supabase
          .from(table_name)
          .upsert(payload, { onConflict: 'id' });
          
        error = supaError;
      }

      if (!error) {
        // Mark as synced locally
        await db.syncQueue.update(item.id, { synced: true });
      } else {
        console.error(`Sync error on ${table_name}:`, error);
      }
    } catch (err) {
      console.error('Failed to process sync item', item, err);
    }
  }

  // Prune synced items older than 24h
  const oneDayAgo = new Date();
  oneDayAgo.setHours(oneDayAgo.getHours() - 24);
  
  await db.syncQueue
    .where('synced').equals(true)
    .filter(item => new Date(item.created_at) < oneDayAgo)
    .delete();

  // 2. PULL PHASE
  // In a full offline-first multi-device setup, we would track a `last_pulled_at` timestamp
  // and pull recent changes from Supabase. Given Phase 2 constraints and single-counter
  // focus, we will implement a basic pull using last_pulled_at.
  const lastPulledStr = localStorage.getItem('agrisync_last_pulled');
  const lastPulled = lastPulledStr ? new Date(lastPulledStr).toISOString() : new Date(0).toISOString();
  
  const tables = ['customers', 'medicines', 'bills', 'bill_items', 'payments'];
  
  for (const table of tables) {
    try {
      let query = supabase.from(table).select('*');
      
      // We only pull items updated since last pull. 
      // bill_items doesn't have updated_at, so we might need a workaround or just fetch it based on bill's date if needed.
      // But for simplicity, we pull by created_at or updated_at
      if (table !== 'bill_items') {
        query = query.gt('updated_at', lastPulled);
      } else {
        // Since bill_items doesn't have updated_at, we just skip pulling it incrementally without joining
        // For a single device, pull isn't strictly necessary anyway
        continue; 
      }

      const { data, error } = await query;

      if (!error && data && data.length > 0) {
        // Map postgres timestamps if needed, or just dump into Dexie
        // We use bulkPut to overwrite local rows with newer cloud rows
        if (table === 'customers') await db.customers.bulkPut(data as any);
        if (table === 'medicines') await db.medicines.bulkPut(data as any);
        if (table === 'bills') await db.bills.bulkPut(data as any);
        if (table === 'payments') await db.payments.bulkPut(data as any);
      }
    } catch (e) {
      console.error(`Pull error on ${table}`, e);
    }
  }

  localStorage.setItem('agrisync_last_pulled', new Date().toISOString());
}

// Queue helpers
export async function queueSyncItem(tableName: string, recordId: string, operation: 'insert' | 'update', payload: any) {
  await db.syncQueue.add({
    id: uuidv4(),
    table_name: tableName,
    record_id: recordId,
    operation,
    payload,
    created_at: new Date().toISOString(),
    synced: false,
  });
  
  if (navigator.onLine) {
    processSyncQueue().catch(console.error);
  }
}

export async function queueSyncItems(items: {tableName: string, recordId: string, operation: 'insert' | 'update', payload: any}[]) {
  const qItems = items.map(item => ({
    id: uuidv4(),
    table_name: item.tableName,
    record_id: item.recordId,
    operation: item.operation,
    payload: item.payload,
    created_at: new Date().toISOString(),
    synced: false,
  }));
  
  await db.syncQueue.bulkAdd(qItems);
  
  if (navigator.onLine) {
    processSyncQueue().catch(console.error);
  }
}

// Worker setup
let syncInterval: any = null;
export function startSyncWorker() {
  if (syncInterval) clearInterval(syncInterval);
  
  // Run every 30 seconds
  syncInterval = setInterval(() => {
    if (navigator.onLine) {
      processSyncQueue().catch(console.error);
    }
  }, 30000);

  // Run on online event
  window.addEventListener('online', () => {
    processSyncQueue().catch(console.error);
  });
}
