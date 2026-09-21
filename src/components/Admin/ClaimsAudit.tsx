import React, { useState, useEffect } from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';
import { CertificateClaim } from '../../types';
import { getClaimsAudit } from '../../lib/supabase';
import { maskEmail, formatDualTimezone } from '../../lib/crypto';

interface ClaimsAuditProps {
  eventId: string;
}

export const ClaimsAudit: React.FC<ClaimsAuditProps> = ({ eventId }) => {
  const [claims, setClaims] = useState<CertificateClaim[]>([]);
  const [loading, setLoading] = useState(true);

  const loadClaims = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await getClaimsAudit(eventId);
      setClaims(data);
    } catch (err) {
      console.error('Error loading claims audit:', err);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadClaims();
  }, [loadClaims]);

  return (
    <div className="bleed-cross space-y-4 bg-[#09090b] p-6">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[#3B82F6]">
            Cryptographic Audit Log
          </div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-[#DFDFDE]">
            Certificate Claim Audit Trail
          </h2>
          <p className="text-xs text-zinc-400">
            Real-time audit log of verified certificate downloads (Asia/Colombo +05:30 & Local)
          </p>
        </div>

        <button
          type="button"
          onClick={loadClaims}
          className="btn-secondary-sharp inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider"
        >
          <RefreshCw
            className={`h-3 w-3 ${loading ? 'animate-spin text-[#3B82F6]' : 'text-[#3B82F6]'}`}
          />
          <span>Refresh</span>
        </button>
      </div>

      <div className="max-h-[580px] overflow-y-auto overflow-x-auto border border-zinc-800 bg-zinc-950/60">
        <table className="w-full text-left text-xs text-zinc-300">
          <thead className="sticky top-0 z-10 border-b border-zinc-800 bg-[#121215] text-[10px] font-semibold uppercase tracking-wider text-zinc-400 shadow-sm">
            <tr>
              <th className="bg-[#121215] px-3 py-2.5">Timestamp</th>
              <th className="bg-[#121215] px-3 py-2.5">Participant</th>
              <th className="bg-[#121215] px-3 py-2.5">Masked Email</th>
              <th className="bg-[#121215] px-3 py-2.5 font-mono">IP Hash</th>
              <th className="bg-[#121215] px-3 py-2.5 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {loading ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-zinc-500">
                  <Loader2 className="mx-auto mb-1 h-4 w-4 animate-spin text-[#3B82F6]" />
                  <span className="text-xs uppercase tracking-wider">Loading audit log...</span>
                </td>
              </tr>
            ) : claims.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-xs text-zinc-500">
                  No claims recorded yet for this event.
                </td>
              </tr>
            ) : (
              claims.map((claim) => {
                const tz = formatDualTimezone(claim.claimed_at);
                return (
                  <tr key={claim.id} className="hover:bg-zinc-900/40">
                    <td className="px-3 py-2.5 font-mono text-zinc-400">
                      <div className="text-zinc-300">{tz.slst}</div>
                      {!tz.isSameTimezone && (
                        <div className="text-[10px] text-zinc-500">{tz.local}</div>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-white">
                        {claim.participant?.name || 'Verified Participant'}
                      </div>
                      {claim.participant?.registration_id && (
                        <div className="font-mono text-[10px] text-[#3B82F6]">
                          {claim.participant.registration_id}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-zinc-400">
                      {maskEmail(claim.email)}
                    </td>
                    <td className="max-w-[120px] truncate px-3 py-2.5 font-mono text-[11px] text-zinc-500">
                      {claim.ip_hash ? `${claim.ip_hash.slice(0, 12)}...` : 'anonymized'}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="inline-block bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white shadow-sm">
                        Verified
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
