"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptProviderToken, decryptProviderToken } from "@/lib/crypto/token-cipher";
import { writeAuditEvent } from "@/lib/audit/log";
import * as google from "@/lib/calendar/google-client";
import * as microsoft from "@/lib/calendar/microsoft-client";
import * as apple from "@/lib/calendar/apple-client";
import type { NewCalendarEvent } from "@/lib/calendar/types";

const SYNC_WINDOW_DAYS_PAST = 7;
const SYNC_WINDOW_DAYS_FUTURE = 60;

async function getTokenRow(connectionId: string, userId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("encrypted_calendar_tokens")
    .select("*")
    .eq("connection_id", connectionId)
    .eq("user_id", userId)
    .single();
  return data;
}

export async function connectAppleCalendarAction(
  _prevState: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const user = await requireUser();
  const email = String(formData.get("email") ?? "").trim();
  const appPassword = String(formData.get("appPassword") ?? "").trim();

  if (!email || !appPassword) {
    return { error: "Enter your Apple ID email and app-specific password." };
  }

  const isValid = await apple.verifyAppleCredentials(email, appPassword);
  if (!isValid) {
    return { error: "Couldn't connect — check the email and app-specific password." };
  }

  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: connection, error: connectionError } = await supabase
    .from("calendar_connections")
    .insert({
      user_id: user.id,
      provider: "apple",
      provider_account_email: email,
      display_name: `Apple — ${email}`,
      status: "active",
      last_successful_sync_at: new Date().toISOString(),
      last_attempted_sync_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (connectionError || !connection) {
    return { error: "Couldn't save this connection. Try again." };
  }

  const { error: tokenError } = await admin.from("encrypted_calendar_tokens").insert({
    user_id: user.id,
    connection_id: connection.id,
    provider: "apple",
    encrypted_access_token: encryptProviderToken(appPassword),
  });

  if (tokenError) {
    return { error: "Couldn't save this connection. Try again." };
  }

  await writeAuditEvent({
    userId: user.id,
    eventType: "calendar_connected",
    eventData: { provider: "apple", connectionId: connection.id },
  });

  revalidatePath("/schedule");
  return null;
}

export async function syncCalendarConnectionAction(connectionId: string): Promise<{ error: string | null }> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: connection } = await supabase
    .from("calendar_connections")
    .select("id, provider, provider_account_email")
    .eq("id", connectionId)
    .eq("user_id", user.id)
    .single();

  if (!connection) {
    return { error: "Connection not found." };
  }

  const tokenRow = await getTokenRow(connectionId, user.id);
  if (!tokenRow) {
    return { error: "This connection is missing its credentials. Try disconnecting and reconnecting." };
  }

  const now = new Date();
  const rangeStart = new Date(now.getTime() - SYNC_WINDOW_DAYS_PAST * 86_400_000);
  const rangeEnd = new Date(now.getTime() + SYNC_WINDOW_DAYS_FUTURE * 86_400_000);

  try {
    let events;

    if (connection.provider === "google") {
      let accessToken = decryptProviderToken(tokenRow.encrypted_access_token);
      if (tokenRow.access_token_expires_at && new Date(tokenRow.access_token_expires_at) <= now) {
        if (!tokenRow.encrypted_refresh_token) throw new Error("Google token expired with no refresh token.");
        const refreshed = await google.refreshGoogleAccessToken(decryptProviderToken(tokenRow.encrypted_refresh_token));
        accessToken = refreshed.accessToken;
        const admin = createAdminClient();
        await admin
          .from("encrypted_calendar_tokens")
          .update({
            encrypted_access_token: encryptProviderToken(refreshed.accessToken),
            access_token_expires_at: refreshed.expiresAt,
          })
          .eq("id", tokenRow.id);
      }
      events = await google.listGoogleEvents(accessToken, rangeStart.toISOString(), rangeEnd.toISOString());
    } else if (connection.provider === "microsoft") {
      let accessToken = decryptProviderToken(tokenRow.encrypted_access_token);
      if (tokenRow.access_token_expires_at && new Date(tokenRow.access_token_expires_at) <= now) {
        if (!tokenRow.encrypted_refresh_token) throw new Error("Microsoft token expired with no refresh token.");
        const refreshed = await microsoft.refreshMicrosoftAccessToken(
          decryptProviderToken(tokenRow.encrypted_refresh_token),
        );
        accessToken = refreshed.accessToken;
        const admin = createAdminClient();
        await admin
          .from("encrypted_calendar_tokens")
          .update({
            encrypted_access_token: encryptProviderToken(refreshed.accessToken),
            encrypted_refresh_token: refreshed.refreshToken
              ? encryptProviderToken(refreshed.refreshToken)
              : tokenRow.encrypted_refresh_token,
            access_token_expires_at: refreshed.expiresAt,
          })
          .eq("id", tokenRow.id);
      }
      events = await microsoft.listMicrosoftEvents(accessToken, rangeStart.toISOString(), rangeEnd.toISOString());
    } else {
      const appPassword = decryptProviderToken(tokenRow.encrypted_access_token);
      events = await apple.listAppleEvents(connection.provider_account_email ?? "", appPassword, rangeStart, rangeEnd);
    }

    for (const event of events) {
      await supabase.from("synced_calendar_events").upsert(
        {
          user_id: user.id,
          connection_id: connectionId,
          provider_event_id: event.providerEventId,
          title: event.title,
          description: event.description,
          location: event.location,
          start_at: event.startAt,
          end_at: event.endAt,
          all_day: event.allDay,
          source: "sync",
        },
        { onConflict: "connection_id,provider_event_id" },
      );
    }

    await supabase
      .from("calendar_connections")
      .update({
        status: "active",
        last_successful_sync_at: new Date().toISOString(),
        last_attempted_sync_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", connectionId)
      .eq("user_id", user.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown sync error";
    await supabase
      .from("calendar_connections")
      .update({ status: "error", last_attempted_sync_at: new Date().toISOString(), error_message: message })
      .eq("id", connectionId)
      .eq("user_id", user.id);

    await writeAuditEvent({ userId: user.id, eventType: "calendar_sync_failure", eventData: { connectionId } });
    return { error: "Sync failed. Showing the last known events until it succeeds." };
  }

  revalidatePath("/schedule");
  return { error: null };
}

export async function disconnectCalendarConnectionAction(connectionId: string): Promise<{ error: string | null }> {
  const user = await requireUser();
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: connection } = await supabase
    .from("calendar_connections")
    .select("id, provider")
    .eq("id", connectionId)
    .eq("user_id", user.id)
    .single();

  if (!connection) return { error: "Connection not found." };

  const tokenRow = await getTokenRow(connectionId, user.id);
  if (tokenRow && connection.provider === "google") {
    await google.revokeGoogleToken(decryptProviderToken(tokenRow.encrypted_access_token));
  }

  if (tokenRow) {
    await admin.from("encrypted_calendar_tokens").delete().eq("id", tokenRow.id);
  }

  await supabase.from("synced_calendar_events").delete().eq("connection_id", connectionId).eq("user_id", user.id);

  await supabase
    .from("calendar_connections")
    .update({ status: "disconnected", disconnected_at: new Date().toISOString() })
    .eq("id", connectionId)
    .eq("user_id", user.id);

  await writeAuditEvent({
    userId: user.id,
    eventType: "calendar_disconnected",
    eventData: { connectionId, provider: connection.provider },
  });

  revalidatePath("/schedule");
  return { error: null };
}

export async function createEventAction(
  _prevState: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const user = await requireUser();
  const supabase = await createClient();

  const connectionId = String(formData.get("connectionId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const startAt = String(formData.get("startAt") ?? "");
  const endAt = String(formData.get("endAt") ?? "");
  const location = String(formData.get("location") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim() || null;
  const allDay = formData.get("allDay") === "on";

  if (!connectionId || !title || !startAt || !endAt) {
    return { error: "Fill in a title, calendar, and start/end time." };
  }

  const { data: connection } = await supabase
    .from("calendar_connections")
    .select("id, provider, provider_account_email")
    .eq("id", connectionId)
    .eq("user_id", user.id)
    .single();

  if (!connection) {
    return { error: "Pick a connected calendar." };
  }

  const tokenRow = await getTokenRow(connectionId, user.id);
  if (!tokenRow) {
    return { error: "This connection is missing its credentials." };
  }

  const newEvent: NewCalendarEvent = {
    title,
    description,
    location,
    startAt: new Date(startAt).toISOString(),
    endAt: new Date(endAt).toISOString(),
    allDay,
  };

  try {
    let providerEventId: string;

    if (connection.provider === "google") {
      const accessToken = decryptProviderToken(tokenRow.encrypted_access_token);
      providerEventId = await google.createGoogleEvent(accessToken, newEvent);
    } else if (connection.provider === "microsoft") {
      const accessToken = decryptProviderToken(tokenRow.encrypted_access_token);
      providerEventId = await microsoft.createMicrosoftEvent(accessToken, newEvent);
    } else {
      const appPassword = decryptProviderToken(tokenRow.encrypted_access_token);
      providerEventId = await apple.createAppleEvent(connection.provider_account_email ?? "", appPassword, newEvent);
    }

    await supabase.from("synced_calendar_events").insert({
      user_id: user.id,
      connection_id: connectionId,
      provider_event_id: providerEventId,
      title,
      description,
      location,
      start_at: newEvent.startAt,
      end_at: newEvent.endAt,
      all_day: allDay,
      source: "app_created",
    });
  } catch {
    return { error: "Couldn't create that event. Try again." };
  }

  revalidatePath("/schedule");
  return null;
}
