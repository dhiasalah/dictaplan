import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geist = localFont({
  variable: "--font-geist",
  display: "swap",
  src: [
    { path: "../public/fonts/geist-400.woff", weight: "400" },
    { path: "../public/fonts/geist-500.woff", weight: "500" },
    { path: "../public/fonts/geist-600.woff", weight: "600" },
  ],
});

const geistMono = localFont({
  variable: "--font-geist-mono",
  display: "swap",
  src: [
    { path: "../public/fonts/geist-mono-400.woff", weight: "400" },
    { path: "../public/fonts/geist-mono-500.woff", weight: "500" },
  ],
});

const instrument = localFont({
  variable: "--font-instrument",
  display: "swap",
  src: [
    { path: "../public/fonts/instrument-serif-400.woff", weight: "400", style: "normal" },
    { path: "../public/fonts/instrument-serif-400-italic.woff", weight: "400", style: "italic" },
  ],
});

export const metadata: Metadata = {
  title: "Dictaplan · Plan de traitement dicté",
  description: "Dictez un plan de traitement dentaire, vérifiez-le, exportez un PDF soigné.",
};

export const viewport: Viewport = { themeColor: "#F7F5F0" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={`${geist.variable} ${geistMono.variable} ${instrument.variable}`}>
      <body>{children}</body>
    </html>
  );
}
