import { Bell } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";

export default function AlertsPage() {
  return (
    <ComingSoon
      icon={Bell}
      title="Alerts"
      description="Large transactions, spending spikes, low balances, and subscription price changes — flagged calmly, without alarmist language."
      phase="Arrives in Phase 4."
    />
  );
}
