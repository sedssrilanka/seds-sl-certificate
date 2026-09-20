// Supabase Edge Function: verify-certificate
// Handles secure participant verification and short-lived signed URL generation
// Deploy with: supabase functions deploy verify-certificate --no-verify-jwt

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface VerifyRequest {
  event_slug?: string;
  email?: string;
  certificate_code?: string;
}

// Helper: Calculate SHA-256 hex string
async function sha256Hex(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(data));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, message: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables");
      return new Response(
        JSON.stringify({
          success: false,
          message: "Internal server configuration error. Please contact administrator.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Admin Supabase Client with Service Role Key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });

    const body: VerifyRequest = await req.json();
    const { event_slug, email, certificate_code } = body;

    if (!email || !certificate_code || !event_slug) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Please provide your email address, event slug, and certificate code.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Normalize inputs
    const normalizedEmail = email.toLowerCase().trim();
    const trimmedCode = certificate_code.trim();

    // 2. Client IP & User Agent for rate limiting and audit logging
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown-ip";
    const userAgent = req.headers.get("user-agent") || "unknown-ua";
    const ipHash = await sha256Hex(clientIp);

    // 3. Call Postgres verification procedure
    const { data: verificationResult, error: rpcError } = await supabaseAdmin.rpc(
      "verify_certificate_claim",
      {
        p_event_slug: event_slug,
        p_email: normalizedEmail,
        p_submitted_code: trimmedCode,
        p_ip_hash: ipHash,
        p_user_agent: userAgent,
      }
    );

    if (rpcError) {
      console.error("RPC Error during verification:", rpcError);
      return new Response(
        JSON.stringify({
          success: false,
          message: "Unable to verify your certificate. Please check your email and certificate code.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!verificationResult || !verificationResult.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error_code: verificationResult?.error_code || "VERIFICATION_FAILED",
          message:
            verificationResult?.message ||
            "Unable to verify your certificate. Please check your email and certificate code.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Verification Succeeded! Generate short-lived signed URL (300 seconds / 5 min)
    let signedUrl = "";
    const sanitizedEmail = normalizedEmail.replace(/[@.]/g, '_');
    const candidatePaths = [
      verificationResult.certificate_path,
      `Certificate - ${sanitizedEmail}.pdf`,
      `Certificate - ${sanitizedEmail}`,
      `events/${event_slug}/Certificate - ${sanitizedEmail}.pdf`,
      `events/${event_slug}/${normalizedEmail}.pdf`,
    ].filter(Boolean) as string[];

    for (const path of candidatePaths) {
      const { data: signedData, error: signError } = await supabaseAdmin.storage
        .from("certificates")
        .createSignedUrl(path, 300); // 5 minutes expiry

      if (!signError && signedData?.signedUrl) {
        signedUrl = signedData.signedUrl;
        break;
      }
    }

    if (!signedUrl) {
      console.warn("Certificate file not found under candidate paths for:", normalizedEmail);
      return new Response(
        JSON.stringify({
          success: false,
          message: "Certificate verified, but certificate file was not found in storage. Please contact event organizers.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Return success payload
    return new Response(
      JSON.stringify({
        success: true,
        participant_name: verificationResult.participant_name,
        registration_id: verificationResult.registration_id,
        event_name: verificationResult.event_name,
        download_url: signedUrl,
        expires_in_seconds: 300,
        already_claimed: verificationResult.already_claimed,
        message: `Your certificate has been verified for ${verificationResult.event_name}.`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error in verify-certificate:", error);
    return new Response(
      JSON.stringify({
        success: false,
        message: "An unexpected error occurred. Please try again later.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
