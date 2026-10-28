import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/jobpilot/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "JobPilot AI — Autonomous Job Application Platform",
  description:
    "Connect Indeed, LinkedIn, Glassdoor & more. JobPilot AI applies to matched jobs on your behalf 24/7 — with AI cover letters, match scoring and a full application tracker.",
  keywords: ["job automation", "auto apply", "Indeed", "LinkedIn", "AI", "Next.js", "FastAPI", "Laravel"],
  authors: [{ name: "Faisal Khan" }],
  openGraph: {
    title: "JobPilot AI — Autonomous Job Application Platform",
    description: "Connect your job portals. Let AI apply for you — 24/7.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
