import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { RootProviders } from "@/components/providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Command Center",
    template: "%s · Command Center",
  },
  description: "A private, single-owner personal finance command center.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Reading the nonce here (set by proxy.ts on every request) is what lets
  // next-themes' inline anti-flash script run under a strict CSP, and opts
  // this layout — and everything under it — into dynamic rendering, which
  // Next.js requires for nonce-based CSP to work at all.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <RootProviders nonce={nonce}>{children}</RootProviders>
      </body>
    </html>
  );
}
