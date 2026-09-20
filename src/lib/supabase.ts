import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  Event,
  Participant,
  CertificateClaim,
  VerificationResponse,
  DashboardStats,
  CsvParticipantRow,
} from '../types';
import { sha256Hex, normalizeEmail, getSanitizedEmailCertificatePath } from './crypto';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured =
  Boolean(supabaseUrl) &&
  Boolean(supabaseAnonKey) &&
  !supabaseUrl.includes('your-project') &&
  !supabaseAnonKey.includes('your-anon-key');

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// ==============================================================================
// LOCAL STORAGE MOCK DATA ENGINE (MULTI-EVENT DEMO & DEV)
// ==============================================================================

const MOCK_STORAGE_KEY_EVENTS = 'seds_platform_events_v2';
const MOCK_STORAGE_KEY_PARTICIPANTS = 'seds_platform_participants_v2';
const MOCK_STORAGE_KEY_CLAIMS = 'seds_platform_claims_v2';

// SHA-256 for 'IOTM26-X7K9Q': 4beea058c42a5d2eb7b8c8d8b94ce50aa4d59f72db725c89ee4a4c64feeb0580
// SHA-256 for 'SEDS26-SPACE': 5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8
const DEFAULT_EVENTS: Event[] = [
  {
    id: 'e0000000-0000-0000-0000-000000000001',
    name: 'International Observe the Moon Night 2026',
    slug: 'imot',
    description: 'Official certificate distribution for attendees of the live broadcast.',
    certificate_code_hash: '4beea058c42a5d2eb7b8c8d8b94ce50aa4d59f72db725c89ee4a4c64feeb0580',
    certificate_enabled: true,
    code_expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
  },
  {
    id: 'e0000000-0000-0000-0000-000000000002',
    name: 'SEDS Sri Lanka Space Exploration Summit 2026',
    slug: 'space-summit',
    description: 'Participation verification for the annual national space symposium.',
    certificate_code_hash: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
    certificate_enabled: true,
    code_expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

const DEFAULT_PARTICIPANTS: Participant[] = [
  {
    id: 'p0000000-0000-0000-0000-000000000001',
    event_id: 'e0000000-0000-0000-0000-000000000001',
    name: 'John Silva',
    email: 'john@example.com',
    registration_id: 'SEDS-001',
    eligible: true,
    certificate_path: 'events/imot/john-silva.pdf',
    certificate_claimed: false,
    claimed_at: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 'p0000000-0000-0000-0000-000000000002',
    event_id: 'e0000000-0000-0000-0000-000000000001',
    name: 'Sarah Perera',
    email: 'sarah@example.com',
    registration_id: 'SEDS-002',
    eligible: false,
    certificate_path: null,
    certificate_claimed: false,
    claimed_at: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 'p0000000-0000-0000-0000-000000000003',
    event_id: 'e0000000-0000-0000-0000-000000000001',
    name: 'Kasun Fernando',
    email: 'kasun@example.com',
    registration_id: 'SEDS-003',
    eligible: true,
    certificate_path: 'events/imot/kasun-fernando.pdf',
    certificate_claimed: false,
    claimed_at: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 'p0000000-0000-0000-0000-000000000004',
    event_id: 'e0000000-0000-0000-0000-000000000002',
    name: 'John Silva',
    email: 'john@example.com',
    registration_id: 'SUMMIT-101',
    eligible: true,
    certificate_path: 'events/space-summit/john-silva.pdf',
    certificate_claimed: false,
    claimed_at: null,
    created_at: new Date().toISOString(),
  },
];

function getStoredMockEvents(): Event[] {
  try {
    const raw = localStorage.getItem(MOCK_STORAGE_KEY_EVENTS);
    if (!raw) {
      localStorage.setItem(MOCK_STORAGE_KEY_EVENTS, JSON.stringify(DEFAULT_EVENTS));
      return DEFAULT_EVENTS;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_EVENTS;
  }
}

function saveStoredMockEvents(events: Event[]) {
  localStorage.setItem(MOCK_STORAGE_KEY_EVENTS, JSON.stringify(events));
}

function getStoredMockParticipants(): Participant[] {
  try {
    const raw = localStorage.getItem(MOCK_STORAGE_KEY_PARTICIPANTS);
    if (!raw) {
      localStorage.setItem(MOCK_STORAGE_KEY_PARTICIPANTS, JSON.stringify(DEFAULT_PARTICIPANTS));
      return DEFAULT_PARTICIPANTS;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_PARTICIPANTS;
  }
}

function saveStoredMockParticipants(participants: Participant[]) {
  localStorage.setItem(MOCK_STORAGE_KEY_PARTICIPANTS, JSON.stringify(participants));
}

function getStoredMockClaims(): CertificateClaim[] {
  try {
    const raw = localStorage.getItem(MOCK_STORAGE_KEY_CLAIMS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStoredMockClaims(claims: CertificateClaim[]) {
  localStorage.setItem(MOCK_STORAGE_KEY_CLAIMS, JSON.stringify(claims));
}

// ==============================================================================
// PUBLIC API: CERTIFICATE VERIFICATION & EVENT DISCOVERY
// ==============================================================================

export async function getAllPublicEvents(): Promise<Event[]> {
  if (supabase && isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('events')
      .select('id, name, slug, description, certificate_enabled, code_expires_at, created_at')
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data.map((ev) => ({ ...ev, certificate_code_hash: '' }));
  }
  return getStoredMockEvents().map((ev) => ({ ...ev, certificate_code_hash: '' }));
}

export async function getPublicEvent(slug: string): Promise<Event | null> {
  const normalizedSlug = slug.toLowerCase().trim();
  if (supabase && isSupabaseConfigured) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      normalizedSlug
    );
    let query = supabase
      .from('events')
      .select('id, name, slug, description, certificate_enabled, code_expires_at, created_at');

    if (isUuid) {
      query = query.or(`slug.eq.${normalizedSlug},id.eq.${normalizedSlug}`);
    } else {
      query = query.eq('slug', normalizedSlug);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error('getPublicEvent query error:', error);
      return null;
    }
    if (!data) return null;
    return {
      ...data,
      certificate_code_hash: '',
    };
  }

  const events = getStoredMockEvents();
  return (
    events.find(
      (e) =>
        e.slug.toLowerCase() === normalizedSlug ||
        e.id === normalizedSlug ||
        (normalizedSlug === 'imot' && e.slug.includes('moon')) ||
        (normalizedSlug.includes('moon') && e.slug === 'imot')
    ) || null
  );
}


export async function verifyCertificate(
  eventSlug: string,
  email: string,
  certificateCode: string
): Promise<VerificationResponse> {
  const normalizedEmail = normalizeEmail(email);
  const trimmedCode = certificateCode.trim();
  const normalizedSlug = eventSlug.toLowerCase().trim();

  // If live Supabase is configured
  if (supabase && isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.functions.invoke('verify-certificate', {
        body: {
          event_slug: normalizedSlug,
          email: normalizedEmail,
          certificate_code: trimmedCode,
        },
      });

      if (!error && data && data.success && data.download_url) {
        return data as VerificationResponse;
      }
      // Fallback to direct client RPC and deep storage resolution
      return await verifyViaRpc(normalizedSlug, normalizedEmail, trimmedCode);
    } catch (edgeError) {
      console.warn('Edge function invoke fallback to RPC:', edgeError);
      return await verifyViaRpc(normalizedSlug, normalizedEmail, trimmedCode);
    }
  }

  // Local / Demo Engine
  await new Promise((resolve) => setTimeout(resolve, 400));

  const events = getStoredMockEvents();
  const event = events.find(
    (e) =>
      e.slug.toLowerCase() === normalizedSlug ||
      e.id === normalizedSlug ||
      (normalizedSlug === 'imot' && e.slug.includes('moon')) ||
      (normalizedSlug.includes('moon') && e.slug === 'imot')
  );

  if (!event) {
    return {
      success: false,
      message: 'Unable to verify certificate. Please check your email and certificate code.',
    };
  }

  if (!event.certificate_enabled) {
    return {
      success: false,
      message: 'Certificate claiming is currently disabled for this event.',
    };
  }

  if (event.code_expires_at && new Date() > new Date(event.code_expires_at)) {
    return {
      success: false,
      message: 'The certificate code for this event has expired.',
    };
  }

  const codeHash = await sha256Hex(trimmedCode);
  if (codeHash.toLowerCase() !== event.certificate_code_hash.toLowerCase()) {
    return {
      success: false,
      message: 'Unable to verify certificate. Please check your email and certificate code.',
    };
  }

  const participants = getStoredMockParticipants();
  const participantIndex = participants.findIndex(
    (p) => p.event_id === event.id && normalizeEmail(p.email) === normalizedEmail
  );

  if (participantIndex === -1) {
    return {
      success: false,
      message: 'Unable to verify certificate. Please check your email and certificate code.',
    };
  }

  const participant = participants[participantIndex];
  if (!participant.eligible) {
    return {
      success: false,
      message: 'Unable to verify certificate. Please check your email and certificate code.',
    };
  }

  // Update claim status
  participants[participantIndex] = {
    ...participant,
    certificate_claimed: true,
    claimed_at: new Date().toISOString(),
  };
  saveStoredMockParticipants(participants);

  // Record audit claim
  const claims = getStoredMockClaims();
  const newClaim: CertificateClaim = {
    id: `claim-${Date.now()}`,
    event_id: event.id,
    participant_id: participant.id,
    email: normalizedEmail,
    claimed_at: new Date().toISOString(),
    ip_hash: await sha256Hex('127.0.0.1'),
    user_agent: navigator.userAgent,
    participant: {
      name: participant.name,
      registration_id: participant.registration_id,
    },
  };
  claims.unshift(newClaim);
  saveStoredMockClaims(claims);

  return {
    success: true,
    participant_name: participant.name,
    registration_id: participant.registration_id,
    event_name: event.name,
    download_url: '/sample-certificate.pdf',
    expires_in_seconds: 300,
    already_claimed: participant.certificate_claimed,
    message: `Certificate verified for ${event.name}.`,
  };
}

async function verifyViaRpc(
  eventSlug: string,
  email: string,
  certificateCode: string
): Promise<VerificationResponse> {
  if (!supabase) throw new Error('Supabase client not initialized');

  const { data, error } = await supabase.rpc('verify_certificate_claim', {
    p_event_slug: eventSlug,
    p_email: email,
    p_submitted_code: certificateCode,
    p_ip_hash: null,
    p_user_agent: navigator.userAgent,
  });

  if (error || !data || !data.success) {
    return {
      success: false,
      message:
        data?.message ||
        'Unable to verify certificate. Please check your email and certificate code.',
    };
  }

  let downloadUrl = '';
  const sanitized = normalizeEmail(email).replace(/[@.]/g, '_');
  const userPrefix = normalizeEmail(email).split('@')[0];
  const candidatePaths = [
    data.certificate_path,
    `Certificate - ${sanitized}.pdf`,
    `Certificate - ${sanitized}`,
    `Certificate - ${email}.pdf`,
    `Certificate - ${email}`,
    `events/${eventSlug}/Certificate - ${sanitized}.pdf`,
    `events/${eventSlug}/Certificate - ${email}.pdf`,
    `events/${eventSlug}/${sanitized}.pdf`,
    `events/${eventSlug}/${email}.pdf`,
    `${sanitized}.pdf`,
    `${email}.pdf`,
  ].filter(Boolean) as string[];

  if (supabase) {
    // 1. Try candidate paths directly
    for (const path of candidatePaths) {
      try {
        const { data: signedData, error: signError } = await supabase.storage
          .from('certificates')
          .createSignedUrl(path, 300);
        if (!signError && signedData?.signedUrl) {
          downloadUrl = signedData.signedUrl;
          break;
        }
      } catch {
        // try next candidate path
      }
    }

    // 2. If not found via direct path, search the root certificates bucket
    if (!downloadUrl) {
      try {
        const { data: fileList } = await supabase.storage.from('certificates').list();
        if (fileList && fileList.length > 0) {
          const matched = fileList.find((f) => {
            const lower = f.name.toLowerCase();
            return (
              lower === `certificate - ${sanitized}.pdf`.toLowerCase() ||
              lower.includes(sanitized) ||
              lower.includes(userPrefix)
            );
          });
          if (matched) {
            const { data: sData } = await supabase.storage
              .from('certificates')
              .createSignedUrl(matched.name, 300);
            if (sData?.signedUrl) {
              downloadUrl = sData.signedUrl;
            }
          }
        }
      } catch (e) {
        console.warn('Bucket list search fallback:', e);
      }
    }

    // 3. Search events/{slug}/ folder if applicable
    if (!downloadUrl && eventSlug) {
      try {
        const { data: subFileList } = await supabase.storage
          .from('certificates')
          .list(`events/${eventSlug}`);
        if (subFileList && subFileList.length > 0) {
          const matched = subFileList.find((f) => {
            const lower = f.name.toLowerCase();
            return (
              lower === `certificate - ${sanitized}.pdf`.toLowerCase() ||
              lower.includes(sanitized) ||
              lower.includes(userPrefix)
            );
          });
          if (matched) {
            const { data: sData } = await supabase.storage
              .from('certificates')
              .createSignedUrl(`events/${eventSlug}/${matched.name}`, 300);
            if (sData?.signedUrl) {
              downloadUrl = sData.signedUrl;
            }
          }
        }
      } catch (e) {
        console.warn('Subfolder search fallback:', e);
      }
    }
  }

  return {
    success: true,
    participant_name: data.participant_name,
    registration_id: data.registration_id,
    event_name: data.event_name,
    download_url: downloadUrl || '',
    expires_in_seconds: 300,
    already_claimed: data.already_claimed,
    message: `Certificate verified for ${data.event_name}.`,
  };
}

// ==============================================================================
// ADMIN DASHBOARD DATA & ACTIONS
// ==============================================================================

export async function getAdminEvents(): Promise<Event[]> {
  if (supabase && isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: false });
    return error ? [] : data || [];
  }
  return getStoredMockEvents();
}

export async function createEvent(eventData: {
  name: string;
  slug: string;
  description?: string;
  certificate_code: string;
  certificate_enabled: boolean;
  code_expires_at?: string | null;
}): Promise<{ success: boolean; event?: Event; message?: string }> {
  const codeHash = await sha256Hex(eventData.certificate_code.trim());
  const slug = eventData.slug.toLowerCase().trim().replace(/\s+/g, '-');

  if (supabase && isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('events')
      .insert({
        name: eventData.name.trim(),
        slug,
        description: eventData.description?.trim() || null,
        certificate_code_hash: codeHash,
        certificate_enabled: eventData.certificate_enabled,
        code_expires_at: eventData.code_expires_at || null,
      })
      .select()
      .single();

    if (error) {
      return { success: false, message: error.message };
    }
    return { success: true, event: data };
  }

  const events = getStoredMockEvents();
  const existing = events.find((e) => e.slug === slug);
  if (existing) {
    return { success: false, message: 'An event with this slug already exists.' };
  }

  const newEvent: Event = {
    id: `e-${Date.now()}`,
    name: eventData.name.trim(),
    slug,
    description: eventData.description?.trim() || null,
    certificate_code_hash: codeHash,
    certificate_enabled: eventData.certificate_enabled,
    code_expires_at: eventData.code_expires_at || null,
    created_at: new Date().toISOString(),
  };

  events.unshift(newEvent);
  saveStoredMockEvents(events);
  return { success: true, event: newEvent };
}

export async function updateEventSettings(
  id: string,
  updates: {
    name?: string;
    slug?: string;
    description?: string | null;
    certificate_code?: string;
    certificate_enabled?: boolean;
    code_expires_at?: string | null;
  }
): Promise<boolean> {
  let hashUpdate: string | undefined;
  if (updates.certificate_code) {
    hashUpdate = await sha256Hex(updates.certificate_code.trim());
  }

  if (supabase && isSupabaseConfigured) {
    const dbUpdates: Record<string, unknown> = {
      ...(updates.name && { name: updates.name }),
      ...(updates.slug && { slug: updates.slug }),
      ...(updates.description !== undefined && { description: updates.description }),
      ...(updates.certificate_enabled !== undefined && {
        certificate_enabled: updates.certificate_enabled,
      }),
      ...(updates.code_expires_at !== undefined && { code_expires_at: updates.code_expires_at }),
      ...(hashUpdate && { certificate_code_hash: hashUpdate }),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('events').update(dbUpdates).eq('id', id);
    return !error;
  }

  const events = getStoredMockEvents();
  const index = events.findIndex((e) => e.id === id);
  if (index === -1) return false;

  events[index] = {
    ...events[index],
    ...(updates.name && { name: updates.name }),
    ...(updates.slug && { slug: updates.slug }),
    ...(updates.description !== undefined && { description: updates.description }),
    ...(updates.certificate_enabled !== undefined && {
      certificate_enabled: updates.certificate_enabled,
    }),
    ...(updates.code_expires_at !== undefined && { code_expires_at: updates.code_expires_at }),
    ...(hashUpdate && { certificate_code_hash: hashUpdate }),
  };
  saveStoredMockEvents(events);
  return true;
}

export async function getParticipants(
  eventId: string,
  search?: string,
  filter?: 'all' | 'eligible' | 'ineligible' | 'claimed' | 'unclaimed'
): Promise<Participant[]> {
  if (supabase && isSupabaseConfigured) {
    let query = supabase
      .from('participants')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    if (search) {
      const term = `%${search.trim()}%`;
      query = query.or(`name.ilike.${term},email.ilike.${term},registration_id.ilike.${term}`);
    }

    if (filter === 'eligible') query = query.eq('eligible', true);
    if (filter === 'ineligible') query = query.eq('eligible', false);
    if (filter === 'claimed') query = query.eq('certificate_claimed', true);
    if (filter === 'unclaimed') query = query.eq('certificate_claimed', false);

    const { data, error } = await query;
    return error ? [] : data || [];
  }

  let list = getStoredMockParticipants().filter((p) => p.event_id === eventId);

  if (search) {
    const s = search.toLowerCase().trim();
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(s) ||
        p.email.toLowerCase().includes(s) ||
        (p.registration_id && p.registration_id.toLowerCase().includes(s))
    );
  }

  if (filter === 'eligible') list = list.filter((p) => p.eligible);
  if (filter === 'ineligible') list = list.filter((p) => !p.eligible);
  if (filter === 'claimed') list = list.filter((p) => p.certificate_claimed);
  if (filter === 'unclaimed') list = list.filter((p) => !p.certificate_claimed);

  return list;
}

export async function toggleParticipantEligibility(
  id: string,
  eligible: boolean
): Promise<boolean> {
  if (supabase && isSupabaseConfigured) {
    const { error } = await supabase.from('participants').update({ eligible }).eq('id', id);
    return !error;
  }

  const participants = getStoredMockParticipants();
  const index = participants.findIndex((p) => p.id === id);
  if (index === -1) return false;

  participants[index].eligible = eligible;
  saveStoredMockParticipants(participants);
  return true;
}

export async function deleteParticipant(id: string): Promise<boolean> {
  if (supabase && isSupabaseConfigured) {
    const { error } = await supabase.from('participants').delete().eq('id', id);
    return !error;
  }

  const participants = getStoredMockParticipants().filter((p) => p.id !== id);
  saveStoredMockParticipants(participants);
  return true;
}

export async function addParticipant(
  eventId: string,
  participant: Omit<
    Participant,
    'id' | 'event_id' | 'certificate_claimed' | 'claimed_at' | 'created_at'
  >
): Promise<{ success: boolean; message?: string }> {
  const normEmail = normalizeEmail(participant.email);
  const events = getStoredMockEvents();
  const event = events.find((e) => e.id === eventId);
  const eventSlug = event?.slug || 'event';

  const autoRegId =
    participant.registration_id?.trim() ||
    `SEDS-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

  const autoCertPath =
    participant.certificate_path?.trim() || getSanitizedEmailCertificatePath(normEmail, eventSlug);

  const newRecord: Participant = {
    id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    event_id: eventId,
    name: participant.name.trim(),
    email: normEmail,
    registration_id: autoRegId,
    eligible: participant.eligible !== undefined ? Boolean(participant.eligible) : true,
    certificate_path: autoCertPath,
    certificate_claimed: false,
    claimed_at: null,
    created_at: new Date().toISOString(),
  };

  if (supabase && isSupabaseConfigured) {
    const { error } = await supabase.from('participants').insert({
      event_id: eventId,
      name: newRecord.name,
      email: newRecord.email,
      registration_id: newRecord.registration_id,
      eligible: newRecord.eligible,
      certificate_path: newRecord.certificate_path,
    });

    if (error) {
      return { success: false, message: error.message };
    }
    return { success: true };
  }

  const participants = getStoredMockParticipants();
  const existing = participants.find(
    (p) => p.event_id === eventId && normalizeEmail(p.email) === newRecord.email
  );

  if (existing) {
    return {
      success: false,
      message: 'A participant with this email already exists for this event.',
    };
  }

  participants.unshift(newRecord);
  saveStoredMockParticipants(participants);
  return { success: true };
}

export async function importParticipantsCSV(
  eventId: string,
  rows: CsvParticipantRow[]
): Promise<{ inserted: number; updated: number; failed: number }> {
  let inserted = 0;
  let updated = 0;
  let failed = 0;

  // Retrieve event slug for auto-generating certificate paths
  let eventSlug = 'event';
  if (supabase && isSupabaseConfigured) {
    const { data: evData } = await supabase
      .from('events')
      .select('slug')
      .eq('id', eventId)
      .maybeSingle();
    if (evData?.slug) {
      eventSlug = evData.slug;
    }
  } else {
    const events = getStoredMockEvents();
    const ev = events.find((e) => e.id === eventId);
    if (ev?.slug) eventSlug = ev.slug;
  }

  if (supabase && isSupabaseConfigured) {
    const validRowsToUpsert = [];

    for (const row of rows) {
      if (!row.email || !row.name) {
        failed++;
        continue;
      }
      const normEmail = normalizeEmail(row.email);
      const eligibleBool =
        row.eligible !== undefined
          ? typeof row.eligible === 'boolean'
            ? row.eligible
            : String(row.eligible).toLowerCase() === 'true' || String(row.eligible) === '1'
          : true;

      const regId =
        row.registration_id?.trim() ||
        `SEDS-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

      const certPath =
        row.certificate_path?.trim() || getSanitizedEmailCertificatePath(normEmail, eventSlug);

      validRowsToUpsert.push({
        event_id: eventId,
        name: row.name.trim(),
        email: normEmail,
        registration_id: regId,
        eligible: eligibleBool,
        certificate_path: certPath,
      });
    }

    // Process in batches of 100 for high performance
    const BATCH_SIZE = 100;
    for (let i = 0; i < validRowsToUpsert.length; i += BATCH_SIZE) {
      const batch = validRowsToUpsert.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('participants').upsert(batch, {
        onConflict: 'event_id,email',
      });

      if (error) {
        console.error('Batch import error:', error);
        failed += batch.length;
      } else {
        inserted += batch.length;
      }
    }

    return { inserted, updated, failed };
  }

  const participants = getStoredMockParticipants();

  for (const row of rows) {
    if (!row.email || !row.name) {
      failed++;
      continue;
    }

    const normEmail = normalizeEmail(row.email);
    const eligibleBool =
      row.eligible !== undefined
        ? typeof row.eligible === 'boolean'
          ? row.eligible
          : String(row.eligible).toLowerCase() === 'true' || String(row.eligible) === '1'
        : true;

    const existingIndex = participants.findIndex(
      (p) => p.event_id === eventId && normalizeEmail(p.email) === normEmail
    );

    const certPath =
      row.certificate_path?.trim() || getSanitizedEmailCertificatePath(normEmail, eventSlug);

    if (existingIndex >= 0) {
      participants[existingIndex] = {
        ...participants[existingIndex],
        name: row.name.trim(),
        registration_id: row.registration_id?.trim() || participants[existingIndex].registration_id,
        eligible: eligibleBool,
        certificate_path: certPath,
      };
      updated++;
    } else {
      const regId =
        row.registration_id?.trim() ||
        `SEDS-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

      participants.push({
        id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        event_id: eventId,
        name: row.name.trim(),
        email: normEmail,
        registration_id: regId,
        eligible: eligibleBool,
        certificate_path: certPath,
        certificate_claimed: false,
        claimed_at: null,
        created_at: new Date().toISOString(),
      });
      inserted++;
    }
  }

  saveStoredMockParticipants(participants);
  return { inserted, updated, failed };
}

export async function getClaimsAudit(eventId: string): Promise<CertificateClaim[]> {
  if (supabase && isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('certificate_claims')
      .select('*, participant:participants(name, registration_id)')
      .eq('event_id', eventId)
      .order('claimed_at', { ascending: false })
      .limit(100);

    return error ? [] : data || [];
  }

  return getStoredMockClaims().filter((c) => c.event_id === eventId);
}

export async function getDashboardStats(eventId: string): Promise<DashboardStats> {
  const participants = await getParticipants(eventId);
  const totalParticipants = participants.length;
  const eligibleParticipants = participants.filter((p) => p.eligible).length;
  const claimedCertificates = participants.filter((p) => p.certificate_claimed).length;
  const unclaimedCertificates = eligibleParticipants - claimedCertificates;
  const claimRate =
    eligibleParticipants > 0 ? Math.round((claimedCertificates / eligibleParticipants) * 100) : 0;

  return {
    totalParticipants,
    eligibleParticipants,
    claimedCertificates,
    unclaimedCertificates: Math.max(0, unclaimedCertificates),
    claimRate,
  };
}

export function resetMockData() {
  localStorage.setItem(MOCK_STORAGE_KEY_EVENTS, JSON.stringify(DEFAULT_EVENTS));
  localStorage.setItem(MOCK_STORAGE_KEY_PARTICIPANTS, JSON.stringify(DEFAULT_PARTICIPANTS));
  localStorage.removeItem(MOCK_STORAGE_KEY_CLAIMS);
}
