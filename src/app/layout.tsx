import type { Metadata, Viewport } from "next";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "streamdown/styles.css";
import "./globals.css";
import { Pwa } from "@/components/pwa";

export const metadata: Metadata = {
  title: "Superdeli · Cifrai",
  description:
    "Painel de vendas da Superdeli com dados reais do caixa (BMWeb).",
  robots: { index: false, follow: false },
  applicationName: "Superdeli",
  appleWebApp: {
    capable: true,
    title: "Superdeli",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#272b27",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <Pwa />
      </body>
    </html>
  );
}
