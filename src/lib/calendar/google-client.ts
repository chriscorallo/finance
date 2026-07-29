import "server-only";
import { serverEnv } from "@/lib/env.server";
import type { NormalizedCalendarEvent, NewCalendarEvent, OAuthTokenSet } from "@/lib/calendar/types";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";

const SCOPE = "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email";

function credentials() {
  const env = serverEnv();
  if (!env.GOOGLE_CALENDAR_CLIENT_ID || !env.GOOGLE_CALENDAR_CLIENT_SECRET) {
    throw new Error("Google Calendar is not configured (GOOGLE_CALENDAR_CLIENT_ID/SECRET missing).");
  }
  return { clientId: env.GOOGLE_CALENDAR_CLIENT_ID, clientSecret: env.GOOGLE_CALENDAR_CLIENT_SECRET };
}

export function buildGoogleAuthUrl(redirectUri: string, state: string): string {
  const { clientId } = credentials();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

type GoogleTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
};

export async function exchangeGoogleCode(code: string, redirectUri: string): Promise<OAuthTokenSet> {
  const { clientId, clientSecret } = credentials();
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!response.ok) {
    throw new Error(`Google token exchange failed: ${response.status}`);
  }
  const data = (await response.json()) as GoogleTokenResponse;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  };
}

export async function refreshGoogleAccessToken(refreshToken: string): Promise<OAuthTokenSet> {
  const { clientId, clientSecret } = credentials();
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) {
    throw new Error(`Google token refresh failed: ${response.status}`);
  }
  const data = (await response.json()) as GoogleTokenResponse;
  return {
    accessToken: data.access_token,
    refreshToken: refreshToken,
    expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  };
}

export async function fetchGoogleAccountEmail(accessToken: string): Promise<string | null> {
  const response = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) return null;
  const data = (await response.json()) as { email?: string };
  return data.email ?? null;
}

type GoogleEvent = {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
};

export async function listGoogleEvents(
  accessToken: string,
  timeMin: string,
  timeMax: string,
): Promise<NormalizedCalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });
  const response = await fetch(`${EVENTS_URL}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`Google events list failed: ${response.status}`);
  }
  const data = (await response.json()) as { items?: GoogleEvent[] };

  return (data.items ?? [])
    .filter((event) => event.start && event.end)
    .map((event) => {
      const allDay = Boolean(event.start?.date);
      return {
        providerEventId: event.id,
        title: event.summary ?? "(No title)",
        description: event.description ?? null,
        location: event.location ?? null,
        startAt: new Date(event.start?.dateTime ?? event.start?.date ?? "").toISOString(),
        endAt: new Date(event.end?.dateTime ?? event.end?.date ?? "").toISOString(),
        allDay,
      };
    });
}

export async function createGoogleEvent(accessToken: string, event: NewCalendarEvent): Promise<string> {
  const body = event.allDay
    ? {
        summary: event.title,
        description: event.description ?? undefined,
        location: event.location ?? undefined,
        start: { date: event.startAt.slice(0, 10) },
        end: { date: event.endAt.slice(0, 10) },
      }
    : {
        summary: event.title,
        description: event.description ?? undefined,
        location: event.location ?? undefined,
        start: { dateTime: event.startAt },
        end: { dateTime: event.endAt },
      };

  const response = await fetch(EVENTS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Google event create failed: ${response.status}`);
  }
  const data = (await response.json()) as { id: string };
  return data.id;
}

export async function revokeGoogleToken(token: string): Promise<void> {
  await fetch(`${REVOKE_URL}?token=${encodeURIComponent(token)}`, { method: "POST" }).catch(() => {
    // Best-effort — if revoke fails, the stored credential still gets deleted locally.
  });
}
