import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

interface AdminLoginProps {
  onLoginSuccess: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLoginSuccess }) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isSupabaseConfigured && supabase) {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password,
        });

        if (authError) {
          const msg = authError.message || 'Invalid administrator credentials.';
          setError(msg);
          toast.error(msg);
          return;
        }
      } else {
        if (password.length < 4) {
          const msg = 'Password must be at least 4 characters.';
          setError(msg);
          toast.warning(msg);
          return;
        }
        localStorage.setItem('seds_admin_demo_session', 'active');
      }

      toast.success('Signed in successfully');
      onLoginSuccess();
      navigate('/admin');
    } catch (err) {
      console.error('Login error:', err);
      const msg = 'An error occurred during authentication.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-sm px-4 py-16">
      <div className="bleed-cross space-y-6 bg-[#09090b] p-6 sm:p-8">
        <div className="space-y-2 text-center">
          <img
            src="/sedsl-l-icon.png"
            alt="SEDS Sri Lanka"
            className="mx-auto h-12 w-auto object-contain"
          />
          <h1 className="text-xl font-semibold uppercase tracking-tight text-[#DFDFDE]">
            Admin Sign In
          </h1>
          <p className="text-xs text-zinc-400">SEDS Certificate Management Portal</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 border border-rose-600/30 bg-rose-950/30 p-3 text-xs text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-300">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@seds.lk"
              className="apple-input w-full px-3.5 py-2.5 text-sm placeholder-zinc-600"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-300">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="apple-input w-full px-3.5 py-2.5 text-sm placeholder-zinc-600"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="btn-primary-sharp inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold tracking-wider transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                  <span>Signing in...</span>
                </>
              ) : (
                <span>Sign In</span>
              )}
            </button>
          </div>
        </form>

        {!isSupabaseConfigured && (
          <div className="border border-zinc-800 bg-zinc-900/50 p-3 text-center text-[11px] text-zinc-400">
            Demo Mode: Enter any email & password (min 4 chars) to access.
          </div>
        )}
      </div>
    </div>
  );
};
