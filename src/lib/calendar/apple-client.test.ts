import { describe, it, expect } from "vitest";
import { parseIcsEvents } from "./apple-client";

describe("parseIcsEvents", () => {
  it("parses a simple timed VEVENT", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:event-1@example.com",
      "DTSTAMP:20260701T120000Z",
      "DTSTART:20260705T140000Z",
      "DTEND:20260705T150000Z",
      "SUMMARY:Team sync",
      "LOCATION:Conference Room A",
      "DESCRIPTION:Weekly check-in",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const events = parseIcsEvents(ics);
    expect(events).toEqual([
      {
        providerEventId: "event-1@example.com",
        title: "Team sync",
        description: "Weekly check-in",
        location: "Conference Room A",
        startAt: "2026-07-05T14:00:00.000Z",
        endAt: "2026-07-05T15:00:00.000Z",
        allDay: false,
      },
    ]);
  });

  it("parses an all-day VEVENT (VALUE=DATE, bare YYYYMMDD)", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:event-2@example.com",
      "DTSTART;VALUE=DATE:20260710",
      "DTEND;VALUE=DATE:20260711",
      "SUMMARY:Company holiday",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const events = parseIcsEvents(ics);
    expect(events).toHaveLength(1);
    expect(events[0].allDay).toBe(true);
    expect(events[0].title).toBe("Company holiday");
  });

  it("unfolds continuation lines (RFC 5545 line folding)", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:event-3@example.com",
      "DTSTART:20260705T140000Z",
      "DTEND:20260705T150000Z",
      "SUMMARY:A very long title that got folded across \r\n multiple lines per the spec",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const events = parseIcsEvents(ics);
    expect(events[0].title).toBe("A very long title that got folded across multiple lines per the spec");
  });

  it("handles multiple VEVENTs in one calendar and skips events missing required fields", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:event-4@example.com",
      "DTSTART:20260705T140000Z",
      "DTEND:20260705T150000Z",
      "SUMMARY:First",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "SUMMARY:Missing UID and dates",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:event-5@example.com",
      "DTSTART:20260706T090000Z",
      "DTEND:20260706T100000Z",
      "SUMMARY:Second",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const events = parseIcsEvents(ics);
    expect(events.map((e) => e.providerEventId)).toEqual(["event-4@example.com", "event-5@example.com"]);
  });
});
