import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://recalls.sh";
const TITLE = "wenlo — cloud storage + notes for the agentic era";
const DESCRIPTION =
  "wenlo is cloud storage and notes built for AI agents. Store your files and notes, and let an agent search, read, and answer across everything you keep.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: "%s — wenlo",
  },
  description: DESCRIPTION,
  applicationName: "wenlo",
  keywords: [
    "cloud storage",
    "notes",
    "AI agent",
    "agentic",
    "semantic search",
    "knowledge base",
    "RAG",
  ],
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "wenlo",
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  icons: {
    icon: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
