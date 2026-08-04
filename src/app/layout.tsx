import type { Metadata } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Archivo a secas es la variable (100–900). «Archivo Black» es estática de peso
// 400 y no puede dar los pesos 600–900 que pide el diseño.
const display = Archivo({
  variable: "--fuente-display",
  subsets: ["latin"],
  display: "swap",
});

// Mono para fechas, precios, tiempos, dorsales y etiquetas en mayúscula.
const mono = JetBrains_Mono({
  variable: "--fuente-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "RunTicket",
  description: "Inscripciones para carreras populares.",
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
