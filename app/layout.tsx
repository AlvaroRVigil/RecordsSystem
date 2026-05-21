import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

const SITE_URL = "https://records-system-eta.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Rackr — Tu colección de vinilos",
  description:
    "Cataloga, busca y reproduce previews de tu colección de vinilos en 3D. Listas, wishlist y todo lo que tienes a un click.",
  applicationName: "Rackr",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  openGraph: {
    title: "Rackr — Tu colección de vinilos",
    description:
      "Cataloga, busca y reproduce previews de tu colección de vinilos en 3D.",
    url: SITE_URL,
    siteName: "Rackr",
    images: [
      {
        url: "/icon.svg",
        width: 1200,
        height: 630,
        alt: "Rackr",
      },
    ],
    locale: "es_ES",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Rackr — Tu colección de vinilos",
    description:
      "Cataloga, busca y reproduce previews de tu colección de vinilos en 3D.",
    images: ["/icon.svg"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${sans.variable} ${mono.variable}`}>
      <body className="grain">{children}</body>
    </html>
  );
}
