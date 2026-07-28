import { LineChart } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";

export default function NetWorthPage() {
  return (
    <ComingSoon
      icon={LineChart}
      title="Net Worth"
      description="Net worth history, assets vs. liabilities, and liquid vs. illiquid breakdowns over any time range."
      phase="Arrives in Phase 2."
    />
  );
}
