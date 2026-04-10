import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { Layout } from './components/Layout';
import { useAuth } from './hooks/useAuth';

// Lazy load all pages except Login (first screen)
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const DebtDetail = lazy(() => import('./pages/DebtDetail').then(m => ({ default: m.DebtDetail })));
const Contacts = lazy(() => import('./pages/Contacts').then(m => ({ default: m.Contacts })));
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const BlockedUsers = lazy(() => import('./pages/BlockedUsers').then(m => ({ default: m.BlockedUsers })));
const Tools = lazy(() => import('./pages/Tools').then(m => ({ default: m.Tools })));
const ExchangeRates = lazy(() => import('./pages/ExchangeRates').then(m => ({ default: m.ExchangeRates })));
const PersonStream = lazy(() => import('./pages/PersonStream').then(m => ({ default: m.PersonStream })));
const StreamHistory = lazy(() => import('./pages/StreamHistory').then(m => ({ default: m.StreamHistory })));
const ActiveSessions = lazy(() => import('./pages/ActiveSessions').then(m => ({ default: m.ActiveSessions })));
const AccountSettings = lazy(() => import('./pages/AccountSettings').then(m => ({ default: m.AccountSettings })));
const PrivacySettings = lazy(() => import('./pages/PrivacySettings').then(m => ({ default: m.PrivacySettings })));
const AdminPanel = lazy(() => import('./pages/AdminPanel').then(m => ({ default: m.AdminPanel })));

const PageLoader = () => (
  <div className="flex justify-center items-center h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
  </div>
);

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" />;

  return <>{children}</>;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" />;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(user as any).isAdmin) return <Navigate to="/" replace />;

  return <>{children}</>;
};

import { ThemeProvider } from './context/ThemeContext';
import { ModalProvider } from './context/ModalContext';

import { ContactProvider } from './context/ContactContext';
import { NotificationProvider } from './context/NotificationContext';
import { AuthProvider } from './context/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ModalProvider>
          <ContactProvider>
            <ErrorBoundary>
              <div className="w-full max-w-3xl mx-auto min-h-screen bg-background shadow-2xl relative border-x border-border">
              <Router>
                <NotificationProvider>
              <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Navigate to="/login" replace />} />
                <Route path="/admin" element={<AdminRoute><AdminPanel /></AdminRoute>} />

                <Route element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/receivables" element={<Dashboard />} />
                  <Route path="/payables" element={<Dashboard />} />
                  <Route path="/settings/account" element={<AccountSettings />} />
                  <Route path="/settings/exchange-rates" element={<ExchangeRates />} />
                  <Route path="/debt/:id" element={<DebtDetail />} />
                  <Route path="/tools" element={<Tools />} />
                  <Route path="/person/:id" element={<PersonStream />} />
                  <Route path="/person/:id/history" element={<StreamHistory />} />
                  <Route path="/contacts" element={<Contacts />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/settings/sessions" element={<ActiveSessions />} />
                  <Route path="/settings/blocked" element={<BlockedUsers />} />
                  <Route path="/settings/privacy" element={<PrivacySettings />} />
                </Route>
              </Routes>
              </Suspense>
                </NotificationProvider>
              </Router>
              </div>
            </ErrorBoundary>
          </ContactProvider>
        </ModalProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
