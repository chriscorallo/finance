import { Wallet } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";

export default function AccountsPage() {
  return (
    <ComingSoon
      icon={Wallet}
      title="Accounts"
      description="Every checking, savings, credit card, loan, and manually tracked asset, with balances and sync health."
      phase="Arrives in Phase 2 (manual accounts) and Phase 3 (Plaid sync)."
    />
  );
}
