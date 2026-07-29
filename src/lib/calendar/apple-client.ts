import "server-only";
import { createDAVClient } from "tsdav";
import type { NormalizedCalendarEvent, NewCalendarEvent } from "@/lib/calendar/types";

const SERVER_URL = "https://caldav.icloud.com";

function client(email: string, appSpecificPassword: string) {
  return createDAVClient({
    serverUrl: SERVER_URL,
    credentials: { username: email, password: appSpecificPassword },
    authMethod: "Basic",
    defaultAccountType: "caldav",
  });
}

/** Verifies the Apple ID email + app-specific password actually work, before storing them. */
export async function verifyAppleCredentials(email: string, appSpecificPassword: string): Promise<boolean> {
  try {
    const dav = await client(email, appSpecificPassword);
    const calendars = await dav.fetchCalendars();
    return calendars.length > 0;
  } catch {
    return false;
  }
}

// Minimal RFC 5545 line-unfolder + VEVENT field extractor — just the fields
// this app needs (SUMMARY/DTSTART/DTEND/LOCATION/DESCRIPTION/UID). Not a
// general-purpose iCalendar parser: no RRULE handling (recurrence expansion
// is requested from the server instead, via fetchCalendarObjects' `expand`
// option), no timezone database, no VALARM/attendee parsing.
function unfoldIcsLines(raw: string): string[] {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const unfolded: string[] = [];
  for (const line of lines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && unfolded.length > 0) {
      unfolded[unfolded.length - 1] += line.slice(1);
    } else {
      unfolded.push(line);
    }
  }
  return unfolded;
}

function parseIcsDate(value: string): { iso: string; allDay: boolean } {
  // All-day: VALUE=DATE, bare "YYYYMMDD". Timed: "YYYYMMDDTHHMMSS[Z]".
  const dateOnly = /^\d{8}$/;
  if (dateOnly.test(value)) {
    const year = value.slice(0, 4);
    const month = value.slice(4, 6);
    const day = value.slice(6, 8);
    return { iso: new Date(`${year}-${month}-${day}T00:00:00Z`).toISOString(), allDay: true };
  }
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/.exec(value);
  if (!match) return { iso: new Date().toISOString(), allDay: false };
  const [, y, mo, d, h, mi, s, z] = match;
  const iso = z
    ? new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`).toISOString()
    : new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}`).toISOString();
  return { iso, allDay: false };
}

function unescapeIcsText(value: string): string {
  return value.replace(/\\n/g, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}

function parseVevent(block: string[]): NormalizedCalendarEvent | null {
  let uid: string | null = null;
  let summary = "(No title)";
  let description: string | null = null;
  let location: string | null = null;
  let start: { iso: string; allDay: boolean } | null = null;
  let end: { iso: string; allDay: boolean } | null = null;

  for (const line of block) {
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;
    const keyPart = line.slice(0, colonIndex);
    const value = line.slice(colonIndex + 1);
    const name = keyPart.split(";")[0];

    switch (name) {
      case "UID":
        uid = value;
        break;
      case "SUMMARY":
        summary = unescapeIcsText(value);
        break;
      case "DESCRIPTION":
        description = unescapeIcsText(value);
        break;
      case "LOCATION":
        location = unescapeIcsText(value);
        break;
      case "DTSTART":
        start = parseIcsDate(value);
        break;
      case "DTEND":
        end = parseIcsDate(value);
        break;
      default:
        break;
    }
  }

  if (!uid || !start || !end) return null;

  return {
    providerEventId: uid,
    title: summary,
    description,
    location,
    startAt: start.iso,
    endAt: end.iso,
    allDay: start.allDay,
  };
}

/** Parses every VEVENT block out of a raw iCalendar (.ics) string. */
export function parseIcsEvents(raw: string): NormalizedCalendarEvent[] {
  const lines = unfoldIcsLines(raw);
  const events: NormalizedCalendarEvent[] = [];
  let currentBlock: string[] | null = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      currentBlock = [];
    } else if (line === "END:VEVENT") {
      if (currentBlock) {
        const event = parseVevent(currentBlock);
        if (event) events.push(event);
      }
      currentBlock = null;
    } else if (currentBlock) {
      currentBlock.push(line);
    }
  }

  return events;
}

export async function listAppleEvents(
  email: string,
  appSpecificPassword: string,
  start: Date,
  end: Date,
): Promise<NormalizedCalendarEvent[]> {
  const dav = await client(email, appSpecificPassword);
  const calendars = await dav.fetchCalendars();
  const events: NormalizedCalendarEvent[] = [];

  for (const calendar of calendars) {
    const objects = await dav.fetchCalendarObjects({
      calendar,
      expand: true,
      timeRange: { start: start.toISOString(), end: end.toISOString() },
    });
    for (const object of objects) {
      if (typeof object.data === "string") {
        events.push(...parseIcsEvents(object.data));
      }
    }
  }

  return events;
}

function formatIcsDate(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export async function createAppleEvent(
  email: string,
  appSpecificPassword: string,
  event: NewCalendarEvent,
): Promise<string> {
  const dav = await client(email, appSpecificPassword);
  const calendars = await dav.fetchCalendars();
  const targetCalendar = calendars[0];
  if (!targetCalendar) {
    throw new Error("No writable Apple calendar found.");
  }

  const uid = `${crypto.randomUUID()}@finance-command-center`;
  const dtstamp = formatIcsDate(new Date().toISOString());
  const dtstart = formatIcsDate(event.startAt);
  const dtend = formatIcsDate(event.endAt);

  const iCalString = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Finance Command Center//Schedule//EN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${event.title.replace(/,/g, "\\,")}`,
    event.description ? `DESCRIPTION:${event.description.replace(/,/g, "\\,")}` : "",
    event.location ? `LOCATION:${event.location.replace(/,/g, "\\,")}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");

  await dav.createCalendarObject({
    calendar: targetCalendar,
    iCalString,
    filename: `${uid}.ics`,
  });

  return uid;
}
