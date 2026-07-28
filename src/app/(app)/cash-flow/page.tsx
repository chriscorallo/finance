import { ArrowLeftRight } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";

export default function CashFlowPage() {
  return (
    <ComingSoon
      icon={ArrowLeftRight}
      title="Cash Flow"
      description="Income, fixed and variable expenses, debt payments, and savings — visualized as a Sankey flow for any period."
      phase="Arrives in Phase 2."
    />
  );
}
