import type { Metadata, Viewport } from "next";
import { fontVariables } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "LinguaCompanion",
  description: "Voice-first AI language learning for IT professionals",
  applicationName: "LinguaCompanion",
  authors: [{ name: "CreatmanCEO" }],
  keywords: ["English learning", "IT professionals", "voice AI", "code-switching"],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5F5FA" },
    { media: "(prefers-color-scheme: dark)", color: "#0C0C14" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${fontVariables} antialiased`}>
        {children}
      </body>
    </html>
  );
}
