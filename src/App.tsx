import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';

// Lazy load pages
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const NewBill = React.lazy(() => import('./pages/NewBill'));
const NewPurchase = React.lazy(() => import('./pages/NewPurchase'));
const Customers = React.lazy(() => import('./pages/Customers'));
const CustomerDetail = React.lazy(() => import('./pages/CustomerDetail'));
const Medicines = React.lazy(() => import('./pages/Medicines'));
const Bills = React.lazy(() => import('./pages/Bills'));
const Settings = React.lazy(() => import('./pages/Settings'));
const ResetDB = React.lazy(() => import('./pages/ResetDB'));

function App() {
  return (
    <BrowserRouter>
      <React.Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="bills/new" element={<NewBill />} />
            <Route path="purchases/new" element={<NewPurchase />} />
            <Route path="customers" element={<Customers />} />
            <Route path="customers/:id" element={<CustomerDetail />} />
            <Route path="medicines" element={<Medicines />} />
            <Route path="bills" element={<Bills />} />
            <Route path="settings" element={<Settings />} />
            <Route path="reset" element={<ResetDB />} />
          </Route>
        </Routes>
      </React.Suspense>
    </BrowserRouter>
  );
}

export default App;
