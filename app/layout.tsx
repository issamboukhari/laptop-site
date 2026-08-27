import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "gen — Intelligent Computer Discovery",
    template: "%s · gen",
  },
  description:
    "Search, compare, and find the best computer for your needs — gaming, university, work or design. Hardware-grounded ratings and Gemini AI advice.",
  keywords: [
    "laptop comparison",
    "computer specs",
    "gaming laptop",
    "business laptop",
    "AI computer advisor",
    "مقارنة لابتوب",
    "مواصفات حواسيب",
  ],
  applicationName: "gen",
  openGraph: {
    type: "website",
    siteName: "gen",
    title: "gen — Intelligent Computer Discovery",
    description:
      "Compare real computers side by side with hardware-grounded ratings and instant Gemini AI advice.",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "gen" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "gen — Intelligent Computer Discovery",
    description:
      "Compare real computers side by side with hardware-grounded ratings and instant Gemini AI advice.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#6d28d9",
  width: "device-width",
  initialScale: 1,
};

const themeScript = `
(function() {
  try {
    var t = localStorage.getItem('gen-theme') || 'dark';
    var isDark;
    if (t === 'system') {
      isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    } else {
      isDark = t === 'dark';
    }
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.classList.toggle('light', !isDark);
  } catch(e) {}
  try {
    var a = localStorage.getItem('gen-accent');
    if (a && a !== 'violet') {
      var map = {blue:'#2563eb',emerald:'#10b981',rose:'#f43f5e',amber:'#f59e0b',cyan:'#06b6d4',orange:'#f97316',slate:'#64748b'};
      var lightMap = {blue:'#1d4ed8',emerald:'#059669',rose:'#e11d48',amber:'#d97706',cyan:'#0891b2',orange:'#ea580c',slate:'#475569'};
      if (map[a]) {
        document.documentElement.style.setProperty('--gen-accent', map[a]);
        document.documentElement.style.setProperty('--gen-accent-light', lightMap[a] || map[a]);
        document.documentElement.style.setProperty('--gen-accent-glow', map[a] + '40');
      }
    }
  } catch(e) {}
  try {
    var f = localStorage.getItem('gen-font');
    if (f) {
      var fMap = {compact:'13px',normal:'14px',relaxed:'16px'};
      if (fMap[f]) document.documentElement.style.fontSize = fMap[f];
    }
  } catch(e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
      suppressHydrationWarning
    >
      <head>
        <script
          id="theme-script"
          dangerouslySetInnerHTML={{ __html: themeScript }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-gen-bg text-gen-fg pb-mobile-nav">
        {children}
      </body>
    </html>
  );
}
