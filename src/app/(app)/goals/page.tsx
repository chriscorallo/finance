import { Target } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";

export default function GoalsPage() {
  return (
    <ComingSoon
      icon={Target}
      title="Goals"
      description="Emergency fund, down payment, and custom savings goals, with trade-off comparisons against debt payoff."
      phase="Arrives in Phase 4."
    />
  );
}
