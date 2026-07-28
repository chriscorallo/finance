"use client";

import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

/** Root-level providers — theming must wrap every route, including /login, to avoid a flash of the wrong theme. */
export function RootProviders({ children, nonce }: { children: React.ReactNode; nonce?: string }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange nonce={nonce}>
      <TooltipProvider delay={200}>
        {children}
        <Toaster />
      </TooltipProvider>
    </ThemeProvider>
  );
}
