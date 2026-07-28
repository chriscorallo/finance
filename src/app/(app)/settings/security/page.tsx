import type { Metadata } from "next";
import { ShieldCheck, Monitor, History } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAal2 } from "@/lib/auth/session";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  SignOutOthersButton,
  SignOutEverywhereButton,
  ResetMfaButton,
} from "@/app/(app)/settings/security/session-actions";

export const metadata: Metadata = { title: "Security" };

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function SecurityPage() {
  await requireAal2();
  const supabase = await createClient();

  const [{ data: factors }, { data: sessions }, { data: loginEvents }] = await Promise.all([
    supabase.auth.mfa.listFactors(),
    supabase.rpc("list_active_sessions"),
    supabase.from("login_events").select("*").order("created_at", { ascending: false }).limit(10),
  ]);

  const verifiedFactor = (factors?.totp ?? []).find((factor) => factor.status === "verified");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Security</h1>
        <p className="text-sm text-muted-foreground">Two-factor authentication, active sessions, and login activity.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4" /> Two-factor authentication
          </CardTitle>
          <CardDescription>Required for every sign-in on this account.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="secondary" className="gap-1">
              <span className="size-1.5 rounded-full bg-positive" /> Enabled
            </Badge>
            {verifiedFactor ? <span className="text-muted-foreground">{verifiedFactor.friendly_name ?? "Authenticator app"}</span> : null}
          </div>
          <ResetMfaButton />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Monitor className="size-4" /> Active sessions
          </CardTitle>
          <CardDescription>Devices currently signed in to this account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {(sessions ?? []).map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate">{session.user_agent ?? "Unknown device"}</p>
                  <p className="text-xs text-muted-foreground">
                    Active since {formatDate(session.created_at)} · last refreshed {formatDate(session.refreshed_at)}
                  </p>
                </div>
                {session.is_current ? <Badge variant="secondary">This device</Badge> : null}
              </div>
            ))}
            {(sessions ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No other active sessions.</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <SignOutOthersButton />
            <SignOutEverywhereButton />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="size-4" /> Recent login activity
          </CardTitle>
          <CardDescription>The last 10 sign-in attempts on this account.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(loginEvents ?? []).map((event) => (
              <div key={event.id} className="flex items-center justify-between text-sm">
                <span className={event.success ? "text-foreground" : "text-negative"}>
                  {event.success ? "Successful sign-in" : `Failed sign-in${event.failure_reason ? ` (${event.failure_reason})` : ""}`}
                </span>
                <span className="text-xs text-muted-foreground">{formatDate(event.created_at)}</span>
              </div>
            ))}
            {(loginEvents ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No login activity recorded yet.</p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
