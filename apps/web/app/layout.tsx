import type { Metadata, Viewport } from "next";
import { Caveat, Nunito_Sans } from "next/font/google";
import "./globals.css";

const handwriting = Caveat({ subsets: ["latin"], variable: "--font-hand" });
const sans = Nunito_Sans({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Sea Battle",
  description: "Batalla naval multijugador en tiempo real",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ece7d7",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body
        className={`${handwriting.variable} ${sans.variable}`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
