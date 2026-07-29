import "server-only";
import { serverEnv } from "@/lib/env.server";
import type { NormalizedCalendarEvent, NewCalendarEvent, OAuthTokenSet } from "@/lib/calendar/types";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const SCOPE = "offline_access Calendars.ReadWrite User.Read";

function credentials() {
  const env = serverEnv();
  if (!env.MICROSOFT_CALENDAR_CLIENT_ID || !env.MICROSOFT_CALENDAR_CLIENT_SECRET) {
    throw new Error("Microsoft Calendar is not configured (MICROSOFT_CALENDAR_CLIENT_ID/SECRET missing).");
  }
  return {
    clientId: env.MICROSOFT_CALENDAR_CLIENT_ID,
    clientSecret: env.MICROSOFT_CALENDAR_CLIENT_SECRET,
    tenant: env.MICROSOFT_CALENDAR_TENANT,
  };
}

function authorizeUrl(tenant: string) {
  return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`;
}
function tokenUrl(tenant: string) {
  return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;
}

export function buildMicrosoftAuthUrl(redirectUri: string, state: string): string {
  const { clientId, tenant } = credentials();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPE,
    response_mode: "query",
    state,
  });
  return `${authorizeUrl(tenant)}?${params.toString()}`;
}

type MicrosoftTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
};

export async function exchangeMicrosoftCode(code: string, redirectUri: string): Promise<OAuthTokenSet> {
  const { clientId, clientSecret, tenant } = credentials();
  const response = await fetch(tokenUrl(tenant), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      scope: SCOPE,
    }),
  });
  if (!response.ok) {
    throw new Error(`Microsoft token exchange failed: ${response.status}`);
  }
  const data = (await response.json()) as MicrosoftTokenResponse;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  };
}

export async function refreshMicrosoftAccessToken(refreshToken: string): Promise<OAuthTokenSet> {
  const { clientId, clientSecret, tenant } = credentials();
  const response = await fetch(tokenUrl(tenant), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      scope: SCOPE,
    }),
  });
  if (!response.ok) {
    throw new Error(`Microsoft token refresh failed: ${response.status}`);
  }
  const data = (await response.json()) as MicrosoftTokenResponse;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  };
}

export async function fetchMicrosoftAccountEmail(accessToken: string): Promise<string | null> {
  const response = await fetch(`${GRAPH_BASE}/me`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) return null;
  const data = (await response.json()) as { mail?: string; userPrincipalName?: string };
  return data.mail ?? data.userPrincipalName ?? null;
}

type GraphEvent = {
  id: string;
  subject?: string;
  bodyPreview?: string;
  location?: { displayName?: string };
  start?: { dateTime?: string };
  end?: { dateTime?: string };
  isAllDay?: boolean;
};

export async function listMicrosoftEvents(
  accessToken: string,
  startDateTime: string,
  endDateTime: string,
): Promise<NormalizedCalendarEvent[]> {
  const params = new URLSearchParams({ startDateTime, endDateTime, $top: "250" });
  const response = await fetch(`${GRAPH_BASE}/me/calendarView?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Prefer: 'outlook.timezone="UTC"',
    },
  });
  if (!response.ok) {
    throw new Error(`Microsoft calendarView failed: ${response.status}`);
  }
  const data = (await response.json()) as { value?: GraphEvent[] };

  return (data.value ?? [])
    .filter((event) => event.start?.dateTime && event.end?.dateTime)
    .map((event) => ({
      providerEventId: event.id,
      title: event.subject ?? "(No title)",
      description: event.bodyPreview ?? null,
      location: event.location?.displayName ?? null,
      // Graph returns UTC-local dateTime strings without a trailing Z when
      // requested with the outlook.timezone="UTC" header — append it so
      // Date parsing treats them as UTC rather than local time.
      startAt: new Date(`${event.start?.dateTime}Z`).toISOString(),
      endAt: new Date(`${event.end?.dateTime}Z`).toISOString(),
      allDay: Boolean(event.isAllDay),
    }));
}

export async function createMicrosoftEvent(accessToken: string, event: NewCalendarEvent): Promise<string> {
  const response = await fetch(`${GRAPH_BASE}/me/events`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      subject: event.title,
      body: { contentType: "text", content: event.description ?? "" },
      location: event.location ? { displayName: event.location } : undefined,
      start: { dateTime: event.startAt, timeZone: "UTC" },
      end: { dateTime: event.endAt, timeZone: "UTC" },
      isAllDay: event.allDay,
    }),
  });
  if (!response.ok) {
    throw new Error(`Microsoft event create failed: ${response.status}`);
  }
  const data = (await response.json()) as { id: string };
  return data.id;
}
