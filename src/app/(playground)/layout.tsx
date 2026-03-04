import { Rajdhani, Inter, Space_Mono } from "next/font/google";

import type { Viewport } from "next";

import "#css/reset.css";
import "#css/variables.css";
import "#css/base.css";
import "#css/globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  variable: "--font-family-inter",
});
const rajdhani = Rajdhani({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-family-rajdhani",
});
const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-family-space",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark",
};

export default function PlaygroundRootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${rajdhani.variable} ${spaceMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
