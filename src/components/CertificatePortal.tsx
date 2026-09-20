import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import {
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeft,
  RefreshCw,
  Mail,
  Copy,
  Check,
} from 'lucide-react';
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
  const [copiedTemplate, setCopiedTemplate] = useState<boolean>(false);

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
      <div className="bleed-cross space-y-6 bg-[#09090b] p-6 sm:p-8">
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
                <span className="inline-flex items-center gap-1.5 bg-emerald-600 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-white shadow-sm">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Certificate Verified</span>
                </span>
              </div>

              <div className="space-y-0.5 pt-1">
                <div className="text-xs uppercase tracking-wider text-zinc-400">
                  Participant Name
                </div>
                <div className="text-lg font-bold tracking-wide text-white">
                  {result.participant_name}
                </div>
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
                  Certificate PDF file is being prepared by the event organizers. Please check back
                  shortly.
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

            <div className="text-center font-mono text-[11px] text-zinc-500">
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
                className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-300"
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
                className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-300"
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

      {/* Disclaimer & Correction Guidelines */}
      {(() => {
        const subjectText = `[${event.name}] Certificate Correction Request`;
        const bodyLines = [
          `Event Name: ${event.name}`,
          `Registered Email: ${email || 'your-email@example.com'}`,
          `Current Name on Certificate: ${result?.participant_name || 'Name as currently shown'}`,
          `Corrected Full Name: [Enter exact name needed]`,
          `Registration ID: ${result?.registration_id || 'N/A'}`,
          `Additional Notes: `,
        ];
        const bodyText = bodyLines.join('\r\n');
        const mailtoUrl = `mailto:info@sedssl.org?subject=${encodeURIComponent(subjectText)}&body=${encodeURIComponent(bodyText)}`;
        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=info@sedssl.org&su=${encodeURIComponent(subjectText)}&body=${encodeURIComponent(bodyText)}`;

        const copyEmailTemplate = () => {
          const fullCopy = `To: info@sedssl.org\nSubject: ${subjectText}\n\n${bodyLines.join('\n')}`;
          navigator.clipboard
            .writeText(fullCopy)
            .then(() => {
              setCopiedTemplate(true);
              toast.success('Email correction template copied to clipboard!');
              setTimeout(() => setCopiedTemplate(false), 2500);
            })
            .catch(() => {
              toast.error('Failed to copy to clipboard. Please copy manually.');
            });
        };

        return (
          <div className="bleed-cross mt-6 space-y-3.5 border border-zinc-800/80 bg-[#09090b] p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#3B82F6]">
                Notice & Certificate Corrections
              </span>
            </div>

            <p className="text-xs leading-relaxed text-zinc-300">
              Certificates are <strong>automatically generated</strong> based on the details
              provided during event registration. If you notice any misspelled names, typographical
              errors, or incorrect details, please contact us at{' '}
              <a href={mailtoUrl} className="font-medium text-[#3B82F6] hover:underline">
                info@sedssl.org
              </a>
              . Our team will verify and issue your corrected certificate.
            </p>

            {/* Email Template Preview Box */}
            <div className="space-y-2 border border-zinc-800 bg-zinc-950/70 p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                  Required Email Format:
                </span>
                <button
                  type="button"
                  onClick={copyEmailTemplate}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-[#3B82F6] transition-colors hover:text-blue-400"
                >
                  {copiedTemplate ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copy Template</span>
                    </>
                  )}
                </button>
              </div>

              <div className="space-y-1 font-mono text-[11px] text-zinc-400">
                <div>
                  <strong className="text-zinc-300">To:</strong> info@sedssl.org
                </div>
                <div>
                  <strong className="text-zinc-300">Subject:</strong> {subjectText}
                </div>
                <div className="pt-1 text-zinc-500">
                  ----------------------------------------
                  <br />• <strong>Registered Email:</strong> {email || 'your-email@example.com'}
                  <br />• <strong>Current Name on Certificate:</strong>{' '}
                  {result?.participant_name || 'Name as shown'}
                  <br />• <strong>Corrected Full Name:</strong> [Enter exact name needed]
                  <br />• <strong>Registration ID (if any):</strong>{' '}
                  {result?.registration_id || 'SEDS-XXXXX'}
                  <br />
                  ----------------------------------------
                </div>
              </div>
            </div>

            {/* Direct Email Actions */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <a
                href={mailtoUrl}
                className="btn-primary-sharp inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-white"
              >
                <Mail className="h-3.5 w-3.5" />
                <span>Open in Email App</span>
              </a>

              <a
                href={gmailUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary-sharp inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-[#DFDFDE] hover:text-white"
              >
                <span>Open in Web Gmail</span>
              </a>

              <Link
                to="/support"
                className="btn-secondary-sharp inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-[#DFDFDE] hover:text-white"
              >
                <span>Support Guide</span>
              </Link>
            </div>
          </div>
        );
      })()}

      {/* System info */}
      <div className="mt-6 text-center font-mono text-xs text-zinc-500">
        SEDS Sri Lanka Certificate Distribution System
      </div>
    </div>
  );
};
