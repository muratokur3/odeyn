import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { DebtDetail } from './pages/DebtDetail';
import { Contacts } from './pages/Contacts';
import { Settings } from './pages/Settings';
import { BlockedUsers } from './pages/BlockedUsers';
import { Tools } from './pages/Tools';
import { ExchangeRates } from './pages/ExchangeRates';
import { PersonStream } from './pages/PersonStream';
import { StreamHistory } from './pages/StreamHistory';
import { Layout } from './components/Layout';
import { useAuth } from './hooks/useAuth';
import { ActiveSessions } from './pages/ActiveSessions';
import { AccountSettings } from './pages/AccountSettings';
import { PrivacySettings } from './pages/PrivacySettings';
import { AdminPanel } from './pages/AdminPanel';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) return <div className="flex justify-center items-center h-screen">Yükleniyor...</div>;
  if (!user) return <Navigate to="/login" />;

  return <>{children}</>;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) return <div className="flex justify-center items-center h-screen">Yükleniyor...</div>;
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
