import type { Metadata, Viewport } from "next";
import "@fontsource-variable/archivo/wdth.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "OrderTerus", template: "%s · OrderTerus" },
  description: "QR ordering and POS for kedai makan",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#d92d20" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
