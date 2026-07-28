import { CreditCard } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";

export default function DebtsPage() {
  return (
    <ComingSoon
      icon={CreditCard}
      title="Debt Command Center"
      description="Avalanche, snowball, and custom payoff strategies with side-by-side scenario comparisons."
      phase="Arrives in Phase 4."
    />
  );
}
