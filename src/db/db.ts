import Dexie, { type Table } from 'dexie';

export interface Customer {
  id: string;
  name: string;
  mobile: string;
  address?: string;
  udhari_balance: number;
  is_active: boolean; // Soft delete
  created_at: string;
  updated_at: string;
}

export interface Medicine {
  id: string;
  name: string;
  category: string;
  unit: string;
  rate: number;
  purchase_price?: number;
  stock_qty?: number;
  net_weight?: string; // e.g. "500 ml", "1 kg"
  expiry_date?: string; // YYYY-MM-DD
  gst_percentage?: number; // e.g. 18
  is_active: boolean; // Soft delete
  created_at: string;
  updated_at: string;
}

export interface Bill {
  id: string;
  bill_number: string;
  customer_id: string;
  bill_date: string; // YYYY-MM-DD
  total_amount: number;
  paid_amount: number;
  due_amount: number;
  payment_status: 'paid' | 'partial' | 'unpaid';
  created_at: string;
  updated_at: string;
}

export interface BillItem {
  id: string;
  bill_id: string;
  medicine_id: string;
  medicine_name_snapshot: string;
  rate_at_sale: number;
  quantity: number;
  item_total: number;
  purchase_price_at_sale?: number;
  gst_percentage?: number;
}

export interface Payment {
  id: string;
  customer_id: string;
  bill_id?: string;
  amount: number;
  mode: 'cash' | 'online' | 'udhari_settlement';
  payment_date: string; // YYYY-MM-DD
  note?: string;
  created_at: string;
}

// -- PURCHASES (INWARD) --
export interface Supplier {
  id: string;
  name: string;
  mobile: string;
  balance_due: number; // How much shop owes supplier
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Purchase {
  id: string;
  invoice_number: string; // From the party's physical bill
  supplier_id: string;
  purchase_date: string;
  total_amount: number;
  paid_amount: number;
  due_amount: number;
  payment_status: 'paid' | 'partial' | 'unpaid';
  created_at: string;
  updated_at: string;
}

export interface PurchaseItem {
  id: string;
  purchase_id: string;
  medicine_id: string;
  medicine_name_snapshot: string;
  purchase_rate: number;
  quantity: number;
  item_total: number;
}

// Phase 2 Sync Queue
export interface SyncQueue {
  id: string;
  table_name: string;
  record_id: string;
  operation: 'insert' | 'update';
  payload: any;
  created_at: string;
  synced: boolean;
}

export class AgriSyncDB extends Dexie {
  customers!: Table<Customer, string>;
  medicines!: Table<Medicine, string>;
  bills!: Table<Bill, string>;
  billItems!: Table<BillItem, string>;
  payments!: Table<Payment, string>;
  suppliers!: Table<Supplier, string>;
  purchases!: Table<Purchase, string>;
  purchaseItems!: Table<PurchaseItem, string>;
  syncQueue!: Table<SyncQueue, string>;

  constructor() {
    super('AgriSyncDB');
    this.version(2).stores({
      customers: 'id, name, mobile, is_active, updated_at', // name and mobile for searching
      medicines: 'id, name, category, is_active, updated_at',
      bills: 'id, bill_number, customer_id, bill_date, payment_status, updated_at',
      billItems: 'id, bill_id, medicine_id',
      payments: 'id, customer_id, payment_date, mode, created_at',
      suppliers: 'id, name, mobile, is_active, updated_at',
      purchases: 'id, invoice_number, supplier_id, purchase_date, payment_status, updated_at',
      purchaseItems: 'id, purchase_id, medicine_id',
      syncQueue: 'id, synced, created_at'
    });
  }
}

export const db = new AgriSyncDB();
