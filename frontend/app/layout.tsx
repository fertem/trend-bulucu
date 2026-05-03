import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "1e1kod · Trend Paneli",
  description: "Türkiye'deki ebeveyn aramalarını izleyen trend paneli",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="bg-white text-ink-900">{children}</body>
    </html>
  );
}
