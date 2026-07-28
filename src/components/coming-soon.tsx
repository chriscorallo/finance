import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export function ComingSoon({
  icon: Icon,
  title,
  description,
  phase,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  phase: string;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="max-w-md text-center">
        <CardHeader className="items-center">
          <div className="mb-2 flex size-12 items-center justify-center rounded-full bg-muted">
            <Icon className="size-6 text-muted-foreground" aria-hidden="true" />
          </div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">{phase}</p>
        </CardContent>
      </Card>
    </div>
  );
}
