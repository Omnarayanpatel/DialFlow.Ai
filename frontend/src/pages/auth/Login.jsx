import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginUser, persistSession } from "../../services/authService";

const shellStyle = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
  background:
    "radial-gradient(circle at top left, rgba(132, 63, 255, 0.28), transparent 28%), radial-gradient(circle at bottom right, rgba(32, 203, 255, 0.22), transparent 24%), linear-gradient(180deg, #070711 0%, #0c0b18 100%)",
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

const Login = ({ onAuthSuccess }) => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    employeeId: "",
    password: "",
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

    if (!form.employeeId || !form.password) {
      setFeedback("Employee ID aur password required hain.");
      return;
    }

    setLoading(true);
    setFeedback("");

    try {
      const data = await loginUser(form);
      persistSession(data);
      onAuthSuccess();

      // Automatic redirect based on role
      if (data.user.role === "admin") {
        navigate("/admin/dashboard");
      } else {
        navigate("/agent/dashboard");
      }
    } catch (error) {
      setFeedback(error.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={shellStyle}>
      <div
        style={{
          position: "fixed",
          width: "520px",
          height: "520px",
          borderRadius: "999px",
          background: "rgba(146, 84, 255, 0.18)",
          filter: "blur(110px)",
          top: "-120px",
          left: "-120px",
        }}
      />
      <div
        style={{
          position: "fixed",
          width: "460px",
          height: "460px",
          borderRadius: "999px",
          background: "rgba(53, 149, 255, 0.16)",
          filter: "blur(110px)",
          right: "-100px",
          bottom: "-100px",
        }}
      />

      <form
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          maxWidth: "430px",
          padding: "34px",
          borderRadius: "28px",
          background: "rgba(255,255,255,0.05)",
          backdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.09)",
          boxShadow: "0 28px 80px rgba(0,0,0,0.35)",
          position: "relative",
        }}
      >
        <h2 style={{ margin: 0, textAlign: "center", fontSize: "32px" }}>Welcome Back</h2>
        <p style={{ textAlign: "center", color: "#aaa3c2", marginTop: "10px", marginBottom: "28px" }}>
          AI Powered CRM Access
        </p>

        <div style={{ display: "grid", gap: "16px" }}>
          <input
            style={inputStyle}
            type="text"
            placeholder="Employee ID"
            value={form.employeeId}
            onChange={(event) => handleChange("employeeId", event.target.value)}
          />
          <input
            style={inputStyle}
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={(event) => handleChange("password", event.target.value)}
          />
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
          {loading ? "Signing in..." : "Login"}
        </button>

        <p style={{ textAlign: "center", color: "#a9a2c2", marginTop: "18px", marginBottom: 0 }}>
          Don&apos;t have an account?{" "}
          <button
            type="button"
            onClick={() => navigate("/register")}
            style={{
              background: "transparent",
              border: 0,
              color: "#65a8ff",
              cursor: "pointer",
              padding: 0,
              fontSize: "14px",
            }}
          >
            Register
          </button>
        </p>
      </form>
    </div>
  );
};

export default Login;
