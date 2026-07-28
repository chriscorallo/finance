import Link from "next/link";
import { Lock, Download, Trash2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your account, security, and data.</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lock className="size-4" /> Security
            </CardTitle>
            <CardDescription>Two-factor authentication, active sessions, and login activity.</CardDescription>
          </div>
          <Button variant="outline" size="sm" render={<Link href="/settings/security">Open</Link>} />
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Download className="size-4" /> Export your data
            </CardTitle>
            <CardDescription>Download your financial data as CSV, JSON, or PDF.</CardDescription>
          </div>
          <Button variant="outline" size="sm" disabled>
            Coming soon
          </Button>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trash2 className="size-4" /> Delete all data
            </CardTitle>
            <CardDescription>
              Disconnect institutions and permanently delete every transaction, account, and AI conversation.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" disabled>
            Coming soon
          </Button>
        </CardHeader>
      </Card>
    </div>
  );
}
