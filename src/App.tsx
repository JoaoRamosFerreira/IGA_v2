import { Navigate, Route, Routes } from 'react-router-dom';
import SidebarLayout from './layout/SidebarLayout';
import DashboardPage from './pages/DashboardPage';
import MyReviewsPage from './pages/MyReviewsPage';
import ReviewHistoryPage from './pages/ReviewHistoryPage';
import AssetsPage from './pages/AssetsPage';
import EmployeesPage from './pages/EmployeesPage';
import SettingsPage from './pages/SettingsPage';
import PocOverviewPage from './pages/PocOverviewPage';

export default function App() {
  return (
    <Routes>
      <Route element={<SidebarLayout />}>
        <Route path="/" element={<PocOverviewPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/my-reviews" element={<MyReviewsPage />} />
        <Route path="/review-history" element={<ReviewHistoryPage />} />
        <Route path="/assets" element={<AssetsPage />} />
        <Route path="/employees" element={<EmployeesPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/poc-overview" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
