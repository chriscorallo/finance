import type { Metadata } from "next";
import { LoginForm } from "@/app/login/login-form";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold tracking-tight">Command Center</h1>
          <p className="text-sm text-muted-foreground">Sign in to your private finance dashboard.</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
