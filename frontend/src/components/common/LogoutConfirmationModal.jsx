import React from "react";

import { useTheme } from "../../theme/useTheme";

const overlayStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 50,
  display: "grid",
  placeItems: "center",
  padding: "20px",
  background: "rgba(4, 3, 9, 0.72)",
};

const modalStyle = {
  width: "100%",
  maxWidth: "460px",
  padding: "26px",
  background: "rgba(19, 18, 37, 0.98)",
  border: "1px solid rgba(132, 80, 255, 0.34)",
  borderRadius: "18px",
  boxSizing: "border-box",
  boxShadow: "0 28px 80px rgba(0,0,0,0.45)",
  color: "#f4f0ff",
};

const buttonStyle = {
  padding: "13px 20px",
  borderRadius: "12px",
  border: "1px solid rgba(154, 145, 176, 0.44)",
  background: "transparent",
  color: "#f4f0ff",
  cursor: "pointer",
  fontSize: "16px",
  fontWeight: 600,
};

const LogoutConfirmationModal = ({ onCancel, onConfirm, isLoggingOut = false }) => {
  const { theme } = useTheme();
  const isLightTheme = theme === "light";
  const tones = isLightTheme
    ? {
        overlay: "rgba(83, 62, 124, 0.18)",
        modalBg: "linear-gradient(180deg, #ffffff 0%, #f8f5ff 100%)",
        border: "1px solid rgba(128, 90, 213, 0.22)",
        shadow: "0 22px 58px rgba(80, 59, 130, 0.18)",
        heading: "#211833",
        body: "#6f6680",
        cancelBg: "#ffffff",
        cancelBorder: "1px solid rgba(128, 90, 213, 0.28)",
        cancelText: "#3a2b55",
        logoutBg: "rgba(255, 118, 133, 0.12)",
        logoutBorder: "rgba(214, 65, 86, 0.42)",
        logoutText: "#b42335",
      }
    : {
        overlay: overlayStyle.background,
        modalBg: modalStyle.background,
        border: modalStyle.border,
        shadow: modalStyle.boxShadow,
        heading: modalStyle.color,
        body: "#aeb5d4",
        cancelBg: buttonStyle.background,
        cancelBorder: buttonStyle.border,
        cancelText: buttonStyle.color,
        logoutBg: "rgba(255, 118, 133, 0.1)",
        logoutBorder: "rgba(255, 118, 133, 0.42)",
        logoutText: "#ff7685",
      };

  return (
    <div style={{ ...overlayStyle, background: tones.overlay }} role="presentation">
      <div
        style={{
          ...modalStyle,
          background: tones.modalBg,
          border: tones.border,
          boxShadow: tones.shadow,
          color: tones.heading,
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-confirmation-title"
      >
        <h2 id="logout-confirmation-title" style={{ margin: 0, fontSize: "22px", color: tones.heading }}>
          Logout?
        </h2>
        <div style={{ marginTop: "12px", color: tones.body, fontSize: "16px", lineHeight: 1.5 }}>
          Are you sure you want to logout?
        </div>
        <div style={{ marginTop: "24px", display: "flex", justifyContent: "flex-end", gap: "12px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoggingOut}
            style={{
              ...buttonStyle,
              background: tones.cancelBg,
              border: tones.cancelBorder,
              color: tones.cancelText,
              opacity: isLoggingOut ? 0.55 : 1,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoggingOut}
            style={{
              ...buttonStyle,
              color: tones.logoutText,
              borderColor: tones.logoutBorder,
              background: tones.logoutBg,
              opacity: isLoggingOut ? 0.55 : 1,
            }}
          >
            {isLoggingOut ? "Logging out..." : "Logout"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LogoutConfirmationModal;
