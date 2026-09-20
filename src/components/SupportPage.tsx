import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail, Copy, Check, HelpCircle, FileCheck2, Clock, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { getOrgUrl, getOrgDomain } from '../lib/crypto';

export const SupportPage: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const sampleTemplate = `To: info@sedssl.org
Subject: [Event Name] Certificate Correction Request

Event Name: [e.g. InOMN 2026]
Registered Email: your-email@example.com
Current Name on Certificate: [Name as currently shown]
Corrected Full Name: [Exact spelling required]
Registration ID: [If available, e.g. SEDS-XXXXX]
Additional Details: [Explain what needs updating]`;

  const mailtoUrl = `mailto:info@sedssl.org?subject=${encodeURIComponent('[Event Name] Certificate Correction Request')}&body=${encodeURIComponent(
    'Event Name: \nRegistered Email: \nCurrent Name on Certificate: \nCorrected Full Name: \nRegistration ID (if any): \nAdditional Details: '
  )}`;

  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=info@sedssl.org&su=${encodeURIComponent(
    '[Event Name] Certificate Correction Request'
  )}&body=${encodeURIComponent(
    'Event Name: \nRegistered Email: \nCurrent Name on Certificate: \nCorrected Full Name: \nRegistration ID (if any): \nAdditional Details: '
  )}`;

  const handleCopy = () => {
    navigator.clipboard
      .writeText(sampleTemplate)
      .then(() => {
        setCopied(true);
        toast.success('Support email template copied to clipboard!');
        setTimeout(() => setCopied(false), 2500);
      })
      .catch(() => {
        toast.error('Failed to copy to clipboard.');
      });
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12 sm:py-16">
      {/* Top back navigation */}
      <div className="mb-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Certificate Portal</span>
        </Link>
      </div>

      {/* Main Support Card */}
      <div className="bleed-cross space-y-6 bg-[#09090b] p-6 sm:p-8">
        {/* Header */}
        <div className="space-y-1.5 border-b border-zinc-800 pb-5">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[#3B82F6]">
            SEDS Sri Lanka Help Desk
          </div>
          <h1 className="text-2xl font-bold uppercase tracking-tight text-[#DFDFDE]">
            Support & Assistance
          </h1>
          <p className="text-xs text-zinc-400">
            Guidance for verifying certificates, correcting typographical errors, and resolving
            verification issues.
          </p>
        </div>

        {/* Auto-generation Notice */}
        <div className="space-y-2 border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="flex items-center gap-2">
            <FileCheck2 className="h-4 w-4 text-[#3B82F6]" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-white">
              Automated Certificate Generation
            </h2>
          </div>
          <p className="text-xs leading-relaxed text-zinc-300">
            All participation certificates are <strong>automatically generated</strong> based on the
            exact details submitted during event registration. If your certificate contains a
            misspelled name, missing character, or outdated email address, our administrative team
            can issue a corrected version.
          </p>
        </div>

        {/* How to Request a Correction */}
        <div className="space-y-3">
          <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#DFDFDE]">
            <Mail className="h-4 w-4 text-[#3B82F6]" />
            <span>How to Request a Certificate Correction</span>
          </h2>
          <p className="text-xs leading-relaxed text-zinc-400">
            Please send an email to <strong className="text-white">info@sedssl.org</strong> using
            the format below. Include your original registration details so our team can
            authenticate your record quickly:
          </p>

          {/* Email Template Box */}
          <div className="space-y-2.5 border border-zinc-800 bg-zinc-950/90 p-4">
            <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                Required Email Template:
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#3B82F6] hover:text-blue-400"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy Template</span>
                  </>
                )}
              </button>
            </div>

            <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-zinc-300">
              {sampleTemplate}
            </pre>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <a
              href={mailtoUrl}
              className="btn-primary-sharp inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-white"
            >
              <Mail className="h-3.5 w-3.5" />
              <span>Open in Email Client</span>
            </a>

            <a
              href={gmailUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary-sharp inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-[#DFDFDE] hover:text-white"
            >
              <span>Open in Web Gmail</span>
            </a>
          </div>
        </div>

        {/* Frequently Asked Questions */}
        <div className="space-y-3 border-t border-zinc-800 pt-2">
          <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#DFDFDE]">
            <HelpCircle className="h-4 w-4 text-[#3B82F6]" />
            <span>Frequently Asked Questions</span>
          </h2>

          <div className="space-y-3 text-xs">
            <div className="space-y-1 border border-zinc-850 bg-zinc-950/40 p-3.5">
              <div className="font-semibold text-white">Where do I find the Certificate Code?</div>
              <p className="leading-relaxed text-zinc-400">
                The certificate code was announced and displayed during the live event session or
                shared via the official event communication channel.
              </p>
            </div>

            <div className="space-y-1 border border-zinc-850 bg-zinc-950/40 p-3.5">
              <div className="font-semibold text-white">
                Why does it say &ldquo;Certificate Code has Expired&rdquo;?
              </div>
              <p className="leading-relaxed text-zinc-400">
                Event organizers set a validity window for certificate claims. If the deadline has
                passed, please contact the organizing team to request an extension.
              </p>
            </div>

            <div className="space-y-1 border border-zinc-850 bg-zinc-950/40 p-3.5">
              <div className="font-semibold text-white">How long is the download link valid?</div>
              <p className="leading-relaxed text-zinc-400">
                For security reasons, generated download URLs are temporary and valid for 5 minutes.
                You can re-verify at any time to generate a fresh link.
              </p>
            </div>
          </div>
        </div>

        {/* Organization Contact */}
        <div className="flex flex-col items-center justify-between gap-3 border-t border-zinc-800 pt-2 font-mono text-xs text-zinc-500 sm:flex-row">
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-zinc-400" />
            <span>Response Time: Typically 24-48 hours</span>
          </div>
          <a
            href={getOrgUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-zinc-400 transition-colors hover:text-white"
          >
            <Globe className="h-3.5 w-3.5 text-[#3B82F6]" />
            <span>{getOrgDomain()}</span>
          </a>
        </div>
      </div>
    </div>
  );
};
