import { TrendingUp } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";

export default function ForecastPage() {
  return (
    <ComingSoon
      icon={TrendingUp}
      title="Forecast & Scenario Lab"
      description="Model income changes, refinancing, new bills, and large purchases across 30 days to 5 years."
      phase="Arrives in Phase 4."
    />
  );
}
