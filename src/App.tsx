import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { CertificatePortal } from './components/CertificatePortal';
import { SupportPage } from './components/SupportPage';
import { AdminDashboard } from './components/Admin/AdminDashboard';
import { AdminLogin } from './components/Admin/AdminLogin';
import { supabase, isSupabaseConfigured } from './lib/supabase';

export const App: React.FC = () => {
  const [isAdminAuth, setIsAdminAuth] = useState<boolean>(() => {
    return Boolean(localStorage.getItem('seds_admin_demo_session'));
  });

  useEffect(() => {
    if (isSupabaseConfigured && supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setIsAdminAuth(Boolean(session));
      });

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        setIsAdminAuth(Boolean(session));
      });

      return () => subscription.unsubscribe();
    }
  }, []);

  return (
    <BrowserRouter>
      <div className="flex min-h-screen flex-col bg-[#09090b] text-[#DFDFDE] antialiased selection:bg-[#3B82F6] selection:text-white">
        {/* Sonner Toast Notifications */}
        <Toaster
          theme="dark"
          position="top-center"
          richColors
          closeButton
          toastOptions={{
            style: {
              background: '#09090b',
              border: '1px solid #27272a',
              color: '#DFDFDE',
              borderRadius: '0px',
            },
          }}
        />

        {/* Clean Apple Minimalist Navigation */}
        <Navbar />

        {/* Main Content */}
        <main className="flex flex-1 flex-col justify-center">
          <Routes>
            {/* Support Route */}
            <Route path="/support" element={<SupportPage />} />

            {/* Public Certificate Portal Routes */}
            <Route path="/" element={<CertificatePortal />} />
            <Route path="/certificate" element={<CertificatePortal />} />
            <Route path="/certificate/:slug" element={<CertificatePortal />} />
            <Route path="/c/:slug" element={<CertificatePortal />} />
            <Route path="/:slug" element={<CertificatePortal />} />

            {/* Admin Portal Routes */}
            <Route
              path="/admin"
              element={
                isAdminAuth ? (
                  <AdminDashboard onLogout={() => setIsAdminAuth(false)} />
                ) : (
                  <AdminLogin onLoginSuccess={() => setIsAdminAuth(true)} />
                )
              }
            />
            <Route
              path="/admin/login"
              element={
                isAdminAuth ? (
                  <Navigate to="/admin" replace />
                ) : (
                  <AdminLogin onLoginSuccess={() => setIsAdminAuth(true)} />
                )
              }
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        {/* Minimal Footer */}
        <Footer />
      </div>
    </BrowserRouter>
  );
};
export default App;
