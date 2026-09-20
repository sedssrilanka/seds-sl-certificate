import React from 'react';
import { Link, useLocation } from 'react-router-dom';

export const Navbar: React.FC = () => {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');

  return (
    <header className="relative z-20 border-b border-zinc-800 bg-[#09090b]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
        {/* Brand */}
        <Link to="/" className="flex items-center transition-opacity hover:opacity-90">
          <img src="/sedsl-l-icon.png" alt="SEDS Sri Lanka" className="h-8 w-auto object-contain" />
        </Link>

        {/* Action */}
        <div className="flex items-center gap-3">
          {isAdmin ? (
            <div className="relative inline-block">
              <div className="pointer-events-none absolute -left-2 -right-2 top-0 z-10 border-t border-zinc-800" />
              <div className="pointer-events-none absolute -left-2 -right-2 bottom-0 z-10 border-b border-zinc-800" />
              <div className="pointer-events-none absolute -bottom-2 -top-2 left-0 z-10 border-l border-zinc-800" />
              <div className="pointer-events-none absolute -bottom-2 -top-2 right-0 z-10 border-r border-zinc-800" />
              <Link
                to="/"
                className="btn-secondary-sharp inline-flex items-center justify-center px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-[#DFDFDE] hover:text-white"
              >
                Public Portal
              </Link>
            </div>
          ) : (
            <div className="relative inline-block">
              <div className="pointer-events-none absolute -left-2 -right-2 top-0 z-10 border-t border-zinc-800" />
              <div className="pointer-events-none absolute -left-2 -right-2 bottom-0 z-10 border-b border-zinc-800" />
              <div className="pointer-events-none absolute -bottom-2 -top-2 left-0 z-10 border-l border-zinc-800" />
              <div className="pointer-events-none absolute -bottom-2 -top-2 right-0 z-10 border-r border-zinc-800" />
              <Link
                to="/support"
                className="btn-secondary-sharp inline-flex items-center justify-center px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-[#DFDFDE] hover:text-white"
              >
                Support
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
