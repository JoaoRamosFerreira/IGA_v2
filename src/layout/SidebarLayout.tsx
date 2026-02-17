import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { label: 'POC Overview', to: '/' },
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'My Reviews', to: '/my-reviews' },
  { label: 'Review History', to: '/review-history' },
  { label: 'Assets', to: '/assets' },
  { label: 'Employees', to: '/employees' },
  { label: 'Settings', to: '/settings' },
];

export default function SidebarLayout() {
  return (
    <div className="flex min-h-screen bg-slate-100">
      <aside className="sticky top-0 h-screen w-64 border-r border-slate-200 bg-white p-4">
        <h1 className="mb-6 text-lg font-bold">IGA Platform</h1>
        <nav className="space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `block rounded-md px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="w-full p-6">
        <Outlet />
      </main>
    </div>
  );
}
