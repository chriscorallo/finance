import { Repeat } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";

export default function RecurringPage() {
  return (
    <ComingSoon
      icon={Repeat}
      title="Recurring & Subscriptions"
      description="Detected subscriptions, bills, and income deposits, with price-change and duplicate-subscription alerts."
      phase="Arrives in Phase 2/3, after transaction history exists to detect patterns from."
    />
  );
}
