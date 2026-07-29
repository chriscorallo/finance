import { CalendarClock } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ConnectCalendarButtons } from "@/app/(app)/schedule/connect-calendar-buttons";
import { ConnectionRow } from "@/app/(app)/schedule/connection-row";
import { AddEventDialog } from "@/app/(app)/schedule/add-event-dialog";

const SERIES_COLORS = ["--series-1", "--series-2", "--series-3", "--series-4", "--series-5", "--series-6", "--series-7", "--series-8"];

const ERROR_MESSAGES: Record<string, string> = {
  google_connect_failed: "Connecting Google Calendar didn't go through. Try again.",
  google_save_failed: "Connected to Google, but saving it failed. Try again.",
  microsoft_connect_failed: "Connecting Outlook didn't go through. Try again.",
  microsoft_save_failed: "Connected to Outlook, but saving it failed. Try again.",
};

function formatDayHeading(date: Date): string {
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = date.toDateString() === tomorrow.toDateString();

  if (isToday) return "Today";
  if (isTomorrow) return "Tomorrow";
  return date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

function formatEventTime(startAt: string, endAt: string, allDay: boolean): string {
  if (allDay) return "All day";
  const start = new Date(startAt);
  const end = new Date(endAt);
  const timeFormat: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
  return `${start.toLocaleTimeString(undefined, timeFormat)} – ${end.toLocaleTimeString(undefined, timeFormat)}`;
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const user = await requireUser();
  const supabase = await createClient();

  const { data: connections } = await supabase
    .from("calendar_connections")
    .select("id, provider, display_name, status, last_successful_sync_at")
    .eq("user_id", user.id)
    .neq("status", "disconnected")
    .order("created_at", { ascending: true });

  const connectionRows = connections ?? [];
  const colorByConnectionId = new Map(
    connectionRows.map((connection, index) => [connection.id, SERIES_COLORS[index % SERIES_COLORS.length]]),
  );

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const windowEnd = new Date(startOfToday);
  windowEnd.setDate(windowEnd.getDate() + 30);

  const { data: events } =
    connectionRows.length > 0
      ? await supabase
          .from("synced_calendar_events")
          .select("id, connection_id, title, description, location, start_at, end_at, all_day")
          .eq("user_id", user.id)
          .gte("start_at", startOfToday.toISOString())
          .lt("start_at", windowEnd.toISOString())
          .order("start_at", { ascending: true })
      : { data: [] };

  const eventRows = events ?? [];

  const eventsByDay = new Map<string, typeof eventRows>();
  for (const event of eventRows) {
    const dayKey = new Date(event.start_at).toDateString();
    const existing = eventsByDay.get(dayKey);
    if (existing) {
      existing.push(event);
    } else {
      eventsByDay.set(dayKey, [event]);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-xl font-semibold">Schedule</h1>
          <p className="text-sm text-muted-foreground">Every connected calendar, in one place.</p>
        </div>
        {connectionRows.length > 0 ? (
          <AddEventDialog
            connections={connectionRows.map((c) => ({ id: c.id, label: c.display_name ?? c.provider }))}
          />
        ) : null}
      </div>

      {error && ERROR_MESSAGES[error] ? (
        <Alert variant="destructive">
          <AlertDescription>{ERROR_MESSAGES[error]}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-3">
        <h2 className="font-heading text-base font-medium">Connect a calendar</h2>
        <ConnectCalendarButtons />
      </div>

      {connectionRows.length > 0 ? (
        <div className="flex flex-col gap-3">
          <h2 className="font-heading text-base font-medium">Connected calendars</h2>
          <Card className="py-0">
            {connectionRows.map((connection) => (
              <ConnectionRow
                key={connection.id}
                connection={{
                  id: connection.id,
                  provider: connection.provider,
                  displayName: connection.display_name,
                  status: connection.status,
                  lastSuccessfulSyncAt: connection.last_successful_sync_at,
                  colorVar: colorByConnectionId.get(connection.id) ?? SERIES_COLORS[0],
                }}
              />
            ))}
          </Card>
        </div>
      ) : (
        <Card className="items-center py-10 text-center">
          <CardHeader className="items-center">
            <div className="mb-2 flex size-12 items-center justify-center rounded-full bg-muted">
              <CalendarClock className="size-6 text-muted-foreground" aria-hidden="true" />
            </div>
            <CardTitle>No calendars connected yet</CardTitle>
            <CardDescription>Connect Google, Outlook, or Apple Calendar to see everything in one place.</CardDescription>
          </CardHeader>
        </Card>
      )}

      {connectionRows.length > 0 ? (
        <div className="flex flex-col gap-3">
          <h2 className="font-heading text-base font-medium">Upcoming, next 30 days</h2>
          {eventsByDay.size === 0 ? (
            <Card className="items-center py-8 text-center">
              <CardHeader className="items-center">
                <CardDescription>Nothing on the calendar. Hit &quot;Sync now&quot; on a connection above if you just connected it.</CardDescription>
              </CardHeader>
            </Card>
          ) : (
            Array.from(eventsByDay.entries()).map(([dayKey, dayEvents]) => (
              <div key={dayKey} className="flex flex-col gap-2">
                <h3 className="text-sm font-medium text-muted-foreground">{formatDayHeading(new Date(dayKey))}</h3>
                <Card className="py-0">
                  {dayEvents.map((event) => (
                    <div key={event.id} className="flex items-start gap-3 border-b px-4 py-3 last:border-b-0 sm:px-6">
                      <span
                        className="mt-1.5 size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: `var(${colorByConnectionId.get(event.connection_id) ?? SERIES_COLORS[0]})` }}
                        aria-hidden="true"
                      />
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-sm font-medium">{event.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatEventTime(event.start_at, event.end_at, event.all_day)}
                          {event.location ? ` · ${event.location}` : ""}
                        </span>
                      </div>
                    </div>
                  ))}
                </Card>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
