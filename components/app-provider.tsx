"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type Language = "fa" | "en";
type Theme = "light" | "dark";

type AppContextType = {
  language: Language;
  theme: Theme;
  direction: "rtl" | "ltr";
  setLanguage: (language: Language) => void;
  setTheme: (theme: Theme) => void;
  toggleLanguage: () => void;
  toggleTheme: () => void;
  t: (fa: string, en: string) => string;
};

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("fa");
  const [theme, setThemeState] = useState<Theme>("light");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const savedLanguage = localStorage.getItem("general-language");
      const savedTheme = localStorage.getItem("general-theme");

      if (savedLanguage === "fa" || savedLanguage === "en") {
        setLanguageState(savedLanguage);
      }

      if (savedTheme === "light" || savedTheme === "dark") {
        setThemeState(savedTheme);
      }
    } catch (error) {
      console.error("Could not read preferences:", error);
    }

    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;

    document.documentElement.lang = language;
    document.documentElement.dir = language === "fa" ? "rtl" : "ltr";
    document.documentElement.classList.toggle("dark", theme === "dark");

    try {
      localStorage.setItem("general-language", language);
      localStorage.setItem("general-theme", theme);
    } catch (error) {
      console.error("Could not save preferences:", error);
    }
  }, [language, theme, ready]);

  const setLanguage = useCallback((value: Language) => {
    setLanguageState(value);
  }, []);

  const setTheme = useCallback((value: Theme) => {
    setThemeState(value);
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguageState((current) => (current === "fa" ? "en" : "fa"));
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => (current === "light" ? "dark" : "light"));
  }, []);

  const t = useCallback(
    (fa: string, en: string) => {
      return language === "fa" ? fa : en;
    },
    [language]
  );

  return (
    <AppContext.Provider
      value={{
        language,
        theme,
        direction: language === "fa" ? "rtl" : "ltr",
        setLanguage,
        setTheme,
        toggleLanguage,
        toggleTheme,
        t,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error("useApp must be used inside AppProvider");
  }

  return context;
}

export function AppControls() {
  const { language, theme, toggleLanguage, toggleTheme, t } = useApp();

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={toggleLanguage}
        className="rounded-xl border border-[var(--line)] px-3 py-2 text-sm font-bold transition hover:border-[var(--gold)]"
        aria-label={t("تغییر زبان", "Change language")}
      >
        {language === "fa" ? "EN" : "فا"}
      </button>

      <button
        type="button"
        onClick={toggleTheme}
        className="rounded-xl border border-[var(--line)] px-3 py-2 text-sm transition hover:border-[var(--gold)]"
        aria-label={t("تغییر تم", "Change theme")}
      >
        {theme === "light" ? "🌙" : "☀️"}
      </button>
    </div>
  );
}