import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import HistoryPage from './pages/HistoryPage';
import LeaveManagementPage from './pages/LeaveManagementPage';
import HolidaysPage from './pages/HolidaysPage';
import DashboardLayout from './components/layout/DashboardLayout';
import { Toaster } from '@/components/ui/toaster';

function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route 
          path="/" 
          element={session ? <Navigate to="/dashboard" replace /> : <Login />} 
        />
        {session && (
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<Dashboard session={session} />} />
            <Route path="/history" element={<HistoryPage session={session} />} />
            <Route path="/leaves" element={<LeaveManagementPage session={session} />} />
            <Route path="/holidays" element={<HolidaysPage session={session} />} />
          </Route>
        )}
        <Route path="*" element={<Navigate to={session ? "/dashboard" : "/"} replace />} />
      </Routes>
      <Toaster />
    </BrowserRouter>
  );
}

export default App;
