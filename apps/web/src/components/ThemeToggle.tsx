"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Типы темы
 */
type Theme = "light" | "dark";

/**
 * Применение темы к document
 */
function applyTheme(newTheme: Theme) {
  const root = document.documentElement;

  if (newTheme === "light") {
    root.classList.add("light");
  } else {
    root.classList.remove("light");
  }
}

/**
 * ThemeToggle компонент
 *
 * Логика:
 * - localStorage key: "theme" = "light" | "dark"
 * - При mount: читаем localStorage, если нет - prefers-color-scheme
 * - Toggle добавляет/убирает .light класс на document.documentElement
 * - CSS transition 200ms на всех color variables
 * - Icon: Sun (light) / Moon (dark) из lucide-react
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  // Инициализация темы при монтировании
  useEffect(() => {
    setMounted(true);

    // Читаем из localStorage
    const storedTheme = localStorage.getItem("theme") as Theme | null;

    if (storedTheme) {
      setTheme(storedTheme);
      applyTheme(storedTheme);
    } else {
      // Используем системные настройки
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;
      const initialTheme: Theme = prefersDark ? "dark" : "light";
      setTheme(initialTheme);
      applyTheme(initialTheme);
    }
  }, []);

  /**
   * Переключение темы
   */
  const toggleTheme = () => {
    const newTheme: Theme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    applyTheme(newTheme);
    localStorage.setItem("theme", newTheme);
  };

  // Не рендерим до mount (предотвращает hydration mismatch)
  if (!mounted) {
    return (
      <button
        type="button"
        className="w-[34px] h-[34px] rounded-[10px] bg-card border border-subtle flex items-center justify-center text-secondary"
        aria-label="Toggle theme"
        disabled
      >
        <div className="w-4 h-4" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        "w-[34px] h-[34px] rounded-[10px] bg-card border border-subtle",
        "flex items-center justify-center text-secondary hover:text-primary",
        "transition-all active:scale-[0.92]",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      )}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {/* Emoji icon как в прототипе */}
      <span style={{ fontSize: "15px" }}>
        {theme === "dark" ? "☀️" : "🌙"}
      </span>
    </button>
  );
}
