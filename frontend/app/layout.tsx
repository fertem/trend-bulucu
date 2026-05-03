import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Trend Intelligence Dashboard",
  description: "Trend, SEO and content intelligence dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="bg-white text-ink-900">
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
