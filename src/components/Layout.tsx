import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, FilePlus2, Users, Pill, Receipt, Settings, PackagePlus, Menu as MenuIcon, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { useState, useEffect } from 'react';

const mainNavItems = [
  { to: '/', icon: LayoutDashboard, label: 'Home' },
  { to: '/bills/new', icon: FilePlus2, label: 'New Bill' },
  { to: '/purchases/new', icon: PackagePlus, label: 'Stock In' },
];

const moreItems = [
  { to: '/customers', icon: Users, label: 'Customers & Khata' },
  { to: '/medicines', icon: Pill, label: 'Medicines Inventory' },
  { to: '/bills', icon: Receipt, label: 'Past Bills' },
  { to: '/settings', icon: Settings, label: 'App Settings' },
];

export function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  // Close menu on navigation
  useEffect(() => {
    setMenuOpen(false);
  }, [location]);

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-900 pb-16 md:pb-0 md:flex-row relative overflow-hidden">
      <main className="flex-1 overflow-y-auto z-0">
        <Outlet />
      </main>

      {/* Slide-up Menu Drawer */}
      {menuOpen && (
        <div className="absolute inset-0 z-40 bg-black/50 backdrop-blur-sm animate-in fade-in" onClick={() => setMenuOpen(false)}>
          <div 
            className="absolute bottom-16 left-0 right-0 bg-white rounded-t-3xl p-6 pb-8 shadow-2xl animate-in slide-in-from-bottom-10"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">Menu</h2>
              <button onClick={() => setMenuOpen(false)} className="p-2 bg-gray-100 rounded-full text-gray-600 hover:bg-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {moreItems.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => cn(
                    "flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all",
                    isActive ? "border-brand-500 bg-brand-50 text-brand-700" : "border-gray-100 bg-gray-50 text-gray-700 hover:border-gray-300"
                  )}
                >
                  <item.icon className={cn("w-8 h-8 mb-2", location.pathname === item.to ? "text-brand-600" : "text-gray-400")} />
                  <span className="text-xs font-bold text-center">{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 w-full bg-white border-t border-gray-200 z-50">
        <div className="flex justify-around items-center h-16 max-w-md mx-auto">
          {mainNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center w-full h-full space-y-1',
                  isActive
                    ? 'text-brand-600'
                    : 'text-gray-500 hover:text-gray-900'
                )
              }
            >
              <item.icon className="w-6 h-6" strokeWidth={location.pathname === item.to ? 2.5 : 2} />
              <span className="text-[10px] font-bold">{item.label}</span>
            </NavLink>
          ))}
          
          <button 
            onClick={() => setMenuOpen(!menuOpen)}
            className={cn(
              'flex flex-col items-center justify-center w-full h-full space-y-1',
              menuOpen ? 'text-brand-600' : 'text-gray-500'
            )}
          >
            <MenuIcon className="w-6 h-6" strokeWidth={menuOpen ? 2.5 : 2} />
            <span className="text-[10px] font-bold">Menu</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
