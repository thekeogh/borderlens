import { Rajdhani, Inter, Space_Mono } from "next/font/google";

import { Config } from "#config";

import { Template } from "#components/layout/template";

import type { Metadata } from "next";
import type { Viewport } from "next";

import "#css/reset.css";
import "#css/variables.css";
import "#css/base.css";
import "#css/globals.css";

/**
 * Font configuration for the application.
 */
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


/**
 * Metadata configuration for the application.
 */
export const metadata: Metadata = {
  metadataBase: Config.Meta.url,
  applicationName: Config.Meta.name,
  title: `${Config.Meta.title} - ${Config.Meta.name}`,
  description: Config.Meta.description,
  robots: "index, follow",
  alternates: {
    canonical: Config.Meta.url,
  },
  icons: [{
    url: "/img/og/64x64.png",
    type: "image/png",
    sizes: "64x64",
  }, {
    url: "/img/og/32x32.png",
    type: "image/png",
    sizes: "32x32",
  }, {
    url: "/img/og/16x16.png",
    type: "image/png",
    sizes: "16x16",
  }, {
    url: "/img/og/180x180.png",
    rel: "apple-touch-icon",
    sizes: "180x180",
  }],
  openGraph: {
    type: "website",
    url: Config.Meta.url,
    siteName: Config.Meta.name,
    title: Config.Meta.title,
    description: Config.Meta.description,
    images: [{ url: "/img/og/1200x630.jpg" }],
  },
};

/**
 * Viewport configuration for the application.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark",
  themeColor: Config.Meta.themeColor,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${rajdhani.variable} ${spaceMono.variable}`}>
      <body>
        <Template>
          {children}
        </Template>
      </body>
    </html>
  );
}
