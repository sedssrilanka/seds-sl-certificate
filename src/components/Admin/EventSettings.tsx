import React, { useState, useEffect } from 'react';
import {
  Loader2,
  AlertCircle,
  Copy,
  Clock,
  Plus,
  X,
  Hourglass,
  Calendar,
  ExternalLink,
  Zap,
  Timer,
  RefreshCw,
  Globe,
  Key,
  Sliders,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Event } from '../../types';
import { updateEventSettings, createEvent } from '../../lib/supabase';
import {
  sha256Hex,
  calculateSLSTTarget,
  formatDualTimezone,
  isoToSLSTInputValue,
  slstInputValueToIso,
  dateToSLSTInputValue,
  getEventPortalUrl,
  getAppBaseDomain,
} from '../../lib/crypto';

interface EventSettingsProps {
  event: Event | null;
  onEventUpdated: () => void;
}

export const EventSettings: React.FC<EventSettingsProps> = ({ event, onEventUpdated }) => {
  const [name, setName] = useState(event?.name || '');
  const [slug, setSlug] = useState(event?.slug || '');
  const [description, setDescription] = useState(event?.description || '');
  const [newCode, setNewCode] = useState('');
  const [codeHashPreview, setCodeHashPreview] = useState('');
  const [enabled, setEnabled] = useState(event?.certificate_enabled ?? true);
  const [expiresAt, setExpiresAt] = useState(isoToSLSTInputValue(event?.code_expires_at));

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // New Event Modal State
  const [showNewEventModal, setShowNewEventModal] = useState(false);
  const [newEvName, setNewEvName] = useState('');
  const [newEvSlug, setNewEvSlug] = useState('');
  const [newEvDesc, setNewEvDesc] = useState('');
  const [newEvCode, setNewEvCode] = useState('');
  const [creatingEvent, setCreatingEvent] = useState(false);

  useEffect(() => {
    if (event) {
      setName(event.name);
      setSlug(event.slug);
      setDescription(event.description || '');
      setEnabled(event.certificate_enabled);
      setExpiresAt(isoToSLSTInputValue(event.code_expires_at));
    }
  }, [event]);

  useEffect(() => {
    async function computeHash() {
      if (!newCode.trim()) {
        setCodeHashPreview('');
        return;
      }
      const hash = await sha256Hex(newCode.trim());
      setCodeHashPreview(hash);
    }
    computeHash();
  }, [newCode]);

  // Code Generator Styles
  const generateCodeWithStyle = (style: 'seds' | 'event' | 'pin' | 'word') => {
    let generated = '';
    const cleanSlug =
      (slug || 'EVENT')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toUpperCase()
        .slice(0, 4) || 'SEDS';
    const randomHex = Math.random().toString(36).substring(2, 6).toUpperCase();

    if (style === 'seds') {
      generated = `SEDS26-${randomHex}`;
    } else if (style === 'event') {
      generated = `${cleanSlug}26-${randomHex}`;
    } else if (style === 'pin') {
      generated = Math.floor(100000 + Math.random() * 900000).toString();
    } else if (style === 'word') {
      const words = [
        'LUNAR',
        'COSMOS',
        'ORBIT',
        'APOLLO',
        'STELLAR',
        'NEBULA',
        'GALAXY',
        'ASTRO',
        'HORIZON',
        'ECLIPSE',
      ];
      const pick = words[Math.floor(Math.random() * words.length)];
      const num = Math.floor(100 + Math.random() * 900);
      generated = `${pick}-${num}`;
    }

    setNewCode(generated);
    toast.success(`Generated code: ${generated}`);
  };

  // Copy code to clipboard
  const handleCopyCode = () => {
    if (!newCode) return;
    navigator.clipboard.writeText(newCode);
    toast.success('Certificate code copied to clipboard!');
  };

  // Copy portal link with configured base domain
  const handleCopyPortalLink = () => {
    const url = getEventPortalUrl(slug);
    navigator.clipboard.writeText(url);
    toast.success(`Portal URL copied: ${url}`);
  };

  // Expiration presets (from Now in Sri Lanka Time)
  const handleSetPresetExpiration = (minutesToAdd: number | null) => {
    if (minutesToAdd === null) {
      setExpiresAt('');
      toast.info('Expiration removed: Certificate code will never expire.');
      return;
    }

    const futureDate = new Date(Date.now() + minutesToAdd * 60 * 1000);
    setExpiresAt(dateToSLSTInputValue(futureDate));

    let label = `${minutesToAdd} mins`;
    if (minutesToAdd >= 1440) {
      const days = Math.round(minutesToAdd / 1440);
      label = `${days} day${days === 1 ? '' : 's'}`;
    } else if (minutesToAdd >= 60) {
      const hrs = Math.round(minutesToAdd / 60);
      label = `${hrs} hour${hrs === 1 ? '' : 's'}`;
    }
    toast.success(`Expiration set to ${label} from now.`);
  };

  // Specific Time Target presets anchored to Sri Lanka Standard Time (UTC+05:30)
  const handleSetTargetTime = (target: 'midnight' | 'noon' | 'end_of_week') => {
    const futureUtc = calculateSLSTTarget(target);
    setExpiresAt(dateToSLSTInputValue(futureUtc));

    if (target === 'midnight') {
      toast.success('Expiration set to tonight at 11:59 PM (Sri Lanka Time / +05:30).');
    } else if (target === 'noon') {
      toast.success('Expiration set to tomorrow at 12:00 PM (Sri Lanka Time / +05:30).');
    } else if (target === 'end_of_week') {
      toast.success('Expiration set to this Sunday at 11:59 PM (Sri Lanka Time / +05:30).');
    }
  };

  // Live Grace Period Extension
  const handleExtendGracePeriod = (minutes: number) => {
    const currentIso = slstInputValueToIso(expiresAt);
    const baseTime = currentIso ? new Date(currentIso).getTime() : Date.now();
    const effectiveBase = Math.max(Date.now(), baseTime);
    const extended = new Date(effectiveBase + minutes * 60 * 1000);
    setExpiresAt(dateToSLSTInputValue(extended));

    let label = `${minutes} mins`;
    if (minutes >= 60) {
      label = `${minutes / 60} hour(s)`;
    }
    toast.success(`Extended expiration by +${label}!`);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event) return;

    setSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    try {
      const dbExpiresAt = slstInputValueToIso(expiresAt);
      const success = await updateEventSettings(event.id, {
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || null,
        certificate_enabled: enabled,
        code_expires_at: dbExpiresAt,
        certificate_code: newCode.trim() || undefined,
      });

      if (success) {
        setSaveSuccess(true);
        setNewCode('');
        toast.success('Event settings updated successfully');
        onEventUpdated();
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        const msg = 'Failed to update event settings.';
        setSaveError(msg);
        toast.error(msg);
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
      const msg = 'An error occurred while saving.';
      setSaveError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateNewEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvName || !newEvSlug || !newEvCode) {
      toast.warning('Please fill in event name, slug, and certificate code.');
      return;
    }

    setCreatingEvent(true);
    try {
      const res = await createEvent({
        name: newEvName.trim(),
        slug: newEvSlug.trim(),
        description: newEvDesc.trim(),
        certificate_code: newEvCode.trim(),
        certificate_enabled: true,
      });

      if (res.success) {
        toast.success(`Event "${newEvName}" created successfully!`);
        setShowNewEventModal(false);
        setNewEvName('');
        setNewEvSlug('');
        setNewEvDesc('');
        setNewEvCode('');
        onEventUpdated();
      } else {
        toast.error(res.message || 'Failed to create event.');
      }
    } catch (err) {
      console.error('Create event error:', err);
      toast.error('An unexpected error occurred while creating event.');
    } finally {
      setCreatingEvent(false);
    }
  };

  // Compute readable expiration status with dual timezone support
  const getExpirationStatus = () => {
    if (!expiresAt) {
      return {
        label: 'Never Expires (Unlimited)',
        detail: 'Open indefinitely until disabled',
        timezones: null,
        state: 'open' as const,
      };
    }
    const isoUtc = slstInputValueToIso(expiresAt);
    if (!isoUtc) {
      return {
        label: 'Invalid Date',
        detail: 'Please select a valid date and time',
        timezones: null,
        state: 'expired' as const,
      };
    }

    const expDate = new Date(isoUtc);
    const now = new Date();
    const diffMs = expDate.getTime() - now.getTime();
    const tzInfo = formatDualTimezone(expDate);

    if (diffMs <= 0) {
      return {
        label: 'Code Expired',
        detail: `Expired at ${tzInfo.slst}`,
        timezones: tzInfo,
        state: 'expired' as const,
      };
    }

    const diffMins = Math.round(diffMs / 60000);
    const timeText =
      diffMins < 60
        ? `${diffMins} min${diffMins === 1 ? '' : 's'}`
        : diffMins < 1440
          ? `${Math.floor(diffMins / 60)}h ${diffMins % 60}m`
          : `~${Math.round(diffMins / 1440)} day${Math.round(diffMins / 1440) === 1 ? '' : 's'}`;

    return {
      label: `Active · Expires in ${timeText}`,
      detail: `Valid until ${tzInfo.slst}`,
      timezones: tzInfo,
      state: 'active' as const,
    };
  };

  const expStatus = getExpirationStatus();

  return (
    <div className="space-y-6">
      {/* Top Controls Header */}
      <div className="apple-card flex flex-col items-start justify-between gap-3 rounded-2xl p-5 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-base font-semibold text-white">Event Settings & Controls</h2>
          <p className="text-xs text-zinc-400">
            Isolated configuration modules for event identity, secret codes, and expiration timer
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopyPortalLink}
            className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
          >
            <Copy className="h-3.5 w-3.5" />
            <span>Copy Link</span>
          </button>

          <a
            href={`/${slug}`}
            target="_blank"
            rel="noreferrer"
            className="btn-secondary-sharp flex items-center gap-1.5 px-3 py-1.5 text-xs uppercase tracking-wider"
          >
            <ExternalLink className="h-3.5 w-3.5 text-[#3B82F6]" />
            <span>Open Portal</span>
          </a>

          <button
            type="button"
            onClick={() => setShowNewEventModal(true)}
            className="btn-primary-sharp flex items-center gap-1.5 px-3 py-1.5 text-xs uppercase tracking-wider"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Event</span>
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="flex items-center gap-2 bg-emerald-600 p-3 text-xs font-semibold uppercase tracking-wide text-white shadow-sm">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-white" />
          <span>All settings saved and published successfully.</span>
        </div>
      )}

      {saveError && (
        <div className="flex items-center gap-2 border border-rose-600/30 bg-rose-950/30 p-3 text-xs font-semibold text-rose-200">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{saveError}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* MODULE 1: Event Identity & URL Routing */}
        <div className="bleed-cross space-y-4 bg-[#09090b] p-6">
          <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
            <Globe className="h-4 w-4 text-[#3B82F6]" />
            <h3 className="text-sm font-bold uppercase tracking-wide text-[#DFDFDE]">
              1. Event Identity & Public URL
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-300">Event Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="apple-input w-full px-3.5 py-2.5 text-sm"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-300">
                URL Slug Path
              </label>
              <div className="flex overflow-hidden border border-zinc-800 bg-zinc-950/60 focus-within:border-zinc-500 focus-within:ring-1 focus-within:ring-zinc-500">
                <span className="flex select-none items-center border-r border-zinc-800 bg-zinc-900/90 px-3 py-2.5 font-mono text-xs text-zinc-500">
                  {getAppBaseDomain()}/
                </span>
                <input
                  type="text"
                  required
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                  className="w-full bg-transparent px-3 py-2.5 font-mono text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-300">
              Description (Optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Official certificate distribution for attendees."
              className="apple-input w-full px-3.5 py-2.5 text-sm"
            />
          </div>
        </div>

        {/* MODULE 2: Livestream Secret Code */}
        <div className="bleed-cross space-y-4 bg-[#09090b] p-6">
          <div className="flex flex-col justify-between gap-2 border-b border-zinc-800 pb-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-[#3B82F6]" />
              <h3 className="text-sm font-bold uppercase tracking-wide text-[#DFDFDE]">
                2. Livestream Verification Code
              </h3>
            </div>

            {/* Generator Quick Action Chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => generateCodeWithStyle('seds')}
                className="btn-secondary-sharp inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider transition-all"
              >
                <span>SEDS26-XXXX</span>
              </button>
              <button
                type="button"
                onClick={() => generateCodeWithStyle('event')}
                className="btn-secondary-sharp inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider transition-all"
              >
                <span>{slug ? slug.toUpperCase().slice(0, 4) : 'EVNT'}26-XXXX</span>
              </button>
              <button
                type="button"
                onClick={() => generateCodeWithStyle('pin')}
                className="btn-secondary-sharp inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider transition-all"
              >
                <span>6-Digit PIN</span>
              </button>
              <button
                type="button"
                onClick={() => generateCodeWithStyle('word')}
                className="btn-secondary-sharp inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider transition-all"
              >
                <Zap className="h-3 w-3 text-[#3B82F6]" />
                <span>Word-Code</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-300">
                New Certificate Code (Leave blank to keep existing)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                  placeholder="e.g. SEDS26-X8K9Q or 849201"
                  className="apple-input w-full px-3.5 py-2.5 pr-10 font-mono text-sm uppercase tracking-wider"
                />
                {newCode && (
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    title="Copy code to clipboard"
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-[#3B82F6] hover:text-white"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-400">
                SHA-256 Storage Hash (One-Way Verification)
              </label>
              <div className="apple-input w-full truncate bg-zinc-950/60 px-3.5 py-2.5 font-mono text-xs text-zinc-500">
                {codeHashPreview ||
                  (event?.certificate_code_hash
                    ? `${event.certificate_code_hash.slice(0, 24)}...`
                    : 'N/A')}
              </div>
            </div>
          </div>
        </div>

        {/* MODULE 3: Expiration Timer Controls */}
        <div className="bleed-cross space-y-5 bg-[#09090b] p-6">
          {/* Header with Solid Status Badge & Timezone details */}
          <div className="flex flex-col justify-between gap-3 border-b border-zinc-800 pb-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#3B82F6]" />
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide text-[#DFDFDE]">
                  3. Validity Window & Expiration Timer
                </h3>
                <div className="mt-0.5 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[11px] text-[#3B82F6]">
                    Timezone: Asia/Colombo (SLST · UTC+05:30)
                  </span>
                  {expStatus.timezones && !expStatus.timezones.isSameTimezone && (
                    <>
                      <span className="text-zinc-600">·</span>
                      <span className="text-[11px] text-zinc-400">
                        Local: {expStatus.timezones.local}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col items-start sm:items-end">
              {/* Solid Badges */}
              <div
                className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold uppercase tracking-wide shadow-sm ${
                  expStatus.state === 'active'
                    ? 'bg-emerald-600 text-white'
                    : expStatus.state === 'expired'
                      ? 'bg-rose-600 text-white'
                      : 'bg-zinc-700 text-zinc-100'
                }`}
              >
                <Hourglass className="h-3 w-3 shrink-0" />
                <span>{expStatus.label}</span>
              </div>
              <span className="mt-1 font-mono text-[11px] text-zinc-400">{expStatus.detail}</span>
            </div>
          </div>

          {/* Row 1: Rapid Livestream Durations */}
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-300">
              <Timer className="h-3.5 w-3.5 text-[#3B82F6]" />
              <span>Livestream Duration (1-Click Set from Now)</span>
            </label>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              <button
                type="button"
                onClick={() => handleSetPresetExpiration(5)}
                className="btn-secondary-sharp px-3 py-2 text-xs font-semibold uppercase tracking-wider"
              >
                +5 Min
              </button>
              <button
                type="button"
                onClick={() => handleSetPresetExpiration(10)}
                className="btn-secondary-sharp px-3 py-2 text-xs font-semibold uppercase tracking-wider"
              >
                +10 Min
              </button>
              <button
                type="button"
                onClick={() => handleSetPresetExpiration(15)}
                className="btn-secondary-sharp px-3 py-2 text-xs font-semibold uppercase tracking-wider"
              >
                +15 Min
              </button>
              <button
                type="button"
                onClick={() => handleSetPresetExpiration(30)}
                className="btn-secondary-sharp px-3 py-2 text-xs font-semibold uppercase tracking-wider"
              >
                +30 Min
              </button>
              <button
                type="button"
                onClick={() => handleSetPresetExpiration(60)}
                className="btn-secondary-sharp px-3 py-2 text-xs font-semibold uppercase tracking-wider"
              >
                +1 Hour
              </button>
              <button
                type="button"
                onClick={() => handleSetPresetExpiration(180)}
                className="btn-secondary-sharp px-3 py-2 text-xs font-semibold uppercase tracking-wider"
              >
                +3 Hours
              </button>
            </div>
          </div>

          {/* Row 2: Extended Window & Target Dates */}
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-300">
              <Calendar className="h-3.5 w-3.5 text-[#3B82F6]" />
              <span>Extended Window & Target Milestones</span>
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <button
                type="button"
                onClick={() => handleSetPresetExpiration(1440)}
                className="btn-secondary-sharp px-3 py-2 text-xs font-semibold uppercase tracking-wider"
              >
                +1 Day
              </button>
              <button
                type="button"
                onClick={() => handleSetPresetExpiration(4320)}
                className="btn-secondary-sharp px-3 py-2 text-xs font-semibold uppercase tracking-wider"
              >
                +3 Days
              </button>
              <button
                type="button"
                onClick={() => handleSetPresetExpiration(10080)}
                className="btn-secondary-sharp px-3 py-2 text-xs font-semibold uppercase tracking-wider"
              >
                +7 Days
              </button>
              <button
                type="button"
                onClick={() => handleSetTargetTime('midnight')}
                className="btn-secondary-sharp px-3 py-2 text-xs font-semibold uppercase tracking-wider"
              >
                Tonight Midnight
              </button>
              <button
                type="button"
                onClick={() => handleSetPresetExpiration(null)}
                className="btn-secondary-sharp px-3 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-400"
              >
                Never (Unlimited)
              </button>
            </div>
          </div>

          {/* Row 3: Live Grace Extensions */}
          <div className="space-y-2 border border-zinc-800 bg-zinc-950/70 p-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-200">
                <RefreshCw className="h-3.5 w-3.5 text-[#3B82F6]" />
                <span>Live Grace Extension (Adds to current countdown)</span>
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleExtendGracePeriod(5)}
                className="btn-secondary-sharp px-3 py-1.5 text-xs font-semibold uppercase tracking-wider"
              >
                +5 Min Grace
              </button>
              <button
                type="button"
                onClick={() => handleExtendGracePeriod(10)}
                className="btn-secondary-sharp px-3 py-1.5 text-xs font-semibold uppercase tracking-wider"
              >
                +10 Min Grace
              </button>
              <button
                type="button"
                onClick={() => handleExtendGracePeriod(30)}
                className="btn-secondary-sharp px-3 py-1.5 text-xs font-semibold uppercase tracking-wider"
              >
                +30 Min Grace
              </button>
              <button
                type="button"
                onClick={() => handleExtendGracePeriod(60)}
                className="btn-secondary-sharp px-3 py-1.5 text-xs font-semibold uppercase tracking-wider"
              >
                +1 Hour Grace
              </button>
            </div>
          </div>

          {/* Row 4: Custom Date Picker */}
          <div className="border-t border-zinc-800 pt-2">
            <div className="mb-1.5 flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-300">
                <Calendar className="h-3.5 w-3.5 text-[#3B82F6]" />
                <span>Custom Expiration Date & Time (Sri Lanka Time · UTC+05:30)</span>
              </label>
              {expiresAt && (
                <button
                  type="button"
                  onClick={() => setExpiresAt('')}
                  className="font-mono text-[11px] uppercase tracking-wider text-[#3B82F6] underline hover:text-white"
                >
                  Clear Date
                </button>
              )}
            </div>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="apple-input w-full px-3.5 py-2.5 font-mono text-xs text-zinc-200"
            />
          </div>
        </div>

        {/* MODULE 4: Master Claiming Access Toggle */}
        <div className="bleed-cross flex items-center justify-between bg-[#09090b] p-5">
          <div className="flex items-center gap-3">
            <Sliders className="h-4 w-4 shrink-0 text-[#3B82F6]" />
            <div>
              <div className="text-sm font-bold uppercase tracking-wide text-[#DFDFDE]">
                4. Certificate Claiming Status
              </div>
              <div className="text-xs text-zinc-400">
                {enabled
                  ? 'Portal is currently OPEN for eligible participants.'
                  : 'Portal is currently CLOSED / DISABLED.'}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setEnabled(!enabled)}
            className={`relative inline-flex h-6 w-12 items-center border border-zinc-700 transition-colors focus:outline-none ${
              enabled ? 'bg-[#3B82F6]' : 'bg-zinc-900'
            }`}
          >
            <span
              className={`inline-block h-4 w-5 transform transition-transform ${
                enabled ? 'translate-x-6 bg-white' : 'translate-x-1 bg-zinc-500'
              }`}
            />
          </button>
        </div>

        {/* Save Bar */}
        <div className="sticky bottom-4 z-20 flex items-center justify-between border border-zinc-800 bg-[#09090b]/95 p-4 shadow-2xl backdrop-blur-xl">
          <span className="font-mono text-xs text-zinc-400">
            Ensure to save after changing code, timer, or event details.
          </span>
          <button
            type="submit"
            disabled={saving}
            className="btn-primary-sharp inline-flex items-center gap-2 px-6 py-2.5 text-xs font-semibold uppercase tracking-wider transition-all disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
                <span>Saving...</span>
              </>
            ) : (
              <span>Save All Settings</span>
            )}
          </button>
        </div>
      </form>

      {/* New Event Modal */}
      {showNewEventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="bleed-cross w-full max-w-md space-y-4 bg-[#09090b] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold uppercase tracking-wide text-[#DFDFDE]">
                Create New Event
              </h3>
              <button
                type="button"
                onClick={() => setShowNewEventModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNewEvent} className="space-y-3.5">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-300">
                  Event Name
                </label>
                <input
                  type="text"
                  required
                  value={newEvName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewEvName(val);
                    if (!newEvSlug) {
                      const autoSlug = val
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/(^-|-$)/g, '');
                      setNewEvSlug(autoSlug);
                    }
                  }}
                  placeholder="e.g. NASA Space Apps 2026"
                  className="apple-input w-full px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-300">
                  URL Slug
                </label>
                <div className="flex overflow-hidden border border-zinc-800 bg-zinc-950/60 focus-within:border-zinc-500 focus-within:ring-1 focus-within:ring-zinc-500">
                  <span className="flex select-none items-center border-r border-zinc-800 bg-zinc-900/90 px-3 py-2 font-mono text-xs text-zinc-500">
                    {getAppBaseDomain()}/
                  </span>
                  <input
                    type="text"
                    required
                    value={newEvSlug}
                    onChange={(e) =>
                      setNewEvSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))
                    }
                    placeholder="space-apps"
                    className="w-full bg-transparent px-3 py-2 font-mono text-xs text-zinc-100 outline-none placeholder:text-zinc-600"
                  />
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="block text-xs font-medium uppercase tracking-wider text-zinc-300">
                    Certificate Code
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const prefix = (newEvSlug || 'EVNT')
                          .replace(/[^a-zA-Z0-9]/g, '')
                          .toUpperCase()
                          .slice(0, 4);
                        const rnd = Math.random().toString(36).substring(2, 6).toUpperCase();
                        setNewEvCode(`${prefix}26-${rnd}`);
                      }}
                      className="text-[10px] font-semibold uppercase tracking-wider text-[#3B82F6] underline hover:text-white"
                    >
                      Auto-Code
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNewEvCode(Math.floor(100000 + Math.random() * 900000).toString());
                      }}
                      className="text-[10px] font-semibold uppercase tracking-wider text-[#3B82F6] underline hover:text-white"
                    >
                      PIN
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  required
                  value={newEvCode}
                  onChange={(e) => setNewEvCode(e.target.value.toUpperCase())}
                  placeholder="e.g. APPS26-X8K"
                  className="apple-input w-full px-3 py-2 font-mono text-xs uppercase"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-300">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  value={newEvDesc}
                  onChange={(e) => setNewEvDesc(e.target.value)}
                  placeholder="Participation verification portal"
                  className="apple-input w-full px-3 py-2 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewEventModal(false)}
                  className="btn-secondary-sharp px-3 py-2 text-xs uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingEvent}
                  className="btn-primary-sharp px-4 py-2 text-xs font-semibold uppercase tracking-wider"
                >
                  {creatingEvent ? 'Creating...' : 'Create Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
