import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@/lib/theme";
import { ToastProvider } from "@/components/ui/Toast";

export const metadata: Metadata = {
  title: "Trend Intelligence Dashboard",
  description: "Trend, SEO and content intelligence dashboard",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
        {/* İlk boyamadan önce temayı uygula — açık tema flash'ı olmasın */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="text-ink-900">
        <ThemeProvider>
          <LanguageProvider>
            <ToastProvider>{children}</ToastProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
