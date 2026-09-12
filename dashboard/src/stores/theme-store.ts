import { useEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark" | "system";
type ResolvedTheme = Exclude<Theme, "system">;

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const media = () => typeof window !== "undefined" && typeof window.matchMedia === "function"
  ? window.matchMedia("(prefers-color-scheme: dark)")
  : null;

export function resolveTheme(theme: Theme, matchesDark: boolean): ResolvedTheme {
  return theme === "system" ? (matchesDark ? "dark" : "light") : theme;
}

export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", resolveTheme(theme, Boolean(media()?.matches)) === "dark");
  document.documentElement.style.colorScheme = resolveTheme(theme, Boolean(media()?.matches));
}

export const useThemeStore = create<ThemeState>()(persist(
  (set) => ({
    theme: "system",
    setTheme: (theme) => {
      applyTheme(theme);
      set({ theme });
    },
  }),
  { name: "mycontext-theme", partialize: ({ theme }) => ({ theme }) },
));

export function ThemeSync() {
  const theme = useThemeStore((state) => state.theme);

  useEffect(() => {
    applyTheme(theme);
    const query = media();
    if (!query || theme !== "system") return;
    const sync = () => applyTheme("system");
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, [theme]);

  return null;
}
