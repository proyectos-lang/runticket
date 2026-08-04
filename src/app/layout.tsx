import type { Metadata } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Archivo a secas es la variable (100–900). «Archivo Black» es estática de peso
// 400 y no puede dar los pesos 600–900 que pide el diseño.
const display = Archivo({
  variable: "--fuente-display",
  subsets: ["latin"],
  display: "swap",
  // La cursiva la pide el logotipo. Sin cargarla, el navegador la falsifica
  // inclinando la redonda, y en un peso 900 el resultado se nota deformado.
  style: ["normal", "italic"],
});

// Mono para fechas, precios, tiempos, dorsales y etiquetas en mayúscula.
const mono = JetBrains_Mono({
  variable: "--fuente-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  // Sin `metadataBase`, Next no puede formar la URL absoluta de la imagen de
  // vista previa y al compartir un enlace no se ve nada. En producción hay que
  // apuntar NEXT_PUBLIC_SITE_URL al dominio real.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "RunTicket HN",
  description: "Inscripciones para carreras populares en Honduras.",
  // `opengraph-image.png` vive junto a este archivo y Next lo enlaza solo; esto
  // es lo demás que necesitan WhatsApp, Facebook y X para pintar la tarjeta.
  openGraph: {
    title: "RunTicket HN",
    description: "Inscripciones para carreras populares en Honduras.",
    siteName: "RunTicket HN",
    locale: "es_HN",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${display.variable} ${mono.variable} h-full antialiased`}
    >
      {/* El fondo lo pone globals.css con el token, no una clase de utilidad. */}
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
