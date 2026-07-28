"use client";

import { createContext, useContext, useState, useTransition } from "react";
import { setPrivacyModePreference } from "@/app/(app)/settings/privacy-actions";

type PrivacyModeContextValue = {
  privacyMode: boolean;
  togglePrivacyMode: () => void;
  isPending: boolean;
};

const PrivacyModeContext = createContext<PrivacyModeContextValue | null>(null);

export function PrivacyModeProvider({
  children,
  initialValue,
}: {
  children: React.ReactNode;
  initialValue: boolean;
}) {
  const [privacyMode, setPrivacyMode] = useState(initialValue);
  const [isPending, startTransition] = useTransition();

  function togglePrivacyMode() {
    const next = !privacyMode;
    setPrivacyMode(next);
    startTransition(async () => {
      await setPrivacyModePreference(next);
    });
  }

  return (
    <PrivacyModeContext.Provider value={{ privacyMode, togglePrivacyMode, isPending }}>
      {children}
    </PrivacyModeContext.Provider>
  );
}

export function usePrivacyMode() {
  const context = useContext(PrivacyModeContext);
  if (!context) {
    throw new Error("usePrivacyMode must be used within a PrivacyModeProvider");
  }
  return context;
}
