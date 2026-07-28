import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { redact } from "@/lib/audit/redact";
import type { Json } from "@/lib/supabase/database.types";

export type AuditEventType =
  | "login_success"
  | "login_failure"
  | "mfa_enrolled"
  | "mfa_unenrolled"
  | "mfa_challenge_failed"
  | "session_revoked"
  | "sessions_revoked_all"
  | "institution_connected"
  | "institution_disconnected"
  | "export_requested"
  | "data_deletion_requested"
  | "security_setting_changed"
  | "authorization_denied"
  | "sync_failure";

/**
 * The single place security-relevant events get written. Routing every
 * call through here means the redaction pass can't be skipped by accident
 * at an individual call site.
 */
export async function writeAuditEvent(params: {
  userId: string | null;
  eventType: AuditEventType;
  eventData?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
}) {
  const admin = createAdminClient();
  const { error } = await admin.from("audit_events").insert({
    user_id: params.userId,
    event_type: params.eventType,
    event_data: redact(params.eventData ?? {}) as Json,
    ip: params.ip ?? null,
    user_agent: params.userAgent ?? null,
  });

  if (error) {
    // Audit logging must never crash the caller's request, but a failure
    // here is itself worth knowing about during operation.
    console.error("Failed to write audit event", { eventType: params.eventType, message: error.message });
  }
}

export async function writeLoginEvent(params: {
  userId: string | null;
  email: string;
  success: boolean;
  failureReason?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}) {
  const admin = createAdminClient();
  const { error } = await admin.from("login_events").insert({
    user_id: params.userId,
    email: params.email,
    success: params.success,
    failure_reason: params.failureReason ?? null,
    ip: params.ip ?? null,
    user_agent: params.userAgent ?? null,
  });

  if (error) {
    console.error("Failed to write login event", { message: error.message });
  }
}
