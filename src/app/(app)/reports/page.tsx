import { FileBarChart } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";

export default function ReportsPage() {
  return (
    <ComingSoon
      icon={FileBarChart}
      title="Reports"
      description="Monthly reviews, net-worth statements, and annual reports — exportable to CSV, JSON, and PDF."
      phase="Arrives in Phase 2+."
    />
  );
}
