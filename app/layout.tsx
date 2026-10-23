import type { Metadata, Viewport } from "next";
import { Oswald, Playfair_Display } from "next/font/google";
import "./globals.css";

const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["600", "700", "900"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "OB Day 2026 · Ticket Check",
  description: "Gate ticket verification for OB Day 2026, Bandaranayake College OBA.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#140a08",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${oswald.variable} ${playfair.variable} h-full antialiased`}>
      <body className="min-h-full bg-ground font-sans text-ink">{children}</body>
    </html>
  );
}
