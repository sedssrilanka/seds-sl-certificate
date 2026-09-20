import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { Download, CheckCircle2, AlertCircle, Loader2, ArrowLeft, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { verifyCertificate, getPublicEvent } from '../lib/supabase';
import { Event, VerificationResponse } from '../types';
import { EventPicker } from './EventPicker';

export const CertificatePortal: React.FC = () => {
  const { slug } = useParams<{ slug?: string }>();
  const [searchParams] = useSearchParams();

  // Dynamically resolve event slug from URL path (e.g. /imot) or query param (?event=imot)
  const eventSlug = slug || searchParams.get('event') || '';

  const [event, setEvent] = useState<Event | null>(null);
  const [loadingEvent, setLoadingEvent] = useState<boolean>(Boolean(eventSlug));
  const [eventNotFound, setEventNotFound] = useState<boolean>(false);

  // Form State
  const [email, setEmail] = useState<string>('');
  const [certificateCode, setCertificateCode] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [downloading, setDownloading] = useState<boolean>(false);

  // Result State
  const [result, setResult] = useState<VerificationResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch Event by slug/query
  useEffect(() => {
    if (!eventSlug) {
      setLoadingEvent(false);
      return;
    }

    async function loadEventData() {
      setLoadingEvent(true);
      setEventNotFound(false);
      try {
        const data = await getPublicEvent(eventSlug);
        if (data) {
          setEvent(data);
        } else {
          setEventNotFound(true);
        }
      } catch (err) {
        console.error('Failed to load event:', err);
        setEventNotFound(true);
      } finally {
        setLoadingEvent(false);
      }
    }
    loadEventData();
  }, [eventSlug]);

  // If no slug is specified at all in path or query, render the clean event directory
  if (!eventSlug) {
    return <EventPicker />;
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setResult(null);

    const trimmedEmail = email.trim();
    const trimmedCode = certificateCode.trim();

    if (!trimmedEmail) {
      const msg = 'Please enter your registered email address.';
      setErrorMessage(msg);
      toast.warning(msg);
      return;
    }

    if (!trimmedCode) {
      const msg = 'Please enter the certificate code.';
      setErrorMessage(msg);
      toast.warning(msg);
      return;
    }

    setSubmitting(true);

    try {
      const response = await verifyCertificate(eventSlug, trimmedEmail, trimmedCode);

      if (response.success) {
        setResult(response);
        toast.success(`Certificate verified for ${response.participant_name || 'Participant'}!`);
      } else {
        const errorMsg =
          response.message ||
          'Unable to verify your certificate. Please check your email and certificate code.';
        setErrorMessage(errorMsg);
        toast.error(errorMsg);
      }
    } catch (err) {
      console.error('Verification error:', err);
      const fallbackMsg =
        'Unable to verify your certificate. Please check your email and certificate code.';
      setErrorMessage(fallbackMsg);
      toast.error(fallbackMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setErrorMessage(null);
    setCertificateCode('');
    toast.info('Ready to verify another certificate.');
  };

  const handleDirectDownload = async () => {
    if (!result?.download_url) return;
    setDownloading(true);
    try {
      const response = await fetch(result.download_url);
      if (!response.ok) throw new Error('Failed to fetch certificate file');
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      // Clean filename format: SEDS-[EVENT]-Certificate-[NAME].pdf
      const cleanName = (result.participant_name || 'Participant')
        .replace(/[^a-zA-Z0-9]/g, '-')
        .replace(/-+/g, '-');
      const cleanEvent = (eventSlug || 'SEDS').toUpperCase();
      const filename = `SEDS-${cleanEvent}-Certificate-${cleanName}.pdf`;

      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);

      toast.success(`Certificate downloaded: ${filename}`);
    } catch (err) {
      console.warn('Direct blob download fallback:', err);
      // Fallback in case of storage CORS policy
      const a = document.createElement('a');
      a.href = result.download_url;
      a.download = `SEDS-Certificate-${result.participant_name || 'Participant'}.pdf`;
      a.target = '_self';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      setDownloading(false);
    }
  };

  if (loadingEvent) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (eventNotFound || !event) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-16 text-center">
        <div className="apple-card space-y-4 rounded-2xl p-8">
          <h2 className="text-lg font-semibold text-white">Event Not Found</h2>
          <p className="text-xs text-zinc-400">
            No active certificate distribution found for &ldquo;{eventSlug}&rdquo;.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 pt-2 text-xs font-medium text-white hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Browse all events</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-12 sm:py-16">
      {/* Top back navigation */}
      <div className="mb-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>All Events</span>
        </Link>
      </div>

      {/* Main Card */}
      <div className="bleed-cross bg-[#09090b] space-y-6 p-6 sm:p-8">

        {/* Header */}
        <div className="space-y-1.5 text-center sm:text-left">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[#3B82F6]">
            SEDS Certificate Verification
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[#DFDFDE] sm:text-2xl">
            {event.name}
          </h1>
          {event.description && <p className="mt-1 text-xs text-zinc-400">{event.description}</p>}
        </div>

        {/* Success View */}
        {result?.success ? (
          <div className="space-y-5 pt-2">
            <div className="space-y-3 border border-zinc-800 bg-zinc-950/80 p-5 shadow-inner">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm uppercase tracking-wide">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Certificate Verified</span>
                </span>
              </div>

              <div className="space-y-0.5 pt-1">
                <div className="text-xs text-zinc-400 uppercase tracking-wider">Participant Name</div>
                <div className="text-lg font-bold text-white tracking-wide">{result.participant_name}</div>
                {result.registration_id && (
                  <div className="font-mono text-xs text-zinc-400">
                    Registration ID: {result.registration_id}
                  </div>
                )}
              </div>

              <p className="pt-1 text-xs text-zinc-300">
                Your certificate has been verified for{' '}
                <strong className="text-white">{result.event_name || event.name}</strong>.
              </p>
            </div>

            {/* Actions */}
            <div className="space-y-2.5 pt-2">
              {result.download_url ? (
                <button
                  type="button"
                  onClick={handleDirectDownload}
                  disabled={downloading}
                  className="btn-primary-sharp inline-flex w-full items-center justify-center gap-2 px-4 py-3 text-sm font-semibold tracking-wider transition-all disabled:opacity-75"
                >
                  {downloading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                      <span>Saving Certificate...</span>
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      <span>Download Certificate</span>
                    </>
                  )}
                </button>
              ) : (
                <div className="border border-amber-600/30 bg-amber-950/20 p-3 text-center text-xs text-amber-200">
                  Certificate PDF file is being prepared by the event organizers. Please check back shortly.
                </div>
              )}

              <button
                type="button"
                onClick={handleReset}
                className="btn-secondary-sharp inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium uppercase tracking-wider"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Verify another certificate</span>
              </button>
            </div>

            <div className="text-center text-[11px] text-zinc-500 font-mono">
              Download link is valid for 5 minutes.
            </div>
          </div>
        ) : (
          /* Form View */
          <form onSubmit={handleVerify} className="space-y-4 pt-1" noValidate>
            {/* Error Banner */}
            {errorMessage && (
              <div
                role="alert"
                className="flex items-center gap-2.5 border border-rose-600/30 bg-rose-950/30 p-3.5 text-xs font-medium text-rose-200"
              >
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Email Input */}
            <div>
              <label
                htmlFor="participant-email"
                className="mb-1.5 block text-xs font-medium text-zinc-300 uppercase tracking-wider"
              >
                Registered Email
              </label>
              <input
                id="participant-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                disabled={submitting}
                className="apple-input w-full px-3.5 py-2.5 text-sm placeholder-zinc-600 disabled:opacity-50"
              />
            </div>

            {/* Certificate Code Input */}
            <div>
              <label
                htmlFor="certificate-code"
                className="mb-1.5 block text-xs font-medium text-zinc-300 uppercase tracking-wider"
              >
                Certificate Code
              </label>
              <input
                id="certificate-code"
                type="text"
                required
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck="false"
                value={certificateCode}
                onChange={(e) => setCertificateCode(e.target.value.toUpperCase())}
                placeholder="Code shared during event"
                disabled={submitting}
                className="apple-input w-full px-3.5 py-2.5 font-mono text-sm uppercase tracking-wide placeholder-zinc-600 disabled:opacity-50"
              />
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary-sharp inline-flex w-full items-center justify-center gap-2 px-4 py-3 text-sm font-semibold tracking-wider transition-all disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <span>Verify & Download</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* System info */}
      <div className="mt-6 text-center text-xs text-zinc-500 font-mono">
        SEDS Sri Lanka Certificate Distribution System
      </div>
    </div>
  );
};
