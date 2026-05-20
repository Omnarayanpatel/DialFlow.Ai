import { useEffect, useState } from "react";

export const THEME_STORAGE_KEY = "dialflow-theme";

const getStoredTheme = () => {
  if (typeof window === "undefined") {
    return "dark";
  }

  return localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark";
};

export const useTheme = () => {
  const [theme, setTheme] = useState(getStoredTheme);

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggleTheme = () => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  };

  return {
    theme,
    isLightTheme: theme === "light",
    toggleTheme,
  };
};
