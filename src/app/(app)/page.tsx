import { LayoutDashboard } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";

export default function OverviewPage() {
  return (
    <ComingSoon
      icon={LayoutDashboard}
      title="Your financial snapshot"
      description="Net worth, cash flow, safe-to-spend, and the daily briefing will appear here once you connect an account or add one manually."
      phase="Arrives in Phase 2 (manual accounts) and Phase 3 (Plaid sync)."
    />
  );
}
