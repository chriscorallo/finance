import { Sparkles } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";

export default function AiAdvisorPage() {
  return (
    <ComingSoon
      icon={Sparkles}
      title="AI Advisor"
      description="Ask questions about your finances — every answer will cite the underlying numbers and data used."
      phase="Arrives in Phase 5, after deterministic financial calculations are complete."
    />
  );
}
