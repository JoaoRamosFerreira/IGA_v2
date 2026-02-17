import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth';

const userNav = [
  { label: 'Home', to: '/' },
  { label: 'My Reviews', to: '/my-reviews' },
  { label: 'My Assets', to: '/my-assets' },
  { label: 'Campaign History', to: '/campaign-history' },
  { label: 'Changelog', to: '/changelog' },
];

const adminNav = [
  { label: 'Employees', to: '/admin/employees' },
  { label: 'Assets', to: '/admin/assets' },
  { label: 'Campaigns', to: '/admin/campaigns' },
  { label: 'Reviews', to: '/admin/reviews' },
  { label: 'Audit Items', to: '/admin/audit-items' },
  { label: 'User Directory', to: '/admin/user-directory' },
  { label: 'Admins', to: '/admin/admins' },
  { label: 'Data Import', to: '/admin/data-import' },
  { label: 'Notifications', to: '/admin/notifications' },
  { label: 'Audit Logs', to: '/admin/audit-logs' },
  { label: 'Settings', to: '/admin/settings' },
  { label: 'Help Settings', to: '/admin/help-settings' },
];

function Item({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `block rounded px-3 py-2 text-sm ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-100'}`
      }
    >
      {label}
    </NavLink>
  );
}

export default function SidebarLayout() {
  const { isAdmin, signOut, profile } = useAuth();

  return (
    <div className="flex min-h-screen bg-slate-100">
      <aside className="sticky top-0 h-screen w-72 border-r border-slate-200 bg-white p-4">
        <h1 className="text-lg font-bold">IGA Platform</h1>
        <p className="mt-1 text-xs text-slate-500">{profile?.email}</p>

        <nav className="mt-5 space-y-1">
          {userNav.map((n) => <Item key={n.to} to={n.to} label={n.label} />)}

          {isAdmin ? (
            <>
              <p className="mt-4 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Admin</p>
              {adminNav.map((n) => <Item key={n.to} to={n.to} label={n.label} />)}
            </>
          ) : null}
        </nav>

        <button className="mt-6 rounded border px-3 py-2 text-sm" onClick={() => void signOut()}>Sign Out</button>
      </aside>

      <main className="w-full p-6">
        <Outlet />
      </main>
    </div>
  );
}
