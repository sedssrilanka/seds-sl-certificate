/**
 * Cryptographic, timezone and string utility functions
 */

export const SL_TIMEZONE = 'Asia/Colombo';
export const SL_OFFSET_MINUTES = 330; // +05:30 = 330 minutes

/**
 * Computes SHA-256 hex string using browser native Web Crypto API
 */
export async function sha256Hex(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text.trim());
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Normalizes email address for consistent matching
 */
export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Generates standard certificate filename format from email by replacing '@' and '.' with '_':
 * e.g., "achinthyachandeepanie@gmail.com" -> "Certificate - achinthyachandeepanie_gmail_com.pdf"
 */
export function getSanitizedEmailCertificatePath(email: string, _eventSlug?: string): string {
  const norm = normalizeEmail(email);
  const sanitized = norm.replace(/[@.]/g, '_');
  return `Certificate - ${sanitized}.pdf`;
}

/**
 * Masks email address for secure UI display (e.g., j***n@example.com)
 * Complies with secure web skill PII masking guidelines.
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '***';
  const [local, domain] = email.split('@');
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

/**
 * Formats ISO date to readable string in Sri Lanka Standard Time (UTC+05:30)
 */
export function formatSLST(isoString: string | Date | null | undefined): string {
  if (!isoString) return 'N/A';
  try {
    const date = typeof isoString === 'string' ? new Date(isoString) : isoString;
    return (
      new Intl.DateTimeFormat('en-US', {
        timeZone: SL_TIMEZONE,
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }).format(date) + ' (SLST / +05:30)'
    );
  } catch {
    return String(isoString);
  }
}

/**
 * Formats ISO date to readable string in user's local browser timezone
 */
export function formatDateTime(isoString: string | null | undefined): string {
  if (!isoString) return 'N/A';
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    return isoString;
  }
}

/**
 * Formats ISO date showing both SLST (+05:30) and User's Local Time (if different)
 */
export function formatDualTimezone(isoString: string | Date | null | undefined): {
  slst: string;
  local: string;
  isSameTimezone: boolean;
} {
  if (!isoString) {
    return { slst: 'N/A', local: 'N/A', isSameTimezone: true };
  }
  try {
    const date = typeof isoString === 'string' ? new Date(isoString) : isoString;
    const slst =
      new Intl.DateTimeFormat('en-US', {
        timeZone: SL_TIMEZONE,
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).format(date) + ' SLST (+05:30)';

    const local = new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short',
    }).format(date);

    // Check if user is in +05:30
    const userOffset = -new Date().getTimezoneOffset();
    const isSameTimezone = userOffset === SL_OFFSET_MINUTES;

    return { slst, local, isSameTimezone };
  } catch {
    return { slst: String(isoString), local: String(isoString), isSameTimezone: true };
  }
}

/**
 * Converts UTC ISO string from DB to Sri Lanka Time string for <input type="datetime-local">
 * Example: "2026-09-20T10:20:00.000Z" -> "2026-09-20T15:50"
 */
export function isoToSLSTInputValue(isoString: string | null | undefined): string {
  if (!isoString) return '';
  try {
    const utcMs = new Date(isoString).getTime();
    if (isNaN(utcMs)) return '';
    const slstMs = utcMs + SL_OFFSET_MINUTES * 60 * 1000;
    return new Date(slstMs).toISOString().slice(0, 16);
  } catch {
    return '';
  }
}

/**
 * Converts a Sri Lanka Time string from <input type="datetime-local"> to standard UTC ISO string for DB
 * Example: "2026-09-20T15:50" -> "2026-09-20T10:20:00.000Z"
 */
