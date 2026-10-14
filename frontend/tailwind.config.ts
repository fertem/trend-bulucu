import type { Config } from "tailwindcss";

/**
 * Renk token'ları CSS değişkenlerinden okunur (globals.css → :root / .dark).
 * Böylece bileşenlerdeki `bg-white`, `text-ink-900`, `bg-amber-50` gibi sınıflar
 * karanlık modda tek noktadan değişir; `/30` gibi alpha kısaltmaları çalışmaya devam eder.
 */
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

function tinted(hue: string) {
  // 50/100/200: zemin + kenarlık (temaya göre değişir). Orta/koyu tonlar Tailwind varsayılanı.
  return {
    50: v(`${hue}-50`),
    100: v(`${hue}-100`),
    200: v(`${hue}-200`),
  };
}

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: v("surface"),
        brand: {
          DEFAULT: "#2563eb",
          50: v("brand-50"),
          100: v("brand-100"),
          200: v("brand-200"),
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
        },
        ink: {
          900: v("ink-900"),
          700: v("ink-700"),
          500: v("ink-500"),
          400: v("ink-400"),
          300: v("ink-300"),
          200: v("ink-200"),
          100: v("ink-100"),
          50: v("ink-50"),
        },
        red: tinted("red"),
        amber: tinted("amber"),
        emerald: tinted("emerald"),
        cyan: tinted("cyan"),
        purple: tinted("purple"),
        blue: tinted("blue"),
        pink: tinted("pink"),
      },
      fontFamily: {
        sans: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
