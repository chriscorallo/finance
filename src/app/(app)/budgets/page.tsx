import { PiggyBank } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";

export default function BudgetsPage() {
  return (
    <ComingSoon
      icon={PiggyBank}
      title="Budgets"
      description="Category budgets, zero-based budgeting, rollover rules, and needs/wants/savings/debt tracking."
      phase="Arrives in Phase 2."
    />
  );
}
