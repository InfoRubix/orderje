import type { Metadata, Viewport } from "next";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/instrument-sans";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "OrderJe", template: "%s · OrderJe" },
  description: "QR ordering and POS for kedai makan",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#1f7a4d" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
