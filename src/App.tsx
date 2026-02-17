import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireAdmin, RequireAuth } from './components/RouteGuards';
import SidebarLayout from './layout/SidebarLayout';
import AdminPlaceholderPage from './pages/AdminPlaceholderPage';
import AuthPage from './pages/AuthPage';
import CampaignHistoryPage from './pages/CampaignHistoryPage';
import ChangelogPage from './pages/ChangelogPage';
import HomePage from './pages/HomePage';
import MyAssetsPage from './pages/MyAssetsPage';
import MyReviewsPage from './pages/MyReviewsPage';
import PendingApprovalPage from './pages/PendingApprovalPage';
import SuspendedPage from './pages/SuspendedPage';

export default function App() {
  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/pending-approval" element={<PendingApprovalPage />} />
      <Route path="/suspended" element={<SuspendedPage />} />

      <Route
        element={
          <RequireAuth>
            <SidebarLayout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<HomePage />} />
        <Route path="/my-reviews" element={<MyReviewsPage />} />
        <Route path="/my-assets" element={<MyAssetsPage />} />
        <Route path="/campaign-history" element={<CampaignHistoryPage />} />
        <Route path="/changelog" element={<ChangelogPage />} />

        <Route
          path="/admin/employees"
          element={<RequireAdmin><AdminPlaceholderPage title="Employees" description="Employee management with BambooHR sync and manual overrides." /></RequireAdmin>}
        />
        <Route
          path="/admin/assets"
          element={<RequireAdmin><AdminPlaceholderPage title="Assets" description="Application inventory with Okta group syncing." /></RequireAdmin>}
        />
        <Route
          path="/admin/campaigns"
          element={<RequireAdmin><AdminPlaceholderPage title="Campaigns" description="Campaign builder and campaign inspector." /></RequireAdmin>}
        />
        <Route
          path="/admin/reviews"
          element={<RequireAdmin><AdminPlaceholderPage title="Reviews" description="Review monitoring, delegation, and completion tracking." /></RequireAdmin>}
        />
        <Route
          path="/admin/audit-items"
          element={<RequireAdmin><AdminPlaceholderPage title="Audit Items" description="NHI and human access entries under audit." /></RequireAdmin>}
        />
        <Route
          path="/admin/user-directory"
          element={<RequireAdmin><AdminPlaceholderPage title="User Directory" description="Invite users and manage profile roles/status." /></RequireAdmin>}
        />
        <Route
          path="/admin/admins"
          element={<RequireAdmin><AdminPlaceholderPage title="Admins" description="Manage app_admins access list." /></RequireAdmin>}
        />
        <Route
          path="/admin/data-import"
          element={<RequireAdmin><AdminPlaceholderPage title="Data Import" description="CSV import for NHI and review items." /></RequireAdmin>}
        />
        <Route
          path="/admin/notifications"
          element={<RequireAdmin><AdminPlaceholderPage title="Notifications" description="Rules engine, templates, channels, and logs." /></RequireAdmin>}
        />
        <Route
          path="/admin/audit-logs"
          element={<RequireAdmin><AdminPlaceholderPage title="Audit Logs" description="View audit_logs and error_logs." /></RequireAdmin>}
        />
        <Route
          path="/admin/settings"
          element={<RequireAdmin><AdminPlaceholderPage title="Settings" description="Okta revocation toggle and retention/purge controls." /></RequireAdmin>}
        />
        <Route
          path="/admin/help-settings"
          element={<RequireAdmin><AdminPlaceholderPage title="Help Settings" description="Manage FAQ/help widget database settings." /></RequireAdmin>}
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
