import React from 'react';
import { getOrgUrl, getOrgDomain } from '../lib/crypto';

export const Footer: React.FC = () => {
  return (
    <footer className="relative z-10 border-t border-zinc-900 bg-black/40 py-8 text-xs text-zinc-500">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-4 sm:flex-row sm:px-6">
        <div>© {new Date().getFullYear()} SEDS Sri Lanka. All rights reserved.</div>
        <div className="flex items-center gap-4 text-zinc-500">
          <span>Cryptographic Verification</span>
          <span>•</span>
          <a
            href={getOrgUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-zinc-400 transition-colors hover:text-zinc-300"
          >
            {getOrgDomain()}
          </a>
        </div>
      </div>
    </footer>
  );
};
