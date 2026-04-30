import React, { useState } from "react";

import { persistSession, registerUser } from "../../services/authService";

const shellStyle = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
  background:
    "radial-gradient(circle at top left, rgba(132, 63, 255, 0.28), transparent 28%), radial-gradient(circle at bottom right, rgba(53, 149, 255, 0.16), transparent 24%), linear-gradient(180deg, #070711 0%, #0c0b18 100%)",
  color: "#f6f3ff",
  fontFamily: "Segoe UI, sans-serif",
};

const inputStyle = {
  width: "100%",
  padding: "15px 16px",
  borderRadius: "14px",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "#f6f3ff",
  outline: "none",
  boxSizing: "border-box",
  fontSize: "15px",
};

const Register = ({ onSwitchToLogin, onAuthSuccess }) => {
  const [form, setForm] = useState({
    employeeId: "",
    name: "",
    password: "",
    role: "agent",
    adminCode: "",
  });
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (key, value) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.employeeId || !form.name || !form.password) {
      setFeedback("Saare required fields fill karo.");
      return;
    }

    if (form.role === "admin" && !form.adminCode) {
      setFeedback("Admin passcode zaroori hai.");
      return;
    }

    setLoading(true);
    setFeedback("");

    try {
      const data = await registerUser(form);
      persistSession(data);
      onAuthSuccess();
    } catch (error) {
      setFeedback(error.message || "Register failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={shellStyle}>
      <div
        style={{
          position: "fixed",
          width: "600px",
          height: "600px",
          borderRadius: "999px",
          background: "rgba(146, 84, 255, 0.18)",
          filter: "blur(120px)",
          top: "-120px",
          left: "-120px",
        }}
      />
      <div
        style={{
          position: "fixed",
          width: "500px",
          height: "500px",
          borderRadius: "999px",
          background: "rgba(53, 149, 255, 0.16)",
          filter: "blur(120px)",
          right: "-120px",
          bottom: "-120px",
        }}
      />

      <form
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          maxWidth: "460px",
          padding: "34px",
          borderRadius: "28px",
          background: "rgba(255,255,255,0.05)",
          backdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.09)",
          boxShadow: "0 28px 80px rgba(0,0,0,0.35)",
          position: "relative",
        }}
      >
        <h2 style={{ margin: 0, textAlign: "center", fontSize: "32px" }}>Create Account</h2>
        <p style={{ textAlign: "center", color: "#aaa3c2", marginTop: "10px", marginBottom: "28px" }}>
          AI Powered CRM Access
        </p>

        <div style={{ display: "grid", gap: "14px" }}>
          <input
            style={inputStyle}
            type="text"
            placeholder="Employee ID"
            value={form.employeeId}
            onChange={(event) => handleChange("employeeId", event.target.value)}
          />
          <input
            style={inputStyle}
            type="text"
            placeholder="Employee Name"
            value={form.name}
            onChange={(event) => handleChange("name", event.target.value)}
          />
          <input
            style={inputStyle}
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={(event) => handleChange("password", event.target.value)}
          />
          <select
            style={{ ...inputStyle, color: "#aaa3c2", cursor: "pointer" }}
            value={form.role}
            onChange={(event) => handleChange("role", event.target.value)}
          >
            <option value="agent" style={{ background: "#18162a" }}>Agent Access</option>
            <option value="admin" style={{ background: "#18162a" }}>Admin Access</option>
          </select>

          {form.role === "admin" && (
            <input
              style={{ ...inputStyle, border: "1px solid #7d3cff" }}
              type="password"
              placeholder="Admin Passcode"
              value={form.adminCode}
              onChange={(event) => handleChange("adminCode", event.target.value)}
            />
          )}
        </div>

        {feedback ? (
          <div style={{ marginTop: "16px", color: "#d8bbff", fontSize: "14px" }}>{feedback}</div>
        ) : null}

        <button
          type="submit"
          style={{
            width: "100%",
            marginTop: "22px",
            padding: "14px 18px",
            borderRadius: "14px",
            border: 0,
            color: "#fff",
            cursor: "pointer",
            fontSize: "16px",
            background: "linear-gradient(90deg, #7d3cff 0%, #328cff 100%)",
          }}
        >
          {loading ? "Creating account..." : "Create Account"}
        </button>

        <p style={{ textAlign: "center", color: "#a9a2c2", marginTop: "18px", marginBottom: 0 }}>
          Already have an account?{" "}
          <button
            type="button"
            onClick={onSwitchToLogin}
            style={{
              background: "transparent",
              border: 0,
              color: "#65a8ff",
              cursor: "pointer",
              padding: 0,
              fontSize: "14px",
            }}
          >
            Login
          </button>
        </p>
      </form>
    </div>
  );
};

export default Register;
