/** Common shape every provider client normalizes its events to, before storage in synced_calendar_events. */
export type NormalizedCalendarEvent = {
  providerEventId: string;
  title: string;
  description: string | null;
  location: string | null;
  startAt: string; // ISO 8601
  endAt: string; // ISO 8601
  allDay: boolean;
};

export type NewCalendarEvent = {
  title: string;
  description: string | null;
  location: string | null;
  startAt: string; // ISO 8601
  endAt: string; // ISO 8601
  allDay: boolean;
};

export type OAuthTokenSet = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null; // ISO 8601, null if the provider doesn't expire access tokens
};
