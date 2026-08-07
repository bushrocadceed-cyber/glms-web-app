import { Route, Routes } from 'react-router-dom';
import DashboardLayout from './components/layout/DashboardLayout';
import Dashboard from './pages/Dashboard';
import InventoryPage from './pages/InventoryPage';
import MembersPage from './pages/MembersPage';
import LoansPage from './pages/LoansPage';
import ReportsPage from './pages/ReportsPage';
import StaffManagementPage from './pages/StaffManagementPage';
import AdminRegistrationPage from './pages/AdminRegistrationPage';
import ActivityLogsPage from './pages/ActivityLogsPage';
import Settings from './pages/Settings';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="login" element={<LoginPage />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<DashboardLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="inventory" element={<InventoryPage />} />
                <Route path="loans" element={<LoansPage />} />
                <Route path="members" element={<MembersPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="settings" element={<Settings />} />

                {/* Admin-only: matches the profiles_insert_admin / _update_admin
                    / _delete_admin RLS policies in supabase/rls_policies.sql —
                    staff reaching these pages would otherwise hit an RLS
                    violation on every write instead of the button never
                    being reachable in the first place. */}
                <Route element={<ProtectedRoute role="admin" />}>
                  <Route path="staff" element={<StaffManagementPage />} />
                  <Route path="admin-registration" element={<AdminRegistrationPage />} />
                  <Route path="activity-logs" element={<ActivityLogsPage />} />
                </Route>
              </Route>
            </Route>
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
