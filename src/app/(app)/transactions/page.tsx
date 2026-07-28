import { Receipt } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";

export default function TransactionsPage() {
  return (
    <ComingSoon
      icon={Receipt}
      title="Transactions"
      description="Search, filter, split, tag, and recategorize every transaction once accounts are connected."
      phase="Arrives in Phase 2 (manual entry) and Phase 3 (Plaid sync)."
    />
  );
}
