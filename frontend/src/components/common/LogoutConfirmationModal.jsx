import React from "react";

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

const LogoutConfirmationModal = ({ onCancel, onConfirm, isLoggingOut = false }) => (
  <div style={overlayStyle} role="presentation">
    <div style={modalStyle} role="dialog" aria-modal="true" aria-labelledby="logout-confirmation-title">
      <h2 id="logout-confirmation-title" style={{ margin: 0, fontSize: "22px" }}>
        Logout?
      </h2>
      <div style={{ marginTop: "12px", color: "#aeb5d4", fontSize: "16px", lineHeight: 1.5 }}>
        Are you sure you want to logout?
      </div>
      <div style={{ marginTop: "22px", display: "flex", justifyContent: "flex-end", gap: "10px", flexWrap: "wrap" }}>
        <button type="button" onClick={onCancel} disabled={isLoggingOut} style={{ ...buttonStyle, opacity: isLoggingOut ? 0.55 : 1 }}>
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isLoggingOut}
          style={{
            ...buttonStyle,
            color: "#ff7685",
            borderColor: "rgba(255, 118, 133, 0.42)",
            background: "rgba(255, 118, 133, 0.1)",
            opacity: isLoggingOut ? 0.55 : 1,
          }}
        >
          {isLoggingOut ? "Logging out..." : "Logout"}
        </button>
      </div>
    </div>
  </div>
);

export default LogoutConfirmationModal;
