import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { startOfDay, endOfDay } from 'date-fns';

export function useDashboardStats() {
  return useLiveQuery(async () => {
    const today = new Date();
    const todayStart = startOfDay(today).toISOString();
    const todayEnd = endOfDay(today).toISOString();

    const todaysBills = await db.bills
      .filter(b => b.created_at >= todayStart && b.created_at <= todayEnd)
      .toArray();

    const todaySale = todaysBills.reduce((acc, bill) => acc + bill.total_amount, 0);

    const todaysPayments = await db.payments
      .filter(p => p.created_at >= todayStart && p.created_at <= todayEnd)
      .toArray();

    const todayCash = todaysPayments.filter(p => p.mode === 'cash').reduce((acc, p) => acc + p.amount, 0);
    const todayOnline = todaysPayments.filter(p => p.mode === 'online').reduce((acc, p) => acc + p.amount, 0);
    
    const todayUdhariBills = todaysBills.filter(b => b.payment_status !== 'paid');
    const todayUdhariGiven = todayUdhariBills.reduce((acc, b) => acc + b.due_amount, 0);

    // Calculate Today's Profit
    const todayBillIds = new Set(todaysBills.map(b => b.id));
    const todayBillItems = await db.billItems.filter(bi => todayBillIds.has(bi.bill_id)).toArray();
    
    // Fallback: If old items don't have purchase_price_at_sale, look it up from current medicine
    const allMedicines = await db.medicines.toArray();
    const medPriceMap = new Map(allMedicines.map(m => [m.id, m.purchase_price || 0]));

    let todayProfit = 0;
    for (const item of todayBillItems) {
      const costRate = item.purchase_price_at_sale !== undefined 
        ? item.purchase_price_at_sale 
        : (medPriceMap.get(item.medicine_id) || 0);
      const profitOnItem = (item.rate_at_sale - costRate) * item.quantity;
      todayProfit += profitOnItem;
    }

    const allCustomers = await db.customers.toArray();
    const totalOutstandingUdhari = allCustomers.reduce((acc, c) => acc + c.udhari_balance, 0);
    
    const topUdhariCustomers = [...allCustomers]
      .filter(c => c.udhari_balance > 0)
      .sort((a, b) => b.udhari_balance - a.udhari_balance)
      .slice(0, 5);

    // Chart data for last 7 days
    const chartData = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dStart = startOfDay(d).toISOString();
      const dEnd = endOfDay(d).toISOString();
      
      const dayBills = await db.bills
        .filter(b => b.created_at >= dStart && b.created_at <= dEnd)
        .toArray();
        
      chartData.push({
        name: d.toLocaleDateString('en-IN', { weekday: 'short' }),
        sales: dayBills.reduce((acc, bill) => acc + bill.total_amount, 0)
      });
    }

    return {
      todaySale,
      todayProfit,
      todayCash,
      todayOnline,
      todayUdhariGiven,
      totalOutstandingUdhari,
      topUdhariCustomers,
      chartData
    };
  }, []);
}
