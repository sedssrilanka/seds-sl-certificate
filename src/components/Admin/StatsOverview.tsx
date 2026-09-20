import React from 'react';
import { ExternalLink, Copy, Clock, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { DashboardStats, Event } from '../../types';
import { getEventPortalUrl } from '../../lib/crypto';

interface StatsOverviewProps {
  stats: DashboardStats;
  currentEvent: Event | null;
  onRefresh: () => void;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({ stats, currentEvent }) => {
  const isEnabled = currentEvent?.certificate_enabled ?? false;
  const isExpired = currentEvent?.code_expires_at
    ? new Date() > new Date(currentEvent.code_expires_at)
    : false;

  const handleCopyPortalLink = () => {
    if (!currentEvent) return;
    const url = getEventPortalUrl(currentEvent.slug);
    navigator.clipboard.writeText(url);
    toast.success(`Participant Portal Link copied: ${url}`);
  };

  const getExpirationSummary = () => {
    if (!currentEvent?.code_expires_at) return 'Never expires (Unlimited)';
    const expDate = new Date(currentEvent.code_expires_at);
    const now = new Date();
    const diffMs = expDate.getTime() - now.getTime();

    if (diffMs <= 0) return 'Expired';

    const diffMins = Math.round(diffMs / 60000);
    if (diffMins < 60) return `Expires in ${diffMins}m`;
    const diffHours = Math.floor(diffMins / 60);
    const remMins = diffMins % 60;
    if (diffHours < 24) return `Expires in ${diffHours}h ${remMins}m`;
    const diffDays = Math.round(diffMins / 1440);
    return `Expires in ~${diffDays}d`;
  };

  return (
    <div className="space-y-6">
      {/* Event Header Card with Quick Actions */}
      <div className="bleed-cross flex flex-col items-start justify-between gap-4 bg-[#09090b] p-6 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-[#3B82F6]">/{currentEvent?.slug}</span>
            <span className="text-zinc-600">·</span>
            <span className="flex items-center gap-1 font-mono text-[11px] text-zinc-400">
              <Clock className="h-3 w-3 text-zinc-500" />
              <span>{getExpirationSummary()}</span>
            </span>
          </div>
          <h2 className="mt-1 text-lg font-bold uppercase tracking-wide text-[#DFDFDE]">
            {currentEvent?.name}
          </h2>
          {currentEvent?.description && (
            <p className="mt-1 text-xs text-zinc-400">{currentEvent.description}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Solid Status Badge */}
          {isEnabled && !isExpired ? (
            <span className="flex items-center gap-1.5 bg-emerald-600 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white shadow-sm">
              <span className="h-1.5 w-1.5 animate-pulse bg-white" />
              <span>Active</span>
            </span>
          ) : isExpired ? (
            <span className="bg-rose-600 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white shadow-sm">
              Code Expired
            </span>
          ) : (
            <span className="bg-zinc-700 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-200">
              Claiming Disabled
            </span>
          )}

          {/* Quick Copy Link */}
          <button
            type="button"
            onClick={handleCopyPortalLink}
            className="btn-secondary-sharp flex items-center gap-1.5 px-3 py-1.5 text-xs uppercase tracking-wider"
          >
            <Copy className="h-3.5 w-3.5 text-[#3B82F6]" />
            <span>Copy Link</span>
          </button>

          {/* Open Portal */}
          <a
            href={`/${currentEvent?.slug}`}
            target="_blank"
            rel="noreferrer"
            className="btn-secondary-sharp flex items-center gap-1.5 px-3 py-1.5 text-xs uppercase tracking-wider"
          >
            <ExternalLink className="h-3.5 w-3.5 text-[#3B82F6]" />
            <span>Portal</span>
          </a>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {/* Total Registered */}
        <div className="border border-zinc-800 bg-[#09090b] p-5 shadow-lg">
          <div className="text-xs uppercase tracking-wider text-zinc-400">Total Registered</div>
          <div className="mt-1 font-mono text-2xl font-bold text-white sm:text-3xl">
            {stats.totalParticipants}
          </div>
        </div>

        {/* Eligible */}
        <div className="border border-zinc-800 bg-[#09090b] p-5 shadow-lg">
          <div className="flex items-center justify-between text-xs uppercase tracking-wider text-zinc-400">
            <span>Eligible</span>
            <ShieldCheck className="h-3.5 w-3.5 text-zinc-500" />
          </div>
          <div className="mt-1 font-mono text-2xl font-bold text-zinc-200 sm:text-3xl">
            {stats.eligibleParticipants}
          </div>
        </div>

        {/* Claimed */}
        <div className="border border-zinc-800 bg-[#09090b] p-5 shadow-lg">
          <div className="flex items-center justify-between text-xs uppercase tracking-wider text-zinc-400">
            <span>Claimed</span>
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          </div>
          <div className="mt-1 font-mono text-2xl font-bold text-emerald-400 sm:text-3xl">
            {stats.claimedCertificates}
          </div>
        </div>

        {/* Pending */}
        <div className="border border-zinc-800 bg-[#09090b] p-5 shadow-lg">
          <div className="text-xs uppercase tracking-wider text-zinc-400">Pending Claim</div>
          <div className="mt-1 font-mono text-2xl font-bold text-zinc-400 sm:text-3xl">
            {stats.unclaimedCertificates}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-3 border border-zinc-800 bg-[#09090b] p-6 shadow-lg">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold uppercase tracking-wider text-zinc-300">
            Claim Completion Rate
          </span>
          <span className="font-mono font-bold text-[#3B82F6]">{stats.claimRate}%</span>
        </div>

        <div className="h-2 w-full border border-zinc-800 bg-zinc-900">
          <div
            className="h-full bg-[#3B82F6] transition-all duration-300"
            style={{ width: `${Math.min(100, Math.max(0, stats.claimRate))}%` }}
          />
        </div>

        <div className="flex justify-between font-mono text-[11px] text-zinc-500">
          <span>{stats.claimedCertificates} VERIFIED</span>
          <span>{stats.eligibleParticipants} ELIGIBLE</span>
        </div>
      </div>
    </div>
  );
};
