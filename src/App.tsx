import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { DebtDetail } from './pages/DebtDetail';
import { Contacts } from './pages/Contacts';
import { Profile } from './pages/Profile';
import { Settings } from './pages/Settings';
import { BlockedUsers } from './pages/BlockedUsers'; // Added
import { QuickDial } from './pages/QuickDial';
import { Tools } from './pages/Tools';
import { PersonDetail } from './pages/PersonDetail';
import { PendingRequests } from './pages/PendingRequests';
import { Layout } from './components/Layout';
import { useAuth } from './hooks/useAuth';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) return <div className="flex justify-center items-center h-screen">Yükleniyor...</div>;
  if (!user) return <Navigate to="/login" />;

  return <>{children}</>;
};

import { ThemeProvider } from './context/ThemeContext';
import { ModalProvider } from './context/ModalContext';

import { ContactProvider } from './context/ContactContext';

function App() {
  return (
    <ThemeProvider>
      <ModalProvider>
        <ContactProvider>
          <div className="w-full max-w-3xl mx-auto min-h-screen bg-background shadow-2xl relative border-x border-border">
            <Router>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />

                <Route element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/receivables" element={<Dashboard />} />
                  <Route path="/payables" element={<Dashboard />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/debt/:id" element={<DebtDetail />} />
                  <Route path="/dial" element={<QuickDial />} />
                  <Route path="/tools" element={<Tools />} />
                  <Route path="/person/:id" element={<PersonDetail />} />
                  <Route path="/contacts" element={<Contacts />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/settings/blocked" element={<BlockedUsers />} /> {/* Added Route */}
                  <Route path="/pending-requests" element={<PendingRequests />} />
                </Route>
              </Routes>
            </Router>
          </div>
        </ContactProvider>
      </ModalProvider>
    </ThemeProvider>
  );
}

export default App;
