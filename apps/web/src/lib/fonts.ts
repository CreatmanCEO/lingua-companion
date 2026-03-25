/**
 * Конфигурация шрифтов Geist от Vercel
 * https://vercel.com/font
 */

import { Geist, Geist_Mono } from "next/font/google";

// Основной UI шрифт
export const geistSans = Geist({
  variable: "--font-ui",
  subsets: ["latin"],
  display: "swap",
});

// Моноширинный шрифт для транскриптов и diff
export const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

// CSS классы для применения в layout
export const fontVariables = `${geistSans.variable} ${geistMono.variable}`;
