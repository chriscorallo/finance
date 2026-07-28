import { CalendarDays } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";

export default function CalendarPage() {
  return (
    <ComingSoon
      icon={CalendarDays}
      title="Financial Calendar"
      description="A day-by-day view of expected income, bills, renewals, and projected cash balance."
      phase="Arrives in Phase 2."
    />
  );
}
