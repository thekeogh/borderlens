import { Rajdhani, Inter, Space_Mono } from "next/font/google";

import { Config } from "#config";

import type { Metadata } from "next";
import type { Viewport } from "next";

import "#css/variables.css";
import "#css/reset.css";
import "#css/globals.css";
import "#css/utils.css";

/**
 * Font configuration for the application.
 *
 * @remarks
 * Defines font families used throughout the application with their respective subsets, weights, and CSS variable names
 * for styling purposes.
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-family-inter",
});
const rajdhani = Rajdhani({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-family-rajdhani",
});
const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-family-space",
});

/**
 * Metadata configuration for the application.
 *
 * @remarks
 * Defines SEO metadata including title, description, Open Graph tags, and icon configurations from the application
 * config.
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
    url: "/img/meta/64x64.png",
    type: "image/png",
    sizes: "64x64",
  }, {
    url: "/img/meta/32x32.png",
    type: "image/png",
    sizes: "32x32",
  }, {
    url: "/img/meta/16x16.png",
    type: "image/png",
    sizes: "16x16",
  }, {
    url: "/img/meta/180x180.png",
    rel: "apple-touch-icon",
    sizes: "180x180",
  }],
  openGraph: {
    type: "website",
    url: Config.Meta.url,
    siteName: Config.Meta.name,
    title: Config.Meta.title,
    description: Config.Meta.description,
    images: [{ url: "/img/meta/1200x630.jpg" }],
  },
};

/**
 * Viewport configuration for the application.
 *
 * @remarks
 * Defines viewport settings including device width scaling, color scheme preference, and theme color from the
 * application config.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark",
  themeColor: Config.Meta.themeColor,
};

/**
 * Root layout component for the application.
 *
 * @remarks
 * Serves as the main layout wrapper for all pages in the application. Provides the HTML structure and applies global
 * styling and configuration.
 */
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${rajdhani.variable} ${spaceMono.variable}`}>
      <body>
        {children}
      </body>
    </html>
  );
}