export function slstInputValueToIso(inputValue: string | null | undefined): string | null {
  if (!inputValue || !inputValue.trim()) return null;
  try {
    const trimmed = inputValue.trim();
    // If it's in format "YYYY-MM-DDTHH:mm", attach +05:30 suffix
    const withSuffix =
      trimmed.length === 16
        ? `${trimmed}:00+05:30`
        : trimmed.includes('+')
          ? trimmed
          : `${trimmed}+05:30`;
    const date = new Date(withSuffix);
    if (isNaN(date.getTime())) return null;
    return date.toISOString();
  } catch {
    return null;
  }
}

/**
 * Formats a Date object to Sri Lanka Time string for <input type="datetime-local">
 */
export function dateToSLSTInputValue(date: Date): string {
  const utcMs = date.getTime();
  const slstMs = utcMs + SL_OFFSET_MINUTES * 60 * 1000;
  return new Date(slstMs).toISOString().slice(0, 16);
}

/**
 * Calculates a specific target in Sri Lanka Time (+05:30) and returns the standard UTC Date
 */
export function calculateSLSTTarget(target: 'midnight' | 'noon' | 'end_of_week'): Date {
  // Current time in UTC millis
  const nowUtc = Date.now();
  // Current time shifted to SLST (+5:30 = 330 mins)
  const slstOffsetMs = SL_OFFSET_MINUTES * 60 * 1000;
  const slstNow = new Date(nowUtc + slstOffsetMs);

  const slstYear = slstNow.getUTCFullYear();
  const slstMonth = slstNow.getUTCMonth();
  const slstDate = slstNow.getUTCDate();
  const slstDay = slstNow.getUTCDay();

  let targetDate = slstDate;
  let targetHour = 23;
  let targetMinute = 59;
  let targetSecond = 0;

  if (target === 'midnight') {
    targetHour = 23;
    targetMinute = 59;
    targetSecond = 0;
  } else if (target === 'noon') {
    targetDate = slstDate + 1;
    targetHour = 12;
    targetMinute = 0;
    targetSecond = 0;
  } else if (target === 'end_of_week') {
    const daysUntilSunday = (7 - slstDay) % 7 || 7;
    targetDate = slstDate + daysUntilSunday;
    targetHour = 23;
    targetMinute = 59;
    targetSecond = 0;
  }

  // Create UTC representation of SLST target, then subtract offset to get true UTC
  const targetSlstTime = Date.UTC(
    slstYear,
    slstMonth,
    targetDate,
    targetHour,
    targetMinute,
    targetSecond
  );
  return new Date(targetSlstTime - slstOffsetMs);
}

/**
 * Gets the configured base public application URL.
 * Prefers VITE_APP_URL or VITE_PUBLIC_APP_URL, falling back to window.location.origin or https://cert.sedssl.org
 */
export function getAppBaseUrl(): string {
  const envUrl = import.meta.env.VITE_APP_URL || import.meta.env.VITE_PUBLIC_APP_URL;
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin;
  }
  return 'https://cert.sedssl.org';
}

/**
 * Gets clean base domain without protocol (e.g. "cert.sedssl.org" or "localhost:3000")
 */
export function getAppBaseDomain(): string {
  const url = getAppBaseUrl();
  return url.replace(/^https?:\/\//, '').replace(/\/+$/, '');
}

/**
 * Gets full public URL for an event
 */
export function getEventPortalUrl(slug: string): string {
  const base = getAppBaseUrl();
  const cleanSlug = (slug || '').replace(/^\/+/, '');
  return `${base}/${cleanSlug}`;
}

/**
 * Gets the configured base organization website URL.
 * Prefers VITE_ORG_URL or VITE_PUBLIC_ORG_URL, falling back to https://sedssl.org
 */
export function getOrgUrl(): string {
  const envUrl = import.meta.env.VITE_ORG_URL || import.meta.env.VITE_PUBLIC_ORG_URL;
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '');
  }
  return 'https://sedssl.org';
}

/**
 * Gets clean base organization domain without protocol (e.g. "sedssl.org")
 */
export function getOrgDomain(): string {
  const url = getOrgUrl();
  return url.replace(/^https?:\/\//, '').replace(/\/+$/, '');
}
