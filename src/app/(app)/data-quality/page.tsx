import { ShieldCheck } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";

export default function DataQualityPage() {
  return (
    <ComingSoon
      icon={ShieldCheck}
      title="Data Quality"
      description="Failed syncs, stale balances, duplicate transactions, and uncategorized spending — tracked toward a completeness score."
      phase="Arrives alongside account syncing in Phase 3."
    />
  );
}
