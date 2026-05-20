import React from "react";

import "../../theme/theme.css";

const iconProps = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

const MoonIcon = () => (
  <svg {...iconProps} aria-hidden="true">
    <path d="M21 14.4A7.4 7.4 0 0 1 9.6 3A8.8 8.8 0 1 0 21 14.4Z" />
  </svg>
);

const SunIcon = () => (
  <svg {...iconProps} aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5V5" />
    <path d="M12 19V21.5" />
    <path d="M4.6 4.6L6.4 6.4" />
    <path d="M17.6 17.6L19.4 19.4" />
    <path d="M2.5 12H5" />
    <path d="M19 12H21.5" />
    <path d="M4.6 19.4L6.4 17.6" />
    <path d="M17.6 6.4L19.4 4.6" />
  </svg>
);

const ThemeToggle = ({ theme, onToggle, style }) => {
  const isLightTheme = theme === "light";

  return (
    <button
      type="button"
      className="theme-toggle-button"
      onClick={onToggle}
      aria-label={`Switch to ${isLightTheme ? "dark" : "light"} theme`}
      aria-pressed={isLightTheme}
      title={`Switch to ${isLightTheme ? "dark" : "light"} theme`}
      style={style}
    >
      <span className="theme-toggle-icon">{isLightTheme ? <MoonIcon /> : <SunIcon />}</span>
      <span className="theme-toggle-label">{isLightTheme ? "Dark" : "Light"}</span>
    </button>
  );
};

export default ThemeToggle;
